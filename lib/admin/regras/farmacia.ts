import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import type {
  DadosMedicamento,
  Lote,
  MovimentoControlado,
  Pedido,
  Produto,
  Receita,
  TipoReceita,
} from "../dados/tipos"

/** Receituário que o medicamento exige; `null` quando é de venda livre. */
export function receitaExigida(medicamento: DadosMedicamento): TipoReceita | null {
  if (medicamento.tarja === "sem-tarja") return null
  switch (medicamento.lista) {
    case "A1":
    case "A2":
    case "A3":
      return "notificacao-a"
    case "B1":
    case "B2":
      return "notificacao-b"
    case "C1":
      return "controle-especial"
    case "antimicrobiano":
      return "antimicrobiano"
    default:
      return "simples"
  }
}

/** Do menos ao mais exigente: o pedido pede o receituário do item mais exigente. */
const ORDEM_DA_RECEITA: TipoReceita[] = [
  "simples",
  "antimicrobiano",
  "controle-especial",
  "notificacao-b",
  "notificacao-a",
]

const medicamentoDo = (produtoId: string | null, produtos: Produto[]) =>
  produtos.find((produto) => produto.id === produtoId)?.medicamento

/** O receituário que o pedido pede (o do item mais exigente); `null` se é tudo venda livre. */
export function receitaDoPedido(pedido: Pedido, produtos: Produto[]): TipoReceita | null {
  const exigidas = pedido.itens.flatMap((item) => {
    const medicamento = medicamentoDo(item.produtoId, produtos)
    const exigida = medicamento ? receitaExigida(medicamento) : null
    return exigida ? [exigida] : []
  })
  if (exigidas.length === 0) return null
  return exigidas.reduce((maior, tipo) =>
    ORDEM_DA_RECEITA.indexOf(tipo) > ORDEM_DA_RECEITA.indexOf(maior) ? tipo : maior,
  )
}

/**
 * Os controlados do pedido (Portaria 344: listas A, B e C), pelo nome. Esses não saem para
 * entrega: só no balcão, com a receita retida. Antimicrobiano não entra aqui.
 */
export function controladosDoPedido(pedido: Pedido, produtos: Produto[]): string[] {
  return pedido.itens
    .filter((item) => {
      const lista = medicamentoDo(item.produtoId, produtos)?.lista
      return lista !== undefined && lista !== "antimicrobiano"
    })
    .map((item) => item.nome)
}

/** Como cada receituário funciona no balcão. */
export const INFO_RECEITA: Record<
  TipoReceita,
  { nome: string; papel: string; validadeDias: number | null; retencao: boolean }
> = {
  simples: { nome: "Receita simples", papel: "Branca", validadeDias: null, retencao: false },
  antimicrobiano: {
    nome: "Receita de antimicrobiano",
    papel: "Branca, 2 vias",
    validadeDias: 10,
    retencao: true,
  },
  "controle-especial": {
    nome: "Receita de controle especial",
    papel: "Branca, 2 vias",
    validadeDias: 30,
    retencao: true,
  },
  "notificacao-b": {
    nome: "Notificação de receita B",
    papel: "Azul",
    validadeDias: 30,
    retencao: true,
  },
  "notificacao-a": {
    nome: "Notificação de receita A",
    papel: "Amarela",
    validadeDias: 30,
    retencao: true,
  },
}

export type SituacaoReceita =
  | { estado: "sem-prazo" }
  | { estado: "valida" | "vencida"; validaAte: string; diasRestantes: number }

/** Validade contada da data de emissão; vale até o fim do último dia. */
export function situacaoDaReceita(
  tipo: TipoReceita,
  emitidaEm: string,
  agora: Date,
): SituacaoReceita {
  const dias = INFO_RECEITA[tipo].validadeDias
  if (dias === null) return { estado: "sem-prazo" }
  const validaAte = addDays(parseISO(emitidaEm), dias)
  const diasRestantes = differenceInCalendarDays(validaAte, agora)
  return {
    estado: diasRestantes >= 0 ? "valida" : "vencida",
    validaAte: format(validaAte, "yyyy-MM-dd"),
    diasRestantes,
  }
}

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
)

/** O que o farmacêutico precisa resolver antes de aprovar a receita. Vazio: pode dispensar. */
export function conferirReceita(receita: Receita, produtos: Produto[], agora: Date): string[] {
  const pendencias: string[] = []

  const situacao = situacaoDaReceita(receita.tipo, receita.emitidaEm, agora)
  if (situacao.estado === "vencida") {
    pendencias.push(`Receita vencida em ${format(parseISO(situacao.validaAte), "dd/MM/yyyy")}.`)
  }

  for (const item of receita.itens) {
    const produto = produtos.find((candidato) => candidato.id === item.produtoId)
    const exigida = produto?.medicamento ? receitaExigida(produto.medicamento) : null
    // A receita simples serve para qualquer tarja vermelha; os controlados pedem o próprio papel.
    if (produto && exigida && exigida !== "simples" && exigida !== receita.tipo) {
      pendencias.push(`${produto.nome} exige ${INFO_RECEITA[exigida].nome}.`)
    }
  }

  const { conselho, numero, uf } = receita.prescritor
  if (!/^\d{4,7}$/.test(numero) || !UFS.has(uf)) {
    pendencias.push(`Confira o registro do prescritor (${conselho} ${numero}/${uf}).`)
  }

  return pendencias
}

export type ValidadeLote = "vencido" | "vence-em-30" | "vence-em-90" | "em-dia"

/** Validade do lote (vale até o fim do dia escrito) e se está na hora de repor. */
export function situacaoDoLote(lote: Lote, agora: Date) {
  const dias = differenceInCalendarDays(parseISO(lote.validade), agora)
  const validade: ValidadeLote =
    dias < 0 ? "vencido" : dias <= 30 ? "vence-em-30" : dias <= 90 ? "vence-em-90" : "em-dia"
  return { validade, dias, estoqueBaixo: lote.quantidade <= lote.minimo }
}

/** Saldo de cada controlado pela escrituração: entradas menos saídas e perdas. */
export function saldosControlados(movimentos: MovimentoControlado[]): Record<string, number> {
  const saldos: Record<string, number> = {}
  for (const { produtoId, tipo, quantidade } of movimentos) {
    saldos[produtoId] = (saldos[produtoId] ?? 0) + (tipo === "entrada" ? quantidade : -quantidade)
  }
  return saldos
}

/** Saídas que a dispensação da receita lança na escrituração (só itens de lista). */
export function saidasDaReceita(
  receita: Receita,
  produtos: Produto[],
  em: string,
): MovimentoControlado[] {
  const { conselho, numero, uf } = receita.prescritor
  return receita.itens.flatMap((item) => {
    const produto = produtos.find((candidato) => candidato.id === item.produtoId)
    if (!produto?.medicamento?.lista) return []
    return [
      {
        id: `${receita.id}-${item.produtoId}`,
        produtoId: item.produtoId,
        em,
        tipo: "saida" as const,
        quantidade: item.quantidade,
        documento: `${INFO_RECEITA[receita.tipo].nome} ${receita.id}`,
        paciente: receita.paciente.nome,
        prescritor: `${conselho} ${numero}/${uf}`,
      },
    ]
  })
}
