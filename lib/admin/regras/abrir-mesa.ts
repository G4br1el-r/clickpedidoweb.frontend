import { plural } from "../../formato"
import { normalizar } from "./filtro-pedidos"

export type ErrosAbertura = { pessoas?: string; garcom?: string }

/**
 * Confere o formulário "Abrir mesa" antes de ir ao servidor (Q6, Q17): de 1 a 99 pessoas e,
 * com garçons no salão, um deles escolhido. Mais pessoas que lugares só gera o aviso.
 */
export function conferirAbertura({
  mesa,
  pessoas: digitado,
  garcom,
  garcons,
}: {
  mesa: { numero: number; lugares: number }
  pessoas: string
  garcom: string | null
  /** Os nomes dos garçons ativos do salão. */
  garcons: string[]
}): { erros: ErrosAbertura; pessoas?: number; aviso?: string } {
  const quantas = Number(digitado)
  const valida =
    digitado.trim() !== "" && Number.isInteger(quantas) && quantas >= 1 && quantas <= 99
  const erros: ErrosAbertura = {
    ...(valida ? {} : { pessoas: "Informe de 1 a 99 pessoas." }),
    ...(garcons.length > 0 && !garcom ? { garcom: "Escolha o garçom." } : {}),
  }
  if (!valida) return { erros }
  return {
    erros,
    pessoas: quantas,
    ...(quantas > mesa.lugares
      ? { aviso: `A mesa ${mesa.numero} tem ${plural(mesa.lugares, "lugar", "lugares")}.` }
      : {}),
  }
}

/** O nome guardado neste aparelho, como está na lista do salão; fora dela, nenhum. */
export function garcomDoAparelho(garcons: string[], nome: string): string | null {
  if (!nome.trim()) return null
  return garcons.find((garcom) => normalizar(garcom) === normalizar(nome.trim())) ?? null
}
