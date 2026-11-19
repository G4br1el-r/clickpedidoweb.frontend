import { emReais, plural } from "../../../formato"
import type { ConfigLoja, Lote, Pedido, Produto, Receita, StatusPedido } from "../../dados/tipos"
import type { SegmentoPainelId } from "../../segmentos-painel"
import { urgenciaNaCozinha } from "../cozinha"
import { situacaoEstoque } from "../estoque"
import { situacaoDoLote } from "../farmacia"
import { urgencia } from "../fila"
import { lojaAbertaAgora } from "../loja"
import { faltaPesar } from "../pesagem"
import { reais } from "./comum"
import type { SituacaoMeta } from "./metas"
import { nomesDo } from "./nomes"

export type AlertaId =
  | "atrasados"
  | "pagamento-pendente"
  | "estoque-zerado"
  | "estoque-baixo"
  | "lotes"
  | "receitas"
  | "pesagem"
  | "meta-em-risco"
  | "loja-fechada"

/** Pagamento online esperando além disso vira alerta. */
export const MINUTOS_PAGAMENTO_PENDENTE = 15

export type Alerta = { id: AlertaId; texto: string; acao: { rotulo: string; href: string } }

export type EntradaAlertas = {
  segmento: SegmentoPainelId
  agora: Date
  pedidos: Pedido[]
  produtos: Produto[]
  loja: ConfigLoja
  lotes: Lote[]
  receitas: Receita[]
  /** Receitas que o farmacêutico já decidiu; as outras esperam conferência. */
  decisoes: Record<string, unknown>
  meta: SituacaoMeta | null
}

const EM_ANDAMENTO: readonly StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

/** Ainda sendo preparado na cozinha (o atendimento do salão não passa por lá). */
const naCozinha = (pedido: Pedido) =>
  pedido.enviarParaCozinha &&
  pedido.tipo !== "atendimento" &&
  (pedido.status === "recebido" || pedido.status === "em-preparo")

/** O que precisa de atenção agora, na ordem em que aparece na faixa. Vazio: nada a avisar. */
export function alertasDoPainel({
  segmento,
  agora,
  pedidos,
  produtos,
  loja,
  lotes,
  receitas,
  decisoes,
  meta,
}: EntradaAlertas): Alerta[] {
  const n = nomesDo(segmento)
  const alertas: Alerta[] = []

  const atrasados = pedidos.filter(
    (pedido) =>
      EM_ANDAMENTO.includes(pedido.status) &&
      (urgencia(pedido, agora) === "atrasado" ||
        (naCozinha(pedido) && urgenciaNaCozinha(pedido, agora) === "atrasado")),
  ).length
  if (atrasados > 0)
    alertas.push({
      id: "atrasados",
      texto: `${plural(atrasados, n.pedido, n.pedidos)} ${atrasados === 1 ? "atrasado" : "atrasados"}`,
      acao: { rotulo: "Abrir a fila", href: "/admin/fila" },
    })

  const limitePagamento = agora.getTime() - MINUTOS_PAGAMENTO_PENDENTE * 60_000
  const pendentes = pedidos.filter(
    (pedido) =>
      pedido.status === "aguardando-pagamento" && Date.parse(pedido.criadoEm) < limitePagamento,
  ).length
  if (pendentes > 0)
    alertas.push({
      id: "pagamento-pendente",
      texto: `${plural(pendentes, "pagamento online pendente", "pagamentos online pendentes")} há mais de ${MINUTOS_PAGAMENTO_PENDENTE} min`,
      acao: { rotulo: "Ver pedidos", href: "/admin/pedidos?status=aguardando-pagamento" },
    })

  const situacoes = produtos.flatMap((produto) =>
    produto.estoque?.controlar ? [situacaoEstoque(produto.estoque)] : [],
  )
  const zerados = situacoes.filter((situacao) => situacao === "zerado" || situacao === "negativo")
  const baixos = situacoes.filter((situacao) => situacao === "baixo")
  const verEstoque = { rotulo: "Ver estoque", href: "/admin/estoque" }
  if (zerados.length > 0)
    alertas.push({
      id: "estoque-zerado",
      texto: `${plural(zerados.length, "produto zerado", "produtos zerados")} no estoque`,
      acao: verEstoque,
    })
  if (baixos.length > 0)
    alertas.push({
      id: "estoque-baixo",
      texto: `${plural(baixos.length, "produto", "produtos")} com estoque baixo`,
      acao: verEstoque,
    })

  const lotesEmRisco = lotes.filter((lote) => {
    const { validade } = situacaoDoLote(lote, agora)
    return lote.quantidade > 0 && (validade === "vencido" || validade === "vence-em-30")
  }).length
  if (lotesEmRisco > 0)
    alertas.push({
      id: "lotes",
      texto: `${plural(lotesEmRisco, "lote vencido ou vencendo", "lotes vencidos ou vencendo")} em 30 dias`,
      acao: { rotulo: "Ver lotes", href: "/admin/validade" },
    })

  const aConferir = receitas.filter((receita) => !(receita.id in decisoes)).length
  if (aConferir > 0)
    alertas.push({
      id: "receitas",
      texto: `${plural(aConferir, "receita esperando", "receitas esperando")} conferência`,
      acao: { rotulo: "Conferir receitas", href: "/admin/receitas" },
    })

  const aPesar = pedidos.filter(
    (pedido) =>
      pedido.status !== "cancelado" && pedido.status !== "concluido" && faltaPesar(pedido),
  ).length
  if (aPesar > 0)
    alertas.push({
      id: "pesagem",
      texto: `${plural(aPesar, n.pedido, n.pedidos)} esperando pesagem`,
      acao: { rotulo: "Abrir a fila", href: "/admin/fila" },
    })

  const peloHorario = lojaAbertaAgora({ ...loja, controleAutomatico: true }, agora)
  if (peloHorario && !lojaAbertaAgora(loja, agora))
    alertas.push({
      id: "loja-fechada",
      texto: "A loja está fechada no horário de funcionamento",
      acao: { rotulo: "Configurações da loja", href: "/admin/loja" },
    })

  if (meta?.emRisco)
    alertas.push({
      id: "meta-em-risco",
      texto: `A meta de hoje está em risco: faltam ${emReais(reais(meta.hoje.meta - meta.hoje.realizado))}`,
      acao: { rotulo: "Ver a meta", href: "#meta" },
    })

  return alertas
}
