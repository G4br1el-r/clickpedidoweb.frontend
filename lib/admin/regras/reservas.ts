import { set, startOfMinute } from "date-fns"
import type { ConfigSalao, EntradaEspera, Mesa, Reserva } from "../dados/tipos"
import { linkWhatsApp } from "./mensagens"

type ConfigReservas = ConfigSalao["reservas"]

const MINUTO = 60_000

/**
 * A reserva marcada que segura a mesa agora: da antecedência antes do horário até a tolerância
 * depois. Com mais de uma na janela, a mais cedo.
 */
export function reservaDaMesa(
  mesa: Pick<Mesa, "id">,
  reservas: Reserva[],
  agora: Date,
  { antecedenciaMin, toleranciaMin }: ConfigReservas,
): Reserva | undefined {
  const momento = agora.getTime()
  return reservas
    .filter((reserva) => {
      const inicio = Date.parse(reserva.inicio)
      return (
        reserva.mesaId === mesa.id &&
        reserva.status === "marcada" &&
        inicio - antecedenciaMin * MINUTO <= momento &&
        momento <= inicio + toleranciaMin * MINUTO
      )
    })
    .toSorted((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0]
}

/** A marcada que já passou da tolerância não veio: conta como "não compareceu", sem gravar. */
export function statusDaReserva(
  reserva: Reserva,
  agora: Date,
  { toleranciaMin }: Pick<ConfigReservas, "toleranciaMin">,
): Reserva["status"] {
  if (reserva.status !== "marcada") return reserva.status
  const vence = Date.parse(reserva.inicio) + toleranciaMin * MINUTO
  return agora.getTime() > vence ? "nao-compareceu" : "marcada"
}

/** Quanto tempo a mesa fica com a reserva: duas reservas da mesma mesa mais perto que isso conflitam. */
export const DURACAO_RESERVA_MIN = 120

/** Ativa: marcada e ainda dentro da tolerância. Só ela segura a mesa. */
export const reservaAtiva = (
  reserva: Reserva,
  agora: Date,
  config: Pick<ConfigReservas, "toleranciaMin">,
) => statusDaReserva(reserva, agora, config) === "marcada"

/**
 * Outra reserva ativa da mesa a menos de 2 h do horário. `ignorar`: a própria reserva, ao
 * editar ou sentar.
 */
export function reservaEmConflito(
  mesaId: string,
  inicio: Date,
  reservas: Reserva[],
  agora: Date,
  config: ConfigReservas,
  ignorar?: string,
): Reserva | undefined {
  return reservas.find(
    (reserva) =>
      reserva.id !== ignorar &&
      reserva.mesaId === mesaId &&
      reservaAtiva(reserva, agora, config) &&
      Math.abs(Date.parse(reserva.inicio) - inicio.getTime()) < DURACAO_RESERVA_MIN * MINUTO,
  )
}

/** O que a sugestão precisa saber de uma mesa. */
export type MesaParaSugerir = Pick<
  Mesa,
  "id" | "numero" | "lugares" | "status" | "bloqueio" | "juntadaCom" | "limpezaDesde"
>

export type QuandoSugerir = {
  agora: Date
  config: ConfigReservas
  /** O horário da reserva; sem ele, agora (a espera). */
  inicio?: Date
  /** A reserva que está sendo editada. */
  ignorar?: string
}

/**
 * A menor mesa que cabe as pessoas, desempatada pelo número. Pula a bloqueada, a juntada e a
 * que tem outra reserva a menos de 2 h. Para agora (ou dentro da antecedência), a mesa precisa
 * estar livre já: a ocupada e a em limpeza ficam de fora; para mais tarde, elas entram.
 */
export function sugerirMesa<M extends MesaParaSugerir>(
  pessoas: number,
  mesas: M[],
  reservas: Reserva[],
  { agora, config, inicio = agora, ignorar }: QuandoSugerir,
): M | undefined {
  const logo = inicio.getTime() - agora.getTime() <= config.antecedenciaMin * MINUTO
  const livreAgora = (mesa: M) => mesa.status === "livre" && !mesa.limpezaDesde
  return mesas
    .filter(
      (mesa) =>
        mesa.lugares >= pessoas &&
        !mesa.bloqueio &&
        !mesa.juntadaCom &&
        (!logo || livreAgora(mesa)) &&
        !reservaEmConflito(mesa.id, inicio, reservas, agora, config, ignorar),
    )
    .toSorted((a, b) => a.lugares - b.lugares || a.numero - b.numero)[0]
}

/**
 * Por que a mesa não recebe agora quem senta (a reserva ou a espera); nada, se recebe. Recebe a
 * livre, mesmo em limpeza, sem bloqueio e sem estar junto de outra.
 */
export function porQueNaoSenta(
  mesaId: string,
  mesas: Pick<Mesa, "id" | "numero" | "status" | "bloqueio" | "juntadaCom">[],
): string | undefined {
  const mesa = mesas.find((item) => item.id === mesaId)
  if (!mesa) return "A mesa da reserva foi excluída."
  if (mesa.bloqueio) return `A mesa ${mesa.numero} está bloqueada.`
  if (mesa.juntadaCom) {
    const principal = mesas.find((item) => item.id === mesa.juntadaCom)
    return `A mesa ${mesa.numero} está junto com a mesa ${principal?.numero}.`
  }
  if (mesa.status !== "livre") return `A mesa ${mesa.numero} está ocupada.`
  return undefined
}

/**
 * A mesa livre de cada um da espera: na ordem da chegada, cada um fica com a menor que cabe entre
 * as que sobraram. Quem não cabe em nenhuma fica sem.
 */
export function sugestoesDaEspera<M extends MesaParaSugerir>(
  espera: EntradaEspera[],
  mesas: M[],
  reservas: Reserva[],
  quando: QuandoSugerir,
): Map<string, M> {
  const sugestoes = new Map<string, M>()
  let sobram = mesas
  for (const entrada of espera.toSorted(
    (a, b) => Date.parse(a.chegouEm) - Date.parse(b.chegouEm),
  )) {
    const mesa = sugerirMesa(entrada.pessoas, sobram, reservas, quando)
    if (!mesa) continue
    sugestoes.set(entrada.id, mesa)
    sobram = sobram.filter((outra) => outra.id !== mesa.id)
  }
  return sugestoes
}

/** "Chamar" da espera: abre a conversa no WhatsApp com a mensagem pronta. Nada é enviado sozinho. */
export function chamadaPeloWhatsApp(telefone: string, loja: string): string {
  return linkWhatsApp(
    telefone,
    `Olá! Sua mesa na ${loja} está pronta. Pode vir, estamos te esperando.`,
  )
}

/** A reserva como o servidor recebe. */
export type NovaReserva = {
  nome: string
  telefone?: string
  inicio: string
  pessoas: number
  mesaId?: string
}

/** Quem entra na espera, como o servidor recebe. */
export type NovaEntradaEspera = { nome: string; pessoas: number; telefone?: string }

const ERRO_NOME = "Informe o nome."
const ERRO_TELEFONE = "Informe o telefone com DDD."
const ERRO_PESSOAS = "Informe de 1 a 99 pessoas."

/** Nome, telefone e pessoas, do jeito que reserva e espera conferem igual. */
function conferirPessoa(campos: { nome: string; telefone: string; pessoas: string }) {
  const nome = campos.nome.trim().slice(0, 80)
  const telefone = campos.telefone.replace(/\D/g, "")
  const pessoas = Number(campos.pessoas)
  const pessoasValidas =
    campos.pessoas.trim() !== "" && Number.isInteger(pessoas) && pessoas >= 1 && pessoas <= 99
  const erros: { nome?: string; telefone?: string; pessoas?: string } = {
    ...(nome ? {} : { nome: ERRO_NOME }),
    ...(telefone === "" || telefone.length === 10 || telefone.length === 11
      ? {}
      : { telefone: ERRO_TELEFONE }),
    ...(pessoasValidas ? {} : { pessoas: ERRO_PESSOAS }),
  }
  return { erros, nome, pessoas, ...(telefone ? { telefone } : {}) }
}

export type ErrosReserva = { nome?: string; telefone?: string; horario?: string; pessoas?: string }

/**
 * Confere o formulário da reserva (só hoje): nome, telefone com DDD (opcional), o horário a
 * partir do minuto de agora e de 1 a 99 pessoas. Certo, devolve a reserva com o `inicio` ISO.
 */
export function conferirReserva(
  campos: { nome: string; telefone: string; horario: string; pessoas: string },
  agora: Date,
): { erros: ErrosReserva; reserva?: Omit<NovaReserva, "mesaId"> } {
  const { erros: daPessoa, ...pessoa } = conferirPessoa(campos)
  // HH de 00 a 23 e MM de 00 a 59: "23:99" não vira 00:39 do dia seguinte.
  const hora = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(campos.horario)
  const inicio = hora
    ? set(agora, { hours: Number(hora[1]), minutes: Number(hora[2]), seconds: 0, milliseconds: 0 })
    : null
  const erros: ErrosReserva = {
    ...daPessoa,
    ...(!inicio
      ? { horario: "Informe o horário." }
      : inicio < startOfMinute(agora)
        ? { horario: "Esse horário já passou." }
        : {}),
  }
  if (!inicio || Object.keys(erros).length > 0) return { erros }
  return { erros, reserva: { ...pessoa, inicio: inicio.toISOString() } }
}

/** Confere quem entra na espera: nome, pessoas e o telefone com DDD (opcional). */
export function conferirEspera(campos: { nome: string; telefone: string; pessoas: string }): {
  erros: { nome?: string; telefone?: string; pessoas?: string }
  entrada?: NovaEntradaEspera
} {
  const { erros, ...entrada } = conferirPessoa(campos)
  return Object.keys(erros).length > 0 ? { erros } : { erros, entrada }
}
