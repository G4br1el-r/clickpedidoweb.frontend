import type { StaticImageData } from "next/image"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { DadosCheckout, FormaPagamento } from "./checkout"
import type { ModoVenda } from "./farmacia"

export type ItemSacola = {
  chave: string
  produtoId: string
  nome: string
  imagem: StaticImageData
  precoUnitario: number
  quantidade: number
  resumo: string[]
  observacao?: string
  /** Farmácia: o remédio pede receita (ver lib/farmacia.ts). Sem o campo, venda livre. */
  venda?: ModoVenda
}

export type Pedido = {
  numero: number
  itens: ItemSacola[]
  subtotal: number
  taxaEntrega: number
  total: number
  /** Os campos abaixo vêm do checkout; pedidos salvos antes dele não os têm. */
  criadoEm?: number
  cliente?: { nome: string; whatsapp: string }
  tipo?: "entrega" | "retirada"
  endereco?: string
  pagamento?: FormaPagamento
  troco?: number | null
  observacao?: string
  /** Farmácia: a foto da receita enviada no fechamento e se a via fica retida na entrega. */
  receita?: { arquivo: string; retida: boolean }
}

export type DadosFinalizacao = Required<
  Pick<
    Pedido,
    "taxaEntrega" | "cliente" | "tipo" | "endereco" | "pagamento" | "troco" | "observacao"
  >
>

/** O que a pessoa preencheu da última vez, para não digitar tudo de novo. */
export type DadosLembrados = Omit<DadosCheckout, "cpf" | "troco" | "observacao" | "total">

type NovoItem = Omit<ItemSacola, "chave">

const LIMITE_HISTORICO = 10

/**
 * O número do pedido vem do relógio e se repete a cada 9 s. Para `verPedido` e a busca por
 * celular não confundirem dois pedidos, anda até o próximo número de 4 dígitos que ninguém usa.
 */
function numeroLivre(sugerido: number, usados: Set<number>): number {
  let numero = sugerido
  while (usados.has(numero)) numero = numero === 9999 ? 1000 : numero + 1
  return numero
}

type EstadoSacola = {
  itens: ItemSacola[]
  /** O pedido mostrado na tela de acompanhamento (o último feito ou o escolhido na busca). */
  ultimoPedido: Pedido | null
  /** Os últimos pedidos feitos neste aparelho, do mais novo para o mais antigo. */
  pedidos: Pedido[]
  dadosLembrados: DadosLembrados | null
  hidratada: boolean
  adicionar: (item: NovoItem) => void
  alterarQuantidade: (chave: string, quantidade: number) => void
  remover: (chave: string) => void
  restaurar: (item: ItemSacola, posicao: number) => void
  /** Tira todos os itens (ao trocar de loja). Os pedidos feitos continuam no histórico. */
  esvaziar: () => void
  finalizar: (dados: DadosFinalizacao & Pick<Pedido, "receita">, lembrar: DadosLembrados) => Pedido
  /** Põe um pedido do histórico na tela de acompanhamento. */
  verPedido: (numero: number) => void
}

function criarChave(item: NovoItem): string {
  return [item.produtoId, ...item.resumo, item.observacao ?? ""].join("|")
}

export function totalDoItem(item: ItemSacola): number {
  return item.precoUnitario * item.quantidade
}

export function calcularSubtotal(itens: ItemSacola[]): number {
  return itens.reduce((soma, item) => soma + totalDoItem(item), 0)
}

/** Quanto falta nos itens para a loja aceitar o pedido. */
export function faltaParaMinimo(subtotal: number, pedidoMinimo: number): number {
  return Math.max(0, pedidoMinimo - subtotal)
}

export function contarItens(itens: ItemSacola[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0)
}

export const useSacola = create<EstadoSacola>()(
  persist(
    (set, get) => ({
      itens: [],
      ultimoPedido: null,
      pedidos: [],
      dadosLembrados: null,
      hidratada: false,
      adicionar: (novo) => {
        const chave = criarChave(novo)
        set(({ itens }) => {
          const existente = itens.find((item) => item.chave === chave)
          if (existente) {
            return {
              itens: itens.map((item) =>
                item.chave === chave
                  ? { ...item, quantidade: item.quantidade + novo.quantidade }
                  : item,
              ),
            }
          }
          return { itens: [...itens, { ...novo, chave }] }
        })
      },
      alterarQuantidade: (chave, quantidade) => {
        // Tirar o item é com `remover`, que a interface oferece com desfazer.
        if (quantidade < 1) return
        set(({ itens }) => ({
          itens: itens.map((item) => (item.chave === chave ? { ...item, quantidade } : item)),
        }))
      },
      remover: (chave) => {
        set(({ itens }) => ({ itens: itens.filter((item) => item.chave !== chave) }))
      },
      restaurar: (item, posicao) => {
        set(({ itens }) => {
          const copia = [...itens]
          copia.splice(posicao, 0, item)
          return { itens: copia }
        })
      },
      esvaziar: () => set({ itens: [] }),
      finalizar: (dados, lembrar) => {
        const { itens, pedidos, ultimoPedido } = get()
        const subtotal = calcularSubtotal(itens)
        const usados = new Set(
          [...pedidos, ...(ultimoPedido ? [ultimoPedido] : [])].map(({ numero }) => numero),
        )
        const pedido: Pedido = {
          ...dados,
          numero: numeroLivre(1000 + (Date.now() % 9000), usados),
          itens,
          subtotal,
          total: subtotal + dados.taxaEntrega,
          criadoEm: Date.now(),
        }
        set(({ pedidos }) => ({
          itens: [],
          ultimoPedido: pedido,
          pedidos: [pedido, ...pedidos].slice(0, LIMITE_HISTORICO),
          dadosLembrados: lembrar,
        }))
        return pedido
      },
      verPedido: (numero) => {
        const pedido = get().pedidos.find((item) => item.numero === numero)
        if (pedido) set({ ultimoPedido: pedido })
      },
    }),
    {
      name: "clickpedido-sacola",
      skipHydration: true,
      partialize: ({ itens, ultimoPedido, pedidos, dadosLembrados }) => ({
        itens,
        ultimoPedido,
        pedidos,
        dadosLembrados,
      }),
      onRehydrateStorage: () => () => {
        useSacola.setState({ hidratada: true })
      },
    },
  ),
)

const soDigitos = (texto: string) => texto.replace(/\D/g, "")

/**
 * Pedidos feitos com este celular, do mais novo para o mais antigo. Inclui o último pedido
 * salvo antes de existir o histórico.
 */
export function pedidosDoCelular(celular: string): Pedido[] {
  const alvo = soDigitos(celular)
  const { pedidos, ultimoPedido } = useSacola.getState()
  const todos =
    ultimoPedido && !pedidos.some((pedido) => pedido.numero === ultimoPedido.numero)
      ? [ultimoPedido, ...pedidos]
      : pedidos
  return todos.filter((pedido) => soDigitos(pedido.cliente?.whatsapp ?? "") === alvo)
}
