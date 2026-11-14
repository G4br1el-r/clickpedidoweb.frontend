import { create } from "zustand"
import { persist } from "zustand/middleware"
import { cardapioCasaDaPizza, casaDaPizza } from "./mock/casa-da-pizza"
import { cardapioDrogariaBemEstar, drogariaBemEstar } from "./mock/drogaria-bem-estar"
import { vitrineAcougue, vitrineAdega, vitrineQuiosque, vitrineSalao } from "./mock/vitrines"
import { variaveisClaras, variaveisEscuras } from "./tema"
import type { Categoria, Loja } from "./tipos"

type Vitrine = { loja: Loja; categorias: Categoria[] }

/** Lojas da demonstração: a vitrine é a mesma, o que muda é a loja escolhida no topo. */
export const LOJAS = [
  { loja: casaDaPizza as Loja, categorias: cardapioCasaDaPizza as Categoria[] },
  { loja: drogariaBemEstar as Loja, categorias: cardapioDrogariaBemEstar as Categoria[] },
  vitrineAdega as Vitrine,
  vitrineAcougue as Vitrine,
  vitrineSalao as Vitrine,
  vitrineQuiosque as Vitrine,
] as const

export type LojaId =
  | "casa-da-pizza"
  | "drogaria-bem-estar"
  | "adega-da-vila"
  | "acougue-sabor-da-carne"
  | "emporio-das-deusas"
  | "quiosque-do-mineiro"

const PADRAO: LojaId = "casa-da-pizza"
const CHAVE = "clickpedido-loja"

export function ehLojaId(id: unknown): id is LojaId {
  return LOJAS.some(({ loja }) => loja.id === id)
}

const daLoja = (id: LojaId) => LOJAS.find(({ loja }) => loja.id === id) ?? LOJAS[0]

type EstadoLoja = {
  id: LojaId
  hidratada: boolean
  escolher: (id: LojaId) => void
}

/** Loja que a vitrine mostra. Fica salva neste navegador. */
export const useLojaAtual = create<EstadoLoja>()(
  persist(
    (set) => ({
      id: PADRAO,
      hidratada: false,
      escolher: (id) => set({ id }),
    }),
    {
      name: CHAVE,
      version: 1,
      // Hidrata depois da primeira pintura, para o HTML do servidor bater com o do cliente.
      skipHydration: true,
      partialize: ({ id }) => ({ id }),
      merge: (salvo, atual) => {
        const id = (salvo as { id?: unknown } | undefined)?.id
        return { ...atual, id: ehLojaId(id) ? id : PADRAO }
      },
      onRehydrateStorage: () => () => useLojaAtual.setState({ hidratada: true }),
    },
  ),
)

/** A loja escolhida, para código fora do React (checkout, pedido). */
export function lojaAtual(): Loja {
  return daLoja(useLojaAtual.getState().id).loja
}

/** A loja escolhida, num componente: troca junto com o seletor. */
export function useLoja(): Loja {
  return daLoja(useLojaAtual((estado) => estado.id)).loja
}

/** Simula uma API para exercitar os estados de carregamento das telas. */
export async function buscarCardapio(id: LojaId): Promise<Categoria[]> {
  await new Promise((resolver) => setTimeout(resolver, 450))
  return daLoja(id).categorias
}

const emBloco = (variaveis: Record<string, string>) =>
  Object.entries(variaveis)
    .map(([nome, valor]) => `${nome}:${valor};`)
    .join("")

/**
 * Cores das outras lojas, presas a `data-loja` na raiz. A padrão (pizzaria) já vem do layout;
 * as outras vencem por serem mais específicas.
 */
export function cssDasLojas(): string {
  return LOJAS.filter(({ loja }) => loja.id !== PADRAO)
    .map(
      ({ loja }) =>
        `:root[data-loja="${loja.id}"]{${emBloco(variaveisClaras(loja.tema))}}` +
        `:root.dark[data-loja="${loja.id}"]{${emBloco(variaveisEscuras(loja.tema))}}`,
    )
    .join("")
}

/**
 * Roda antes da primeira pintura: marca a loja salva na raiz, para a página já nascer nas
 * cores dela. O painel (/admin) tem as cores próprias e fica de fora.
 */
export const SCRIPT_LOJA = `try{if(!location.pathname.startsWith("/admin")){var s=JSON.parse(localStorage.getItem("${CHAVE}")||"{}");var id=s&&s.state&&s.state.id;if(id&&id!=="${PADRAO}"&&${JSON.stringify(LOJAS.map(({ loja }) => loja.id))}.indexOf(id)>=0)document.documentElement.dataset.loja=id}}catch(e){}`
