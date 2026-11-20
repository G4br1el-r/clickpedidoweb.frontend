import type { Mesa, Pedido } from "../dados/tipos"
import type { AlertaMesa } from "./alertas-mesa"
import { normalizar } from "./filtro-pedidos"
import type { EstadoMesa, estadoDaMesa } from "./mesas"

export type FiltroEstadoMesa = EstadoMesa
export type FiltrosMesas = {
  busca: string
  area: string | null
  estado: FiltroEstadoMesa | null
  garcom: string | null
  atencao: boolean
}
export type OrdemMesas = "numero" | "tempo"
export type MesaNaGrade = {
  mesa: Mesa
  comanda?: Pedido
  estado: ReturnType<typeof estadoDaMesa>
  alertas: AlertaMesa[]
}

function combinaBusca({ mesa }: MesaNaGrade, busca: string) {
  const texto = normalizar(busca).trim()
  if (!texto) return true
  // Só dígitos: busca o número, pelo começo. Com texto: nome da mesa e cliente.
  if (/^[0-9]+$/.test(texto)) return String(mesa.numero).startsWith(texto)
  return normalizar(mesa.nome).includes(texto) || normalizar(mesa.clienteNome ?? "").includes(texto)
}

function combinaGarcom(linha: MesaNaGrade, garcom: string) {
  const doPedido = linha.comanda?.mesa?.garcom
  return doPedido !== undefined && normalizar(doPedido) === normalizar(garcom)
}

const desde = (linha: MesaNaGrade) =>
  linha.mesa.ocupadaEm ? Date.parse(linha.mesa.ocupadaEm) : Number.POSITIVE_INFINITY

function comparar(a: MesaNaGrade, b: MesaNaGrade, ordem: OrdemMesas) {
  // Sem ocupadaEm o desde é infinito: a mesa vai para o fim, e o empate cai no número.
  if (ordem === "tempo" && desde(a) !== desde(b)) return desde(a) < desde(b) ? -1 : 1
  return a.mesa.numero - b.mesa.numero
}

const ESTADOS_OCUPADOS: EstadoMesa[] = ["ocupada", "na-cozinha", "servir", "conta-pedida"]

function combinaEstado(linha: MesaNaGrade, estado: FiltroEstadoMesa | null) {
  if (!estado) return true
  if (estado === "ocupada") return ESTADOS_OCUPADOS.includes(linha.estado.estado)
  return linha.estado.estado === estado
}

/** Aplica busca e filtros (todos juntos, E) e ordena a grade. */
export function filtrarMesas(
  linhas: MesaNaGrade[],
  filtros: FiltrosMesas,
  ordem: OrdemMesas,
): MesaNaGrade[] {
  const filtradas = linhas.filter(
    (linha) =>
      combinaBusca(linha, filtros.busca) &&
      (!filtros.area || linha.mesa.areaId === filtros.area) &&
      combinaEstado(linha, filtros.estado) &&
      (!filtros.garcom || combinaGarcom(linha, filtros.garcom)) &&
      (!filtros.atencao || linha.alertas.length > 0),
  )
  return filtradas.sort((a, b) => comparar(a, b, ordem))
}
