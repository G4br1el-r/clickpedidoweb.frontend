import { create } from "zustand"
import type { TelaPrevia } from "@/lib/admin/secoes"

export type Dispositivo = "celular" | "computador"
export type Demonstracao = "adicionar" | "hover"

/**
 * O que a pessoa está editando agora, para a prévia mostrar onde fica. `alvo` casa com o
 * `data-alvo` do pedaço da prévia (ex.: "bloco:promocional"); o resto é o texto do aviso.
 */
export type FocoPrevia = {
  alvo: string
  secao: string
  rotulo: string
  /** O item está desligado: não aparece na prévia nem na loja. */
  desligado?: boolean
}

type EstadoPrevia = {
  tela: TelaPrevia
  dispositivo: Dispositivo
  /** `null` segue o tema padrão da loja ou do painel. */
  escuro: boolean | null
  /** Muda para tocar de novo as animações de entrada. */
  rodada: number
  /** Itens "adicionados" na prévia: só para o efeito e o contador, sem tocar na sacola real. */
  adicionados: number
  /** Efeito tocado sozinho na prévia, para mostrar uma animação logo depois de escolhê-la. */
  demo: { tipo: Demonstracao; vez: number } | null
  /** Painel lateral com a prévia, usado quando ela não cabe ao lado das configurações. */
  folhaAberta: boolean
  foco: FocoPrevia | null
  focar: (foco: FocoPrevia) => void
  /** Tira o foco, se ainda for este item (o mouse pode já ter passado para outro). */
  soltar: (alvo: string) => void
  definirTela: (tela: TelaPrevia) => void
  definirDispositivo: (dispositivo: Dispositivo) => void
  definirEscuro: (escuro: boolean) => void
  repetir: () => void
  adicionar: () => void
  demonstrar: (tipo: Demonstracao) => void
  abrirFolha: (aberta: boolean) => void
}

export const usePrevia = create<EstadoPrevia>()((set) => ({
  tela: "inicio",
  dispositivo: "celular",
  escuro: null,
  rodada: 0,
  adicionados: 0,
  demo: null,
  folhaAberta: false,
  foco: null,
  focar: (foco) => set({ foco }),
  soltar: (alvo) => set((estado) => (estado.foco?.alvo === alvo ? { foco: null } : estado)),
  definirTela: (tela) =>
    set((estado) => (estado.tela === tela ? estado : { tela, rodada: estado.rodada + 1 })),
  definirDispositivo: (dispositivo) => set({ dispositivo }),
  definirEscuro: (escuro) => set({ escuro }),
  repetir: () => set(({ rodada }) => ({ rodada: rodada + 1 })),
  adicionar: () => set(({ adicionados }) => ({ adicionados: adicionados + 1 })),
  demonstrar: (tipo) => set(({ demo }) => ({ demo: { tipo, vez: (demo?.vez ?? 0) + 1 } })),
  abrirFolha: (folhaAberta) => set({ folhaAberta }),
}))

/** A prévia está à vista? Ao lado nas telas largas, ou aberta no painel lateral. */
export function previaVisivel() {
  if (usePrevia.getState().folhaAberta) return true
  return window.matchMedia("(min-width: 1280px)").matches
}
