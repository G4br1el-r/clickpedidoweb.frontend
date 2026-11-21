"use client"

import { ArmchairIcon } from "lucide-react"
import { useState } from "react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgora } from "@/hooks/use-agora"
import { useFila } from "@/lib/admin/dados/consultas"
import { useConfigSalao, useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { alertasDaMesa } from "@/lib/admin/regras/alertas-mesa"
import type { MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { CartaoMesa } from "./cartao-mesa"
import { ComandaMesa } from "./comanda-mesa"
import { NovaMesa } from "./nova-mesa"

const GRADE = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"

/** Mesas do salão: a grade por área, na ordem das áreas, e a comanda de cada mesa. */
export function PaginaMesas() {
  const { data: mesas } = useMesas()
  const { data: salao } = useConfigSalao()
  const { data: fila } = useFila()
  const agora = useAgora(30_000)
  const [abertaId, setAbertaId] = useState<string | null>(null)

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

  const linhas: MesaNaGrade[] = (mesas ?? []).map((mesa) => {
    const comanda = comandaDa(mesa)
    return {
      mesa,
      comanda,
      estado: estadoDaMesa(mesa, comanda),
      alertas: salao && agora ? alertasDaMesa(mesa, comanda, salao.alertas, agora) : [],
    }
  })
  // Área sem mesa não aparece.
  const grupos = (salao?.areas ?? [])
    .toSorted((a, b) => a.ordem - b.ordem)
    .map((area) => ({ area, linhas: linhas.filter(({ mesa }) => mesa.areaId === area.id) }))
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
                plural(mesas.length - ocupadas, "livre", "livres"),
                naCozinha > 0 ? `${naCozinha} com rodada na cozinha` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando as mesas…"
        }
        acoes={<NovaMesa />}
      />

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
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ComandaMesa mesa={aberta} aoFechar={() => setAbertaId(null)} />
    </div>
  )
}
