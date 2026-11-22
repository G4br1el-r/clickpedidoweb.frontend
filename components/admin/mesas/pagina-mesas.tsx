"use client"

import { ArmchairIcon, SearchXIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgora } from "@/hooks/use-agora"
import { useFila } from "@/lib/admin/dados/consultas"
import { useConfigSalao, useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { alertasDaMesa } from "@/lib/admin/regras/alertas-mesa"
import { filtrarMesas, type MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { AtalhosMesas, FolhaAtalhos } from "./atalhos-mesas"
import { BloquearMesa } from "./bloquear-mesa"
import { CartaoMesa } from "./cartao-mesa"
import { ComandaMesa } from "./comanda-mesa"
import { ConfigurarSalao } from "./configurar-salao"
import { LIMPAR_GRADE, useEstadoGrade } from "./estado-grade"
import { FiltrosMesas } from "./filtros-mesas"
import { FormularioMesa } from "./formulario-mesa"
import { NovaMesa } from "./nova-mesa"
import { NumerosSalao } from "./numeros-salao"

const GRADE = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"

/** Mesas do salão: a grade por área, na ordem das áreas, e a comanda de cada mesa. */
export function PaginaMesas() {
  const { data: mesas } = useMesas(4_000)
  const { data: salao } = useConfigSalao()
  const { data: fila } = useFila()
  const agora = useAgora(30_000)
  const [filtros, setFiltros] = useEstadoGrade()
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null)
  // O botão ⋯ que abriu Editar ou Bloquear: o foco volta a ele quando a janela fecha.
  const [gatilhoMenu, setGatilhoMenu] = useState<HTMLElement | null>(null)
  const [novaAberta, setNovaAberta] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)

  const comandas = new Map(
    (fila ?? []).filter((pedido) => pedido.tipo === "mesa").map((p) => [p.id, p]),
  )
  const comandaDa = (mesa: Mesa) =>
    mesa.pedidoAtivoId ? comandas.get(mesa.pedidoAtivoId) : undefined
  const ocupadas = mesas?.filter((mesa) => mesa.status === "ocupada").length ?? 0
  const naCozinha =
    mesas?.filter((mesa) => {
      const status = comandaDa(mesa)?.status
      return mesa.status === "ocupada" && (status === "recebido" || status === "em-preparo")
    }).length ?? 0
  const aberta = mesas?.find((mesa) => mesa.id === abertaId) ?? null
  const editando = mesas?.find((mesa) => mesa.id === editandoId)
  const bloqueando = mesas?.find((mesa) => mesa.id === bloqueandoId)

  function abrirPeloNumero(numero: number) {
    const mesa = mesas?.find((candidata) => candidata.numero === numero)
    if (mesa) setAbertaId(mesa.id)
    else toast.error(`Não existe a mesa ${numero}.`)
  }

  const linhas: MesaNaGrade[] = (mesas ?? []).map((mesa) => {
    const comanda = comandaDa(mesa)
    return {
      mesa,
      comanda,
      estado: estadoDaMesa(mesa, comanda),
      alertas: salao && agora ? alertasDaMesa(mesa, comanda, salao.alertas, agora) : [],
    }
  })
  // Livre pelo estado: a bloqueada e a em limpeza não entram.
  const livres = linhas.filter((linha) => linha.estado.estado === "livre").length
  const visiveis = filtrarMesas(
    linhas,
    {
      busca: filtros.busca,
      area: filtros.area,
      estado: filtros.estado,
      garcom: filtros.garcom,
      atencao: filtros.atencao === "sim",
    },
    filtros.ordem,
  )
  // Área sem mesa não aparece.
  const grupos = (salao?.areas ?? [])
    .toSorted((a, b) => a.ordem - b.ordem)
    .map((area) => ({ area, linhas: visiveis.filter(({ mesa }) => mesa.areaId === area.id) }))
    .filter((grupo) => grupo.linhas.length > 0)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Mesas"
        vivo
        resumo={
          mesas
            ? [
                plural(ocupadas, "ocupada", "ocupadas"),
                plural(livres, "livre", "livres"),
                naCozinha > 0 ? `${naCozinha} com rodada na cozinha` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando as mesas…"
        }
        acoes={
          <>
            <ConfigurarSalao salao={salao} />
            <NovaMesa aberta={novaAberta} aoMudar={setNovaAberta} />
          </>
        }
      />

      {mesas && agora && (
        <NumerosSalao mesas={mesas} abertas={[...comandas.values()]} agora={agora} />
      )}

      {mesas && salao && mesas.length > 0 && (
        <FiltrosMesas
          areas={salao.areas}
          garcons={salao.garcons}
          comAtencao={linhas.filter((linha) => linha.alertas.length > 0).length}
        />
      )}

      {!mesas || !salao ? (
        <div role="status" aria-label="Carregando as mesas" className={GRADE}>
          {Array.from({ length: 10 }, (_, indice) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo
            <Skeleton key={indice} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : mesas.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArmchairIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma mesa cadastrada</EmptyTitle>
            <EmptyDescription>
              Crie as mesas do salão em Nova mesa para o garçom lançar os pedidos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : grupos.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma mesa com esses filtros</EmptyTitle>
            <EmptyDescription>Mude a busca ou os filtros.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" size="sm" onClick={() => setFiltros(LIMPAR_GRADE)}>
              Limpar filtros
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(({ area, linhas }) => (
            <section
              key={area.id}
              aria-labelledby={`area-${area.id}`}
              className="flex flex-col gap-2.5"
            >
              <h2 id={`area-${area.id}`} className="text-[15px] font-semibold tracking-[-0.01em]">
                {area.nome}
              </h2>
              <ul aria-labelledby={`area-${area.id}`} className={GRADE}>
                {linhas.map((linha) => (
                  <li key={linha.mesa.id}>
                    <CartaoMesa
                      {...linha}
                      agora={agora}
                      aoAbrir={() => setAbertaId(linha.mesa.id)}
                      aoEditar={(gatilho) => {
                        setGatilhoMenu(gatilho)
                        setEditandoId(linha.mesa.id)
                      }}
                      aoBloquear={(gatilho) => {
                        setGatilhoMenu(gatilho)
                        setBloqueandoId(linha.mesa.id)
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FormularioMesa
        key={editandoId}
        mesa={editando}
        aberta={editando !== undefined}
        aoMudar={() => setEditandoId(null)}
        focoAoFechar={gatilhoMenu}
      />
      {bloqueando && (
        <BloquearMesa
          mesa={bloqueando}
          aberta
          aoMudar={() => setBloqueandoId(null)}
          focoAoFechar={gatilhoMenu}
        />
      )}
      <ComandaMesa mesa={aberta} aoFechar={() => setAbertaId(null)} />
      <AtalhosMesas
        aoAbrirMesa={abrirPeloNumero}
        aoNovaMesa={() => setNovaAberta(true)}
        aoAjuda={() => setAjudaAberta(true)}
      />
      <FolhaAtalhos aberta={ajudaAberta} aoMudar={setAjudaAberta} />
    </div>
  )
}
