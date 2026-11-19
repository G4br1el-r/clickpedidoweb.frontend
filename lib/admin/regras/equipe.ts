/**
 * Perfis da equipe: o que cada um vê no painel e quando precisa do PIN de um
 * gerente (ver docs/plano-pdv.md, "Equipe e acesso").
 */

import type { MembroEquipe, PerfilAcesso } from "@/lib/admin/dados/tipos"
import type { ModuloId } from "@/lib/admin/segmentos-painel"

export const TITULO_PERFIL: Record<PerfilAcesso, string> = {
  dono: "Dono",
  gerente: "Gerente",
  caixa: "Caixa",
}

/** Ações que o Caixa só faz com o PIN de um gerente ou do dono. */
export type AcaoSensivel = "sangria" | "reabrir-caixa"

/** Seções da tela da loja que só o dono vê. */
export type SecaoLojaRestrita = "pagamentos" | "pagamento-online"

const MODULOS_DO_CAIXA: readonly ModuloId[] = ["pdv", "pedidos", "fila"]

export function podeVerModulo(perfil: PerfilAcesso, modulo: ModuloId): boolean {
  if (perfil === "caixa") return MODULOS_DO_CAIXA.includes(modulo)
  if (perfil === "gerente") return modulo !== "equipe"
  return true
}

/** Configurações de aparência da vitrine. */
export function podeVerAparencia(perfil: PerfilAcesso): boolean {
  return perfil !== "caixa"
}

export function podeVerSecaoLoja(perfil: PerfilAcesso, _secao: SecaoLojaRestrita): boolean {
  return perfil === "dono"
}

export function precisaAutorizacao(perfil: PerfilAcesso, _acao: AcaoSensivel): boolean {
  return perfil === "caixa"
}

export function podeAutorizar(membro: MembroEquipe): boolean {
  return membro.ativo && membro.perfil !== "caixa"
}

export function errosDoPin(pin: string): string | undefined {
  return /^\d{4,6}$/.test(pin) ? undefined : "O PIN tem de 4 a 6 números."
}

/** Confere uma pessoa nova ou editada contra o resto da equipe. */
export function errosDoMembro(
  dados: Omit<MembroEquipe, "id"> & { id?: string },
  equipe: MembroEquipe[],
): string | undefined {
  const nome = dados.nome.trim()
  if (nome.length < 2 || nome.length > 40) return "Diga o nome (2 a 40 letras)."
  const erroPin = errosDoPin(dados.pin)
  if (erroPin) return erroPin
  const depois = [...equipe.filter((membro) => membro.id !== dados.id), dados]
  if (!depois.some((membro) => membro.perfil === "dono" && membro.ativo)) {
    return "O painel precisa de um Dono ativo."
  }
  return undefined
}

/** Quem o painel usa quando ninguém entrou: o primeiro Dono ativo. */
export function membroPadrao(equipe: MembroEquipe[]): MembroEquipe | undefined {
  return equipe.find((membro) => membro.perfil === "dono" && membro.ativo)
}
