import { isSameDay } from "date-fns"
import type { ItemPedido, MotivoRefazer, Pedido, Refacao } from "../dados/tipos"
import type { TicketCozinha } from "./cozinha"

/** O nome de cada motivo, na janela e na marca do ticket. */
export const NOME_DO_MOTIVO: Record<MotivoRefazer, string> = {
  errado: "Errado",
  caiu: "Caiu",
  reclamacao: "Reclamação",
  outro: "Outro",
}

/** O que a pessoa escolheu na janela de refazer. */
export type PedidoDeRefazer = {
  rodada: number
  itens: { itemId: string; quantidade: number }[]
  motivo: MotivoRefazer
  texto?: string
}

/** A cópia do item para refazer: os mesmos dados, sem os horários da primeira vez. */
function copia(item: ItemPedido, quantidade: number, numero: number, rodada: number): ItemPedido {
  const {
    lancadoEm: _lancado,
    iniciadoEm: _iniciado,
    feitoEm: _feito,
    servidoEm: _servido,
    agendadoPara: _agendado,
    vaiParaCozinha: _cozinha,
    ...dados
  } = item
  return {
    ...dados,
    id: `${item.id}~r${numero}`,
    quantidade,
    total: item.precoUnitario * quantidade,
    rodada,
  }
}

/**
 * A cozinha refaz parte de uma rodada: as cópias dos itens escolhidos ficam à parte, em
 * `refacoes`, e viram um ticket. Os itens, o total e o status do pedido não mudam.
 */
export function refazer(pedido: Pedido, entrada: PedidoDeRefazer, agora: Date): Pedido {
  if (pedido.status === "cancelado") throw new Error("Pedido cancelado não pode ser refeito.")
  const daRodada = pedido.itens.filter(
    (item) =>
      (item.vaiParaCozinha ?? pedido.enviarParaCozinha) && (item.rodada ?? 1) === entrada.rodada,
  )
  if (daRodada.length === 0) throw new Error("Esta rodada não passou pela cozinha.")
  const chegou = daRodada.find((item) => item.lancadoEm)?.lancadoEm ?? pedido.criadoEm
  if (!isSameDay(new Date(chegou), agora)) throw new Error("Só dá para refazer pedidos de hoje.")
  if (!daRodada.every((item) => item.feitoEm)) {
    throw new Error("Este ticket ainda está na cozinha: use voltar ou desriscar.")
  }
  const escolhidos = entrada.itens.filter((escolha) => escolha.quantidade > 0)
  if (escolhidos.length === 0) throw new Error("Escolha ao menos um item.")
  const texto = entrada.texto?.trim()
  if (texto && texto.length > 60) throw new Error("Explique em até 60 letras.")
  const numero = (pedido.refacoes?.length ?? 0) + 1
  const itens = escolhidos.map(({ itemId, quantidade }) => {
    const original = daRodada.find((item) => item.id === itemId)
    if (!original) throw new Error("Este item não é desta rodada.")
    if (quantidade > original.quantidade) {
      throw new Error(`${original.nome}: refaça no máximo ${original.quantidade}.`)
    }
    return copia(original, quantidade, numero, entrada.rodada)
  })
  const refacao: Refacao = {
    numero,
    rodada: entrada.rodada,
    motivo: entrada.motivo,
    ...(texto ? { texto } : {}),
    em: agora.toISOString(),
    itens,
  }
  return { ...pedido, refacoes: [...(pedido.refacoes ?? []), refacao] }
}

/**
 * Entrega e retirada: a cozinha entregou o que refez. O ticket sai do quadro; o pedido não
 * muda.
 */
export function entregarRefazer(pedido: Pedido, numero: number, agora: string): Pedido {
  const refacao = pedido.refacoes?.find((outra) => outra.numero === numero)
  if (!refacao) throw new Error("Refazer não encontrado.")
  if (!refacao.itens.every((item) => item.feitoEm)) {
    throw new Error("Este refazer ainda não está pronto.")
  }
  return {
    ...pedido,
    refacoes: pedido.refacoes?.map((outra) =>
      outra.numero === numero ? { ...outra, entregueEm: outra.entregueEm ?? agora } : outra,
    ),
  }
}

/**
 * O ticket aceita refazer: é de hoje, já ficou pronto, o pedido não foi cancelado e ele
 * mesmo não é um refazer. A janela só aparece nesse caso; o servidor confere de novo.
 */
export function podeRefazer(ticket: TicketCozinha, agora: Date): boolean {
  return (
    !ticket.refazer &&
    ticket.status === "pronto" &&
    ticket.pedido.status !== "cancelado" &&
    isSameDay(new Date(ticket.chegouEm), agora)
  )
}
