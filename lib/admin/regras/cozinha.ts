import { isSameDay } from "date-fns"
import type {
  AvisoCozinha,
  ItemPedido,
  MensagemCozinha,
  Pedido,
  Prazo,
  StatusPedido,
  TemposCozinha,
  TipoMensagemCozinha,
} from "../dados/tipos"
import type { Urgencia } from "./fila"
import { type OutraPraca, pracaDoItem, ticketNaPraca, type VisaoDePraca } from "./pracas"

export type FiltroCozinha = "todos" | "mesas" | "entrega" | "retirada"

export type ColunaCozinha = {
  id: "afazer" | "preparando" | "prontos"
  titulo: string
  status: StatusTicket
  tickets: TicketCozinha[]
}

/** Os tempos da cozinha quando a loja não escolheu os seus. */
export const TEMPOS_PADRAO: TemposCozinha = { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 15 }

/** Sem o tempo mínimo de retirada da loja, o agendado começa 20 minutos antes. */
const PREPARO_PADRAO = 20

/**
 * Os tempos que o quadro usa: os de alerta da loja e quanto ela leva para preparar
 * (o mínimo da retirada), que diz quando o agendado começa.
 */
export type ConfigCozinha = TemposCozinha & { preparoMin?: number }

const rodadaDo = (item: ItemPedido) => item.rodada ?? 1

/**
 * O que a cozinha prepara. Na comanda, só a última rodada enviada é nova; as
 * anteriores já foram servidas e aparecem apagadas. Item sem cozinha (bebida
 * lançada direto na mesa) não aparece.
 */
export function itensDaCozinha(pedido: Pedido): { atuais: ItemPedido[]; anteriores: ItemPedido[] } {
  const daCozinha = pedido.itens.filter((item) => item.vaiParaCozinha ?? pedido.enviarParaCozinha)
  const ultima = Math.max(0, ...daCozinha.map(rodadaDo))
  return {
    atuais: daCozinha.filter((item) => rodadaDo(item) === ultima),
    anteriores: daCozinha.filter((item) => rodadaDo(item) !== ultima),
  }
}

/**
 * A cozinha já preparou (ou está preparando) o item: ele foi para a cozinha e a rodada
 * dele já começou, ficou pronta ou foi servida. Tirar ou diminuir esse item pede confirmação.
 */
export function cozinhaJaPreparou(comanda: Pedido, item: ItemPedido): boolean {
  const vaiParaCozinha = (doPedido: ItemPedido) =>
    doPedido.vaiParaCozinha ?? comanda.enviarParaCozinha
  if (!vaiParaCozinha(item)) return false
  return comanda.itens.some(
    (doPedido) =>
      vaiParaCozinha(doPedido) &&
      rodadaDo(doPedido) === rodadaDo(item) &&
      Boolean(doPedido.iniciadoEm || doPedido.feitoEm || doPedido.servidoEm),
  )
}

/**
 * O que pede o olho da cozinha: cada ticket em A fazer ("pedido:rodada") e cada aviso
 * sem ciente ("aviso:id"). O agendado só conta quando chega a hora de começar.
 */
function chavesDosTickets(
  tickets: TicketCozinha[],
  agora: Date | undefined,
  tempos: ConfigCozinha,
): string[] {
  const novos = tickets.filter(
    (ticket) =>
      ticket.status === "recebido" &&
      ticket.itens.length > 0 &&
      !(agora && esperando(ticket, agora, tempos)),
  )
  const avisos = tickets.flatMap((ticket) => ticket.avisos.map((aviso) => `aviso:${aviso.id}`))
  return [...new Set([...novos.map((ticket) => ticket.id), ...avisos])]
}

export const chavesDaCozinha = (
  pedidos: Pedido[],
  agora?: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
  visao?: VisaoDePraca,
): Set<string> =>
  new Set(chavesDosTickets(daPraca(ticketsDaCozinha(pedidos), visao), agora, tempos))

/**
 * O que chegou desde a última leitura: pedido novo, rodada nova, agendado que chegou a
 * hora de começar, cancelamento ou alteração.
 */
export const novidadesNaCozinha = (
  conhecidas: ReadonlySet<string>,
  pedidos: Pedido[],
  agora?: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
  visao?: VisaoDePraca,
): string[] =>
  chavesDosTickets(daPraca(ticketsDaCozinha(pedidos), visao), agora, tempos).filter(
    (chave) => !conhecidas.has(chave),
  )

/**
 * Quando a rodada começa a contar: a chegada ou, no agendado, o horário menos o tempo de
 * preparo (nunca antes da chegada).
 */
export function comecaEm(ticket: TicketCozinha, tempos: ConfigCozinha = TEMPOS_PADRAO): number {
  const chegou = Date.parse(ticket.chegouEm)
  if (!ticket.agendadoPara) return chegou
  const preparo = (tempos.preparoMin ?? PREPARO_PADRAO) * 60_000
  return Math.max(chegou, Date.parse(ticket.agendadoPara) - preparo)
}

/**
 * O agendado que ainda não chegou a hora de começar: espera em Mais tarde. Com aviso
 * sem ciente (cancelado ou alterado), vai para o quadro na hora.
 */
const esperando = (ticket: TicketCozinha, agora: Date, tempos: ConfigCozinha) =>
  ticket.status === "recebido" &&
  ticket.avisos.length === 0 &&
  comecaEm(ticket, tempos) > agora.getTime()

export const minutosNaCozinha = (
  ticket: TicketCozinha,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
) => Math.floor((agora.getTime() - comecaEm(ticket, tempos)) / 60_000)

/**
 * Âmbar a partir do tempo de atenção e vermelho a partir do de atraso (15 e 25 minutos,
 * se a loja não mudou), contando da chegada da rodada.
 */
export function urgenciaNaCozinha(
  ticket: TicketCozinha,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
): Urgencia {
  const minutos = minutosNaCozinha(ticket, agora, tempos)
  if (minutos >= tempos.atrasoMin) return "atrasado"
  if (minutos >= tempos.atencaoMin) return "atencao"
  return "normal"
}

/** As rodadas que passaram do atraso e ainda não ficaram prontas ("pedido:rodada"). */
export const atrasadosNaCozinha = (
  pedidos: Pedido[],
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
  visao?: VisaoDePraca,
): Set<string> =>
  new Set(
    daPraca(ticketsDaCozinha(pedidos), visao)
      .filter(
        (ticket) =>
          ticket.status !== "pronto" &&
          ticket.itens.length > 0 &&
          ticket.pedido.status !== "cancelado" &&
          urgenciaNaCozinha(ticket, agora, tempos) === "atrasado",
      )
      .map((ticket) => ticket.id),
  )

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * A hora digitada no campo "Para as" ("22:00") vira o horário de hoje. Campo vazio (ou só
 * a máscara) é sem agendar.
 */
export function agendadoParaHoje(hora: string, agora: Date): string | undefined {
  if (hora.replace(/[_:\s]/g, "") === "") return undefined
  const partes = HORA.exec(hora)
  if (!partes) throw new Error("Use o formato 20:00.")
  const quando = new Date(agora)
  quando.setHours(Number(partes[1]), Number(partes[2]), 0, 0)
  return quando.toISOString()
}

/** O horário do agendado: mais tarde, ainda hoje. Devolve o próprio horário, conferido. */
export function conferirAgendado(agendadoPara: string, agora: Date): string {
  const quando = new Date(agendadoPara)
  if (Number.isNaN(quando.getTime()) || quando <= agora || !isSameDay(quando, agora)) {
    throw new Error("Escolha um horário mais tarde, ainda hoje.")
  }
  return agendadoPara
}

/**
 * O horário prometido ao cliente da entrega e da retirada: o agendado ou a criação mais o
 * tempo máximo da loja. `minutos` é o que falta (negativo: quanto já passou). A mesa não
 * tem horário prometido.
 */
export function prometidoAoCliente(
  ticket: TicketCozinha,
  prazos: { entrega: Prazo; retirada: Prazo } | undefined,
  agora: Date,
): { ate: string; minutos: number } | null {
  const { pedido } = ticket
  if (pedido.tipo !== "entrega" && pedido.tipo !== "retirada") return null
  const ate = ticket.agendadoPara
    ? Date.parse(ticket.agendadoPara)
    : prazos
      ? Date.parse(pedido.criadoEm) + prazos[pedido.tipo].max * 60_000
      : null
  if (ate === null) return null
  return {
    ate: new Date(ate).toISOString(),
    minutos: Math.round((ate - agora.getTime()) / 60_000),
  }
}

export type StatusTicket = "recebido" | "em-preparo" | "pronto"

/** Os status em que o pedido está na mão da cozinha. */
const NA_COZINHA: StatusPedido[] = ["recebido", "em-preparo", "pronto"]

/** Uma rodada de um pedido, como a cozinha a vê. */
export type TicketCozinha = {
  /** "pedido:rodada". */
  id: string
  pedido: Pedido
  rodada: number
  status: StatusTicket
  itens: ItemPedido[]
  /** Quando a rodada chegou: o lançamento do garçom ou a criação do pedido. */
  chegouEm: string
  /** Cancelamento ou alteração que a cozinha ainda não viu. */
  avisos: AvisoCozinha[]
  /** Agendado: para quando a rodada tem de ficar pronta. */
  agendadoPara?: string
  /** Na tela de uma praça: o que falta nas outras praças do mesmo ticket. */
  outras?: OutraPraca[]
}

const pendentes = (pedido: Pedido) =>
  (pedido.avisosCozinha ?? []).filter((aviso) => !aviso.cienteEm)

/** Cancelado só fica na cozinha enquanto ela não deu ciente do cancelamento. */
export const naMaoDaCozinha = (pedido: Pedido) =>
  NA_COZINHA.includes(pedido.status) ||
  (pedido.status === "cancelado" && pendentes(pedido).some((aviso) => aviso.tipo === "cancelado"))

/** O estado da rodada sai dos itens: nenhum iniciado, algum iniciado, todos riscados. */
function statusDaRodada(itens: ItemPedido[]): StatusTicket {
  if (itens.every((item) => item.feitoEm)) return "pronto"
  return itens.some((item) => item.iniciadoEm) ? "em-preparo" : "recebido"
}

const agendadoDosItens = (itens: ItemPedido[]) => {
  const agendadoPara = itens.find((item) => item.agendadoPara)?.agendadoPara
  return agendadoPara ? { agendadoPara } : {}
}

/**
 * Os tickets da cozinha: um por rodada de cada pedido, só com o que vai para a cozinha.
 * O que o garçom já serviu saiu da cozinha.
 */
export function ticketsDaCozinha(pedidos: Pedido[]): TicketCozinha[] {
  const naCozinha = pedidos.filter(
    (pedido) => pedido.tipo !== "atendimento" && naMaoDaCozinha(pedido),
  )
  return naCozinha.flatMap((pedido) => {
    const daCozinha = pedido.itens.filter(
      (item) => (item.vaiParaCozinha ?? pedido.enviarParaCozinha) && !item.servidoEm,
    )
    const avisos = pendentes(pedido)
    // A rodada que ficou sem itens continua na tela enquanto houver alteração sem ciente.
    const rodadas = [
      ...new Set([
        ...daCozinha.map(rodadaDo),
        ...avisos.flatMap((aviso) => (aviso.rodada ? [aviso.rodada] : [])),
      ]),
    ].sort((a, b) => a - b)
    return rodadas.map((rodada) => {
      const itens = daCozinha.filter((item) => rodadaDo(item) === rodada)
      const daRodada = avisos.filter(
        (aviso) => aviso.tipo === "cancelado" || aviso.rodada === rodada,
      )
      return {
        id: `${pedido.id}:${rodada}`,
        pedido,
        rodada,
        status:
          itens.length > 0
            ? statusDaRodada(itens)
            : (daRodada.find((aviso) => aviso.etapa)?.etapa ?? "recebido"),
        itens,
        chegouEm:
          itens.length > 0
            ? (itens.find((item) => item.lancadoEm)?.lancadoEm ?? pedido.criadoEm)
            : (daRodada[0]?.em ?? pedido.criadoEm),
        avisos: daRodada,
        ...agendadoDosItens(itens),
      }
    })
  })
}

const ORDEM_DO_TICKET: StatusTicket[] = ["recebido", "em-preparo", "pronto"]

/**
 * O status do pedido na cozinha é o da rodada mais atrás: uma rodada nova põe a comanda
 * em Novo, e ela só fica pronta quando todas as rodadas estão prontas.
 */
export function statusPelasRodadas(pedido: Pedido): StatusTicket | null {
  const status = ticketsDaCozinha([pedido])
    .filter((ticket) => ticket.itens.length > 0)
    .map((ticket) => ORDEM_DO_TICKET.indexOf(ticket.status))
  return status.length > 0 ? ORDEM_DO_TICKET[Math.min(...status)] : null
}

/** Pedido cancelado fica na tela só para o ciente: o preparo dele não anda. */
function conferirAtivo(pedido: Pedido) {
  if (pedido.status === "cancelado") throw new Error("Este pedido foi cancelado.")
}

/** A cozinha viu o aviso: ele sai do ticket em todas as telas. */
export function darCiente(pedido: Pedido, avisoId: string, agora: string): Pedido {
  if (!pedido.avisosCozinha?.some((aviso) => aviso.id === avisoId)) {
    throw new Error("Aviso não encontrado.")
  }
  return {
    ...pedido,
    avisosCozinha: pedido.avisosCozinha.map((aviso) =>
      aviso.id === avisoId ? { ...aviso, cienteEm: aviso.cienteEm ?? agora } : aviso,
    ),
  }
}

/** O ticket da rodada, na etapa que a tela mostrava; se outra aba mudou, recusa. */
function ticketDo(pedido: Pedido, rodada: number, de: StatusTicket) {
  conferirAtivo(pedido)
  const ticket = ticketsDaCozinha([pedido]).find((item) => item.rodada === rodada)
  if (!ticket) throw new Error("Esta rodada não está na cozinha.")
  if (ticket.status !== de) throw new Error("Este ticket já mudou de etapa. Atualize a tela.")
  return ticket
}

/** Muda os itens da rodada e põe o pedido no status da rodada mais atrás. */
function mudarItensDaRodada(
  pedido: Pedido,
  daRodada: ItemPedido[],
  mudar: (item: ItemPedido) => ItemPedido,
): Pedido {
  const ids = new Set(daRodada.map((item) => item.id))
  const mudado = {
    ...pedido,
    itens: pedido.itens.map((item) => (ids.has(item.id) ? mudar(item) : item)),
  }
  return { ...mudado, status: statusPelasRodadas(mudado) ?? pedido.status }
}

/** A rodada passa para a próxima etapa: A fazer → Preparando → Pronto. */
export function avancarRodada(
  pedido: Pedido,
  rodada: number,
  de: StatusTicket,
  agora: string,
): Pedido {
  const ticket = ticketDo(pedido, rodada, de)
  if (de === "pronto") throw new Error("Este ticket não tem próxima etapa")
  return mudarItensDaRodada(pedido, ticket.itens, (item) =>
    de === "recebido"
      ? { ...item, iniciadoEm: agora }
      : { ...item, feitoEm: item.feitoEm ?? agora },
  )
}

/** A rodada volta uma etapa: o pronto volta a preparar, o preparo volta a fazer. */
export function voltarRodada(pedido: Pedido, rodada: number, de: StatusTicket): Pedido {
  const ticket = ticketDo(pedido, rodada, de)
  if (de === "recebido") throw new Error("Este ticket não tem etapa anterior")
  return mudarItensDaRodada(pedido, ticket.itens, ({ feitoEm, iniciadoEm, ...item }) =>
    de === "pronto" ? { ...item, iniciadoEm } : item,
  )
}

/** Risca (ou desrisca) um item. Riscar num ticket de A fazer já começa a rodada. */
export function riscarItem(pedido: Pedido, itemId: string, feito: boolean, agora: string): Pedido {
  conferirAtivo(pedido)
  const ticket = ticketsDaCozinha([pedido]).find((item) =>
    item.itens.some((doTicket) => doTicket.id === itemId),
  )
  if (!ticket) throw new Error("Este item não está na cozinha.")
  return mudarItensDaRodada(pedido, ticket.itens, ({ feitoEm, ...item }) => {
    const iniciado = { ...item, iniciadoEm: item.iniciadoEm ?? agora }
    if (item.id !== itemId) return feitoEm ? { ...iniciado, feitoEm } : iniciado
    return feito ? { ...iniciado, feitoEm: feitoEm ?? agora } : iniciado
  })
}

/**
 * A praça terminou a parte dela na rodada: risca os itens dela e começa a rodada inteira.
 * Quando a última praça termina, a rodada fica pronta.
 */
export function prontoNaPraca(
  pedido: Pedido,
  rodada: number,
  visao: VisaoDePraca,
  agora: string,
): Pedido {
  conferirAtivo(pedido)
  const ticket = ticketsDaCozinha([pedido]).find((item) => item.rodada === rodada)
  const daqui = (item: ItemPedido) =>
    pracaDoItem(item, visao.produtos, visao.pracas) === visao.pracaId
  if (!ticket?.itens.some(daqui)) throw new Error("Esta praça não tem itens nesta rodada.")
  return mudarItensDaRodada(pedido, ticket.itens, (item) => ({
    ...item,
    iniciadoEm: item.iniciadoEm ?? agora,
    ...(daqui(item) ? { feitoEm: item.feitoEm ?? agora } : {}),
  }))
}

/** O garçom levou a rodada pronta à mesa: ela sai da cozinha. */
export function servirRodada(pedido: Pedido, rodada: number, agora: string): Pedido {
  conferirAtivo(pedido)
  const ticket = ticketsDaCozinha([pedido]).find((item) => item.rodada === rodada)
  if (!ticket || ticket.itens.length === 0) throw new Error("Esta rodada não está na cozinha.")
  if (ticket.status !== "pronto") throw new Error("Esta rodada ainda não está pronta.")
  return mudarItensDaRodada(pedido, ticket.itens, (item) => ({ ...item, servidoEm: agora }))
}

/** Quando a rodada ficou pronta: o último item riscado. */
const prontoEm = (ticket: TicketCozinha) =>
  Math.max(...ticket.itens.map((item) => Date.parse(item.feitoEm ?? "")))

/** O que o salão tem para levar: as rodadas prontas das mesas, da mais antiga à mais nova. */
export const prontosParaServir = (pedidos: Pedido[]): TicketCozinha[] =>
  ticketsDaCozinha(pedidos.filter((pedido) => pedido.tipo === "mesa"))
    .filter((ticket) => ticket.status === "pronto" && ticket.itens.length > 0)
    .sort((a, b) => prontoEm(a) - prontoEm(b))

export const TEXTO_DA_MENSAGEM: Record<TipoMensagemCozinha, string> = {
  atraso: "Vai atrasar ~10 min",
  substituicao: "Acabou um item, ver substituição",
  duvida: "Dúvida no pedido, venha à cozinha",
}

/** As mensagens da cozinha que ninguém deu Ok ainda. */
export const mensagensPendentes = (pedido: Pedido): MensagemCozinha[] =>
  (pedido.mensagensCozinha ?? []).filter((mensagem) => !mensagem.vistaEm)

/** A cozinha manda uma mensagem rápida sobre a rodada. A mesma, pendente, não se repete. */
export function avisarSobreRodada(
  pedido: Pedido,
  rodada: number,
  tipo: TipoMensagemCozinha,
  id: string,
  agora: string,
): Pedido {
  conferirAtivo(pedido)
  const naCozinha = ticketsDaCozinha([pedido]).some(
    (ticket) => ticket.rodada === rodada && ticket.itens.length > 0,
  )
  if (!naCozinha) throw new Error("Esta rodada não está na cozinha.")
  const repetida = mensagensPendentes(pedido).some(
    (mensagem) => mensagem.rodada === rodada && mensagem.tipo === tipo,
  )
  if (repetida) return pedido
  return {
    ...pedido,
    mensagensCozinha: [...(pedido.mensagensCozinha ?? []), { id, rodada, tipo, em: agora }],
  }
}

/** Alguém do salão ou do caixa leu a mensagem: ela sai de todas as telas. */
export function verMensagem(pedido: Pedido, mensagemId: string, agora: string): Pedido {
  if (!pedido.mensagensCozinha?.some((mensagem) => mensagem.id === mensagemId)) {
    throw new Error("Mensagem não encontrada.")
  }
  return {
    ...pedido,
    mensagensCozinha: pedido.mensagensCozinha.map((mensagem) =>
      mensagem.id === mensagemId ? { ...mensagem, vistaEm: mensagem.vistaEm ?? agora } : mensagem,
    ),
  }
}

/** Quem leva o pedido adiante: o salão serve as mesas; o caixa, a entrega e a retirada. */
export type QuemServe = "salao" | "caixa"

const DE_QUEM: Record<QuemServe, (pedido: Pedido) => boolean> = {
  salao: (pedido) => pedido.tipo === "mesa",
  caixa: (pedido) => pedido.tipo === "entrega" || pedido.tipo === "retirada",
}

/**
 * O que pede o olho de quem serve: a rodada que ficou pronta e a mensagem da cozinha.
 * Uma chave nova desde a última leitura toca o alerta.
 */
export function chavesDeQuemServe(pedidos: Pedido[], quem: QuemServe): Set<string> {
  const daqui = pedidos.filter(DE_QUEM[quem])
  const prontos =
    quem === "salao"
      ? prontosParaServir(daqui).map((ticket) => `pronto:${ticket.id}`)
      : daqui.filter((pedido) => pedido.status === "pronto").map((pedido) => `pronto:${pedido.id}`)
  const mensagens = daqui.flatMap((pedido) =>
    mensagensPendentes(pedido).map((mensagem) => `msg:${mensagem.id}`),
  )
  return new Set([...prontos, ...mensagens])
}

const PASSA_NO_FILTRO: Record<FiltroCozinha, (pedido: Pedido) => boolean> = {
  todos: () => true,
  mesas: (pedido) => pedido.tipo === "mesa",
  entrega: (pedido) => pedido.tipo === "entrega",
  retirada: (pedido) => pedido.tipo === "retirada",
}

/**
 * Quadro da cozinha. Fica de fora o salão (atendimento), o que não tem nada a
 * preparar e o pronto há mais tempo que a loja deixa na tela: dali em diante, entrega e retirada
 * seguem pela Fila e a mesa fecha em Mesas.
 */
export function colunasDaCozinha(
  pedidos: Pedido[],
  filtro: FiltroCozinha,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
  visao?: VisaoDePraca,
): ColunaCozinha[] {
  const tickets = daPraca(ticketsDaCozinha(pedidos.filter(PASSA_NO_FILTRO[filtro])), visao).filter(
    (ticket) => !esperando(ticket, agora, tempos),
  )
  const com = (status: StatusTicket) =>
    tickets
      .filter((ticket) => ticket.status === status)
      .sort(
        (a, b) =>
          // Prioridade primeiro; depois, quem começou a contar antes.
          Number(Boolean(b.pedido.prioridade)) - Number(Boolean(a.pedido.prioridade)) ||
          comecaEm(a, tempos) - comecaEm(b, tempos),
      )
  const naTela = (ticket: TicketCozinha) => naTelaDaCozinha(ticket, agora, tempos)

  return [
    { id: "afazer", titulo: "A fazer", status: "recebido", tickets: com("recebido") },
    { id: "preparando", titulo: "Preparando", status: "em-preparo", tickets: com("em-preparo") },
    { id: "prontos", titulo: "Prontos", status: "pronto", tickets: com("pronto").filter(naTela) },
  ]
}

/** Na tela de uma praça, cada ticket como ela o vê; sem praça, a expedição vê tudo. */
const daPraca = (tickets: TicketCozinha[], visao: VisaoDePraca | undefined) =>
  visao ? tickets.flatMap((ticket) => ticketNaPraca(ticket, visao) ?? []) : tickets

/** Os agendados que ainda esperam a hora de começar, do mais cedo ao mais tarde. */
export const maisTardeNaCozinha = (
  pedidos: Pedido[],
  filtro: FiltroCozinha,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
  visao?: VisaoDePraca,
): TicketCozinha[] =>
  daPraca(ticketsDaCozinha(pedidos.filter(PASSA_NO_FILTRO[filtro])), visao)
    .filter((ticket) => ticket.itens.length > 0 && esperando(ticket, agora, tempos))
    .sort((a, b) => comecaEm(a, tempos) - comecaEm(b, tempos))

/**
 * O ticket está na tela da cozinha: ainda não ficou pronto, ficou pronto há menos do
 * tempo da loja (contando do último item riscado) ou tem aviso sem ciente.
 */
export function naTelaDaCozinha(
  ticket: TicketCozinha,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
): boolean {
  if (ticket.status !== "pronto" || ticket.avisos.length > 0) return true
  return agora.getTime() - prontoEm(ticket) < tempos.prontoFicaMin * 60_000
}

/**
 * O que a comanda perdeu da cozinha entre `antes` e `depois`: item tirado ou quantidade
 * menor, de um ticket que ainda está na tela. Um aviso por item.
 */
export function alteracoesParaCozinha(
  antes: Pedido,
  depois: Pedido,
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
): Omit<AvisoCozinha, "id">[] {
  return ticketsDaCozinha([antes])
    .filter((ticket) => ticket.itens.length > 0 && naTelaDaCozinha(ticket, agora, tempos))
    .flatMap((ticket) =>
      ticket.itens.flatMap((item) => {
        const ficou = depois.itens.find((outro) => outro.id === item.id)?.quantidade ?? 0
        if (ficou >= item.quantidade) return []
        return [
          {
            tipo: "alterado" as const,
            em: agora.toISOString(),
            rodada: ticket.rodada,
            etapa: ticket.status,
            itens: [{ nome: item.nome, quantidade: item.quantidade - ficou }],
          },
        ]
      }),
    )
}
