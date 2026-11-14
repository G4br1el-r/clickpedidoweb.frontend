import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { patternFormatter } from "react-number-format"
import { emReais } from "@/lib/formato"
import type { EnderecoEntrega, Pedido } from "../dados/tipos"
import { rotuloStatus } from "./status"

/** Dinheiro em mensagem de texto: espaço comum, que o WhatsApp não quebra de forma estranha. */
export const reaisEmTexto = (valor: number) => emReais(valor).replace(/ /g, " ")
const reais = reaisEmTexto

export function formatarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "")
  const formato = digitos.length > 10 ? "(##) #####-####" : "(##) ####-####"
  return patternFormatter(digitos, { format: formato })
}

/** Link que abre a conversa no WhatsApp já com o texto. */
export function linkWhatsApp(telefone: string, texto: string): string {
  const digitos = telefone.replace(/\D/g, "")
  const numero = digitos.length > 11 ? digitos : `55${digitos}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

export const enderecoEmTexto = (endereco: EnderecoEntrega) =>
  `${endereco.logradouro}, ${endereco.numero}${endereco.complemento ? ` (${endereco.complemento})` : ""} - ${endereco.bairro}, ${endereco.cidade}`

export const linkDoMapa = (endereco: EnderecoEntrega) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoEmTexto(endereco))}`

/** Aviso ao cliente: em que etapa está o pedido e onde acompanhar. */
export function mensagemParaCliente(
  pedido: Pedido,
  { loja, endereco }: { loja: string; endereco: string },
) {
  const nome = pedido.cliente.nome.split(" ")[0]
  const oQue = pedido.tipo === "atendimento" ? "agendamento" : "pedido"
  // Agendamento ainda por vir: o que importa para a cliente é o dia e a hora.
  const situacao =
    pedido.agendamento && pedido.status === "recebido"
      ? ` está marcado para ${format(new Date(pedido.agendamento.inicio), "EEEE, dd/MM, 'às' HH:mm", { locale: ptBR })}`
      : `: ${rotuloStatus(pedido.tipo, pedido.status)}`
  return (
    `Olá, ${nome}! Seu ${oQue} #${pedido.numero} na ${loja}${situacao}.\n` +
    `Acompanhe por aqui: ${endereco}/pedido/${pedido.token}`
  )
}

function cobranca(pedido: Pedido) {
  if (pedido.situacaoPagamento === "pago") return "Já pago online. Não cobrar."
  if (pedido.pagamento === "dinheiro") {
    const troco = pedido.trocoPara ? pedido.trocoPara - pedido.total : 0
    return `Cobrar ${reais(pedido.total)} em dinheiro${troco > 0 ? ` · levar ${reais(troco)} de troco` : ""}`
  }
  return `Cobrar ${reais(pedido.total)} na maquininha`
}

/** O que o motoboy precisa: cliente, endereço, quanto cobrar e o mapa. */
export function mensagemParaMotoboy(pedido: Pedido, { loja }: { loja: string }) {
  const linhas = [
    `*${loja}* · pedido #${pedido.numero}`,
    `Cliente: ${pedido.cliente.nome} · ${formatarTelefone(pedido.cliente.telefone)}`,
  ]
  if (pedido.endereco) {
    linhas.push(`Endereço: ${enderecoEmTexto(pedido.endereco)}`)
    if (pedido.endereco.referencia) linhas.push(`Referência: ${pedido.endereco.referencia}`)
  }
  linhas.push(cobranca(pedido))
  if (pedido.endereco) linhas.push(`Mapa: ${linkDoMapa(pedido.endereco)}`)
  return linhas.join("\n")
}
