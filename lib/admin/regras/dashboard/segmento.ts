import { emReais, plural } from "../../../formato"
import type { Lote, Mesa, Pedido, Receita } from "../../dados/tipos"
import type { SegmentoPainelId } from "../../segmentos-painel"
import { resumoDaAgenda } from "../agenda"
import { lotesVencendo, pedidosAPesar, receitasAConferir } from "./contagens"

export type Destaque = { id: string; rotulo: string; valor: number; detalhe?: string; href: string }

export type EntradaDestaques = {
  segmento: SegmentoPainelId
  agora: Date
  pedidos: Pedido[]
  lotes: Lote[]
  receitas: Receita[]
  decisoes: Record<string, unknown>
  /** Mesas da loja; `null` onde o segmento não tem mesas. */
  mesas: Mesa[] | null
}

/** Os números do bloco do segmento no Resumo, cada um com a tela que mostra mais. */
export function destaquesDoSegmento({
  segmento,
  agora,
  pedidos,
  lotes,
  receitas,
  decisoes,
  mesas,
}: EntradaDestaques): Destaque[] {
  const destaques: Destaque[] = []
  if (segmento === "salao") {
    const { hoje, amanha } = resumoDaAgenda(pedidos, agora)
    destaques.push({
      id: "agenda",
      rotulo: "Agenda de hoje",
      valor: hoje.quantidade,
      detalhe: `${emReais(hoje.total)} · ${amanha.quantidade} amanhã`,
      href: "/admin/agendamentos",
    })
  }
  if (segmento === "farmacia") {
    destaques.push(
      {
        id: "receitas",
        rotulo: "Receitas a conferir",
        valor: receitasAConferir(receitas, decisoes),
        href: "/admin/receitas",
      },
      {
        id: "lotes",
        rotulo: "Lotes vencendo",
        valor: lotesVencendo(lotes, agora),
        detalhe: "Vencidos ou em até 30 dias",
        href: "/admin/validade",
      },
    )
  }
  if (segmento === "acougue")
    destaques.push({
      id: "pesagem",
      rotulo: "Esperando pesagem",
      valor: pedidosAPesar(pedidos),
      href: "/admin/fila",
    })
  if (mesas)
    destaques.push({
      id: "mesas",
      rotulo: "Mesas ocupadas",
      valor: mesas.filter((mesa) => mesa.status === "ocupada").length,
      detalhe: `De ${plural(mesas.length, "mesa", "mesas")}`,
      href: "/admin/mesas",
    })
  return destaques
}
