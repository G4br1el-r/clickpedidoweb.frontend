"use client"

import { ArmchairIcon, KeyboardIcon, LayoutGridIcon, MapIcon, SearchXIcon } from "lucide-react"
import { useEffect, useState } from "react"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useFila } from "@/lib/admin/dados/consultas"
import {
  useChamados,
  useConfigSalao,
  useMesas,
  usePedidosQr,
  useReservas,
} from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { useGarcomCarregado } from "@/lib/admin/garcom"
import { usePreferenciasMesasCarregadas } from "@/lib/admin/preferencias-mesas"
import { alertasDaMesa } from "@/lib/admin/regras/alertas-mesa"
import { seloDaMesa } from "@/lib/admin/regras/chamados"
import { filtrarMesas, type MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { reservaDaMesa } from "@/lib/admin/regras/reservas"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { SeloPro } from "../campos"
import { AtalhosMesas, FolhaAtalhos } from "./atalhos-mesas"
import { BloquearMesa } from "./bloquear-mesa"
import { CartaoMesa } from "./cartao-mesa"
import { ChamadosSalao } from "./chamados"
import { ComandaMesa } from "./comanda-mesa"
import { ConfigurarSalao } from "./configurar-salao"
import { LIMPAR_GRADE, useEstadoGrade, useMesaAberta, useVista, type Vista } from "./estado-grade"
import { FiltrosMesas } from "./filtros-mesas"
import { FormularioMesa } from "./formulario-mesa"
import { MapaPro, MapaSalao } from "./mapa-salao"
import { NovaMesa } from "./nova-mesa"
import { NumerosSalao } from "./numeros-salao"
import { PainelReservas } from "./reservas-espera"

// As colunas seguem a largura que sobra para a grade (com o painel de reservas ao lado, a partir de
// 1280 px, ela encolhe): o cartão fica com uns 185 px ou mais, sem cortar o nome nem a reserva.
const GRADE = "grid grid-cols-2 gap-2.5 @xl:grid-cols-3 @min-[52rem]:grid-cols-4 @5xl:grid-cols-5"

/** Mesas do salão: a grade por área, na ordem das áreas, e a comanda de cada mesa. */
export function PaginaMesas() {
  usePreferenciasMesasCarregadas()
  useGarcomCarregado()
  const { data: mesas } = useMesas(4_000)
  const { data: salao } = useConfigSalao()
  const { data: fila } = useFila()
  const { data: reservas } = useReservas(4_000)
  const qrLigado = salao?.funcoes.qr ?? false
  const { data: chamados } = useChamados(4_000, { ativo: qrLigado })
  const { data: pedidosQr } = usePedidosQr(4_000, { ativo: qrLigado })
  const agora = useAgora(30_000)
  const [filtros, setFiltros] = useEstadoGrade()
  const [numeroAberto, setNumeroAberto] = useMesaAberta()
  const [vista, setVista] = useVista()
  const mapaLiberado = salao?.funcoes.mapa ?? false
  // Com a função Pro desligada, ?vista=mapa mostra a grade.
  const noMapa = vista === "mapa" && mapaLiberado
  const [mapaProAberto, setMapaProAberto] = useState(false)
  const [salaoAberto, setSalaoAberto] = useState(false)
  const mudarVista = (nova: Vista) => {
    if (nova === "mapa" && !mapaLiberado) setMapaProAberto(true)
    else void setVista(nova)
  }
  const telaGrande = useTelaGrande()
  const [edicaoPedida, setEditandoMapa] = useState(false)
  // A edição só vale no mapa liberado e em tela grande: desligar a função ou a tela encolher sai dela.
  const editandoMapa = edicaoPedida && noMapa && telaGrande
  useEffect(() => {
    if (!noMapa || !telaGrande) setEditandoMapa(false)
  }, [noMapa, telaGrande])
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
  // Número que não existe no endereço não abre nada, e sai do endereço.
  const aberta = mesas?.find((mesa) => mesa.numero === numeroAberto) ?? null
  const semMesa = mesas !== undefined && numeroAberto !== null && aberta === null
  useEffect(() => {
    if (semMesa) void setNumeroAberto(null)
  }, [semMesa, setNumeroAberto])
  const editando = mesas?.find((mesa) => mesa.id === editandoId)
  const bloqueando = mesas?.find((mesa) => mesa.id === bloqueandoId)

  function abrirPeloNumero(numero: number) {
    const mesa = mesas?.find((candidata) => candidata.numero === numero)
    if (mesa) void setNumeroAberto(mesa.numero)
    else toast.error(`Não existe a mesa ${numero}.`)
  }

  // A mesa juntada mostra a principal e leva a comanda dela (para o garçom e o menu ⋯).
  const principalDe = (mesa: Mesa) =>
    mesa.juntadaCom ? mesas?.find((outra) => outra.id === mesa.juntadaCom) : undefined
  const abrirLinha = (linha: MesaNaGrade) =>
    void setNumeroAberto((principalDe(linha.mesa) ?? linha.mesa).numero)
  const editarLinha = (linha: MesaNaGrade, gatilho: HTMLElement | null) => {
    setGatilhoMenu(gatilho)
    setEditandoId(linha.mesa.id)
  }
  const bloquearLinha = (linha: MesaNaGrade, gatilho: HTMLElement | null) => {
    setGatilhoMenu(gatilho)
    setBloqueandoId(linha.mesa.id)
  }
  const linhas: MesaNaGrade[] = (mesas ?? []).map((mesa) => {
    const principal = principalDe(mesa)
    const comanda = comandaDa(principal ?? mesa)
    // A reserva só conta na mesa sem comanda: aberta, ela já está ocupada.
    const reserva =
      salao && agora && !comanda && !principal
        ? reservaDaMesa(mesa, reservas ?? [], agora, salao.reservas)
        : undefined
    return {
      mesa,
      comanda,
      reserva,
      selo: qrLigado
        ? seloDaMesa(
            chamados?.filter((chamado) => chamado.mesaId === mesa.id),
            pedidosQr?.filter((pedido) => pedido.mesaId === mesa.id),
          )
        : null,
      estado: estadoDaMesa(mesa, comanda, {
        ...(principal ? { principal } : {}),
        ...(reserva && agora
          ? { reserva, agora, antecedenciaMin: salao?.reservas.antecedenciaMin }
          : {}),
      }),
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
            {/* A folha abre também pelo botão: quem desligou os atalhos de uma tecla perde o "?". */}
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Atalhos do teclado"
              title="Atalhos do teclado"
              onClick={() => setAjudaAberta(true)}
            >
              <KeyboardIcon />
            </Button>
            {mesas && salao && (
              <ChamadosSalao
                mesas={mesas}
                salao={salao}
                chamados={chamados}
                pedidos={pedidosQr}
                agora={agora}
                aoConfigurar={() => setSalaoAberto(true)}
              />
            )}
            <ConfigurarSalao salao={salao} aberto={salaoAberto} aoMudar={setSalaoAberto} />
            <NovaMesa aberta={novaAberta} aoMudar={setNovaAberta} />
          </>
        }
      />

      {mesas && agora && (
        <NumerosSalao
          mesas={mesas}
          abertas={[...comandas.values()]}
          agora={agora}
          {...(qrLigado && chamados ? { chamados } : {})}
        />
      )}

      {/* O painel de reservas fica à direita a partir de 1280 px; abaixo disso, acima da grade.
          Editando o mapa ele sai de cena: o mapa fica com a largura toda e, no celular deitado,
          o painel não empurra o mapa para baixo da dobra. */}
      <div
        className={cn(
          "grid gap-5 xl:items-start",
          !editandoMapa && "xl:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        {mesas && salao && !editandoMapa && (
          <aside className="min-w-0 xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1">
            <PainelReservas mesas={mesas} salao={salao} aoConfigurar={() => setSalaoAberto(true)} />
          </aside>
        )}
        <div className="@container flex min-w-0 flex-col gap-5 xl:col-start-1 xl:row-start-1">
          {mesas && salao && mesas.length > 0 && (
            <ToggleGroup
              type="single"
              variant="segmento"
              size="sm"
              aria-label="Vista"
              value={noMapa ? "mapa" : "grade"}
              disabled={editandoMapa}
              onValueChange={(nova) => nova && mudarVista(nova as Vista)}
            >
              <ToggleGroupItem value="grade" className="px-3">
                <LayoutGridIcon data-icon="inline-start" />
                Grade
              </ToggleGroupItem>
              <ToggleGroupItem
                value="mapa"
                className="px-3"
                aria-label={mapaLiberado ? undefined : "Mapa Pro"}
              >
                <MapIcon data-icon="inline-start" />
                Mapa
                {!mapaLiberado && <SeloPro liberada={false} />}
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {mesas && salao && mesas.length > 0 && !noMapa && (
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
          ) : noMapa ? (
            <MapaSalao
              linhas={linhas}
              areas={salao.areas}
              areaId={filtros.area}
              aoMudarArea={(area) => void setFiltros({ area })}
              agora={agora}
              podeEditar={telaGrande}
              editando={editandoMapa}
              aoMudarEdicao={setEditandoMapa}
              aoAbrir={abrirLinha}
              aoEditar={editarLinha}
              aoBloquear={bloquearLinha}
            />
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
                  <h2
                    id={`area-${area.id}`}
                    className="text-[15px] font-semibold tracking-[-0.01em]"
                  >
                    {area.nome}
                  </h2>
                  <ul aria-labelledby={`area-${area.id}`} className={GRADE}>
                    {linhas.map((linha) => (
                      <li key={linha.mesa.id}>
                        <CartaoMesa
                          {...linha}
                          agora={agora}
                          aoAbrir={() => abrirLinha(linha)}
                          aoEditar={(gatilho) => editarLinha(linha, gatilho)}
                          aoBloquear={(gatilho) => bloquearLinha(linha, gatilho)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

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
      <ComandaMesa mesa={aberta} aoFechar={() => void setNumeroAberto(null)} />
      <AtalhosMesas
        // Na edição do mapa os atalhos que abrem janela travam, como o M.
        aoAbrirMesa={(numero) => !editandoMapa && abrirPeloNumero(numero)}
        aoNovaMesa={() => !editandoMapa && setNovaAberta(true)}
        aoAjuda={() => setAjudaAberta(true)}
        aoAlternarVista={() => !editandoMapa && mudarVista(noMapa ? "grade" : "mapa")}
      />
      <FolhaAtalhos aberta={ajudaAberta} aoMudar={setAjudaAberta} />
      <MapaPro
        aberta={mapaProAberto}
        aoMudar={setMapaProAberto}
        aoConfigurar={() => setSalaoAberto(true)}
      />
    </div>
  )
}
