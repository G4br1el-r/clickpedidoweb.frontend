import type { Motoboy, Pedido } from "../dados/tipos"
import { normalizar } from "./filtro-pedidos"

export type SituacaoMotoboy = {
  motoboy: Motoboy
  situacao: "disponivel" | "em-rota" | "ausente"
  /** As entregas que ele levou e ainda não voltou. */
  emRota: Pedido[]
  /** Quando voltou da última entrega; `null` se ainda não saiu (livre desde a abertura). */
  livreDesde: string | null
}

const naRua = (pedido: Pedido) => pedido.tipo === "entrega" && pedido.status === "saiu-para-entrega"
const entregue = (pedido: Pedido) => pedido.tipo === "entrega" && pedido.status === "concluido"

/**
 * A situação de cada motoboy, derivada dos pedidos: em rota com as entregas na rua,
 * disponível (desde a última entrega concluída) ou ausente (desligado no cadastro).
 */
export function situacaoDosMotoboys(motoboys: Motoboy[], pedidos: Pedido[]): SituacaoMotoboy[] {
  return motoboys.map((motoboy) => {
    const dele = pedidos.filter((pedido) => pedido.motoboyId === motoboy.id)
    const emRota = dele.filter(naRua)
    const ultimaVolta = dele
      .filter(entregue)
      .map((pedido) => pedido.atualizadoEm)
      .sort()
      .at(-1)
    return {
      motoboy,
      situacao: !motoboy.ativo ? "ausente" : emRota.length > 0 ? "em-rota" : "disponivel",
      emRota,
      livreDesde: ultimaVolta ?? null,
    }
  })
}

/** Quem chamar: o disponível livre há mais tempo (quem ainda não saiu hoje vem antes). */
export function motoboySugerido(situacoes: SituacaoMotoboy[]): Motoboy | null {
  const livres = situacoes.filter((item) => item.situacao === "disponivel")
  livres.sort((a, b) => (a.livreDesde ?? "").localeCompare(b.livreDesde ?? ""))
  return livres[0]?.motoboy ?? null
}

const prontaParaSair = (pedido: Pedido) =>
  pedido.tipo === "entrega" && pedido.status === "pronto" && !pedido.esperaAceite

/** As outras entregas prontas do mesmo bairro: dá para levar junto, numa rota só. */
export function entregasParaAgrupar(pedido: Pedido, fila: Pedido[]): Pedido[] {
  const bairro = pedido.endereco && normalizar(pedido.endereco.bairro).trim()
  if (!bairro) return []
  return fila.filter(
    (outro) =>
      outro.id !== pedido.id &&
      prontaParaSair(outro) &&
      outro.endereco !== undefined &&
      normalizar(outro.endereco.bairro).trim() === bairro,
  )
}
