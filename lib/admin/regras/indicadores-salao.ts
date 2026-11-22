import { isSameDay } from "date-fns"
import type { Mesa, Pedido } from "../dados/tipos"
import { emCentavos, pagoNoDiaSemTaxa, resumoDaConta } from "./conta"

export type IndicadoresSalao = {
  ocupacao: { ocupadas: number; total: number; percentual: number; texto: string }
  pessoas: number
  faturamento: number
  ticketPorPessoa: number | null
  ticketPorMesa: number | null
  permanenciaMin: number | null
  giro: number | null
}

const dePessoas = (pedido: Pedido) => pedido.mesa?.pessoas ?? 1

/** Números do salão hoje: ocupação, pessoas, faturamento, tickets, permanência e giro. */
export function indicadoresSalao({
  mesas,
  abertas,
  concluidos,
  agora,
}: {
  mesas: Mesa[]
  abertas: Pedido[]
  concluidos: Pedido[]
  agora: Date
}): IndicadoresSalao {
  const utilizaveis = mesas.filter((mesa) => !mesa.bloqueio)
  const ocupadas = utilizaveis.filter((mesa) => mesa.status === "ocupada" || mesa.juntadaCom).length
  const total = utilizaveis.length
  const percentual = total === 0 ? 0 : Math.round((ocupadas / total) * 100)

  const pagas = concluidos.filter(
    (pedido) =>
      pedido.tipo === "mesa" &&
      pedido.situacaoPagamento === "pago" &&
      pedido.pagoEm &&
      isSameDay(new Date(pedido.pagoEm), agora),
  )
  // A conta fechada hoje, sem a taxa de serviço (que é do garçom): base dos tickets.
  const centavos = pagas.reduce(
    (soma, pedido) => soma + emCentavos(pedido.total) - emCentavos(resumoDaConta(pedido).taxa),
    0,
  )
  // Faturamento: o que entrou hoje (inclusive o parcial de conta aberta), sem a taxa.
  const faturamento = [...abertas, ...concluidos.filter((pedido) => pedido.tipo === "mesa")].reduce(
    (soma, pedido) => soma + emCentavos(pagoNoDiaSemTaxa(pedido, agora)),
    0,
  )
  const pessoasPagas = pagas.reduce((soma, pedido) => soma + dePessoas(pedido), 0)
  const minutos = pagas.reduce(
    (soma, pedido) =>
      soma + (Date.parse(pedido.pagoEm as string) - Date.parse(pedido.criadoEm)) / 60_000,
    0,
  )
  const haPagas = pagas.length > 0

  return {
    ocupacao: { ocupadas, total, percentual, texto: `${ocupadas}/${total} · ${percentual}%` },
    pessoas: abertas.reduce((soma, pedido) => soma + dePessoas(pedido), 0),
    faturamento: faturamento / 100,
    ticketPorPessoa: haPagas && pessoasPagas > 0 ? Math.round(centavos / pessoasPagas) / 100 : null,
    ticketPorMesa: haPagas ? Math.round(centavos / pagas.length) / 100 : null,
    permanenciaMin: haPagas ? Math.round(minutos / pagas.length) : null,
    giro: haPagas && total > 0 ? Math.round((pagas.length / total) * 10) / 10 : null,
  }
}
