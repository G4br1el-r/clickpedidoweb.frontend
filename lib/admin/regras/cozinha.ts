import type {
  AvisoCozinha,
  ItemPedido,
  MensagemCozinha,
  Pedido,
  StatusPedido,
  TipoMensagemCozinha,
} from "../dados/tipos"
import type { Urgencia } from "./fila"

export type FiltroCozinha = "todos" | "mesas" | "entrega" | "retirada"

export type ColunaCozinha = {
  id: "afazer" | "preparando" | "prontos"
  titulo: string
  status: StatusTicket
  tickets: TicketCozinha[]
}

/** Quanto tempo um pedido pronto continua na tela da cozinha. */
const PRONTO_FICA_MINUTOS = 15

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
 * sem ciente ("aviso:id").
 */
function chavesDosTickets(tickets: TicketCozinha[]): string[] {
  const novos = tickets.filter((ticket) => ticket.status === "recebido" && ticket.itens.length > 0)
  const avisos = tickets.flatMap((ticket) => ticket.avisos.map((aviso) => `aviso:${aviso.id}`))
  return [...new Set([...novos.map((ticket) => ticket.id), ...avisos])]
}

export const chavesDaCozinha = (pedidos: Pedido[]): Set<string> =>
  new Set(chavesDosTickets(ticketsDaCozinha(pedidos)))

/** O que chegou desde a última leitura: pedido novo, rodada nova, cancelamento ou alteração. */
export const novidadesNaCozinha = (conhecidas: ReadonlySet<string>, pedidos: Pedido[]): string[] =>
  chavesDosTickets(ticketsDaCozinha(pedidos)).filter((chave) => !conhecidas.has(chave))

export const minutosNaCozinha = (ticket: TicketCozinha, agora: Date) =>
  Math.floor((agora.getTime() - Date.parse(ticket.chegouEm)) / 60_000)

/** Âmbar a partir de 15 minutos e vermelho a partir de 25, contando da chegada da rodada. */
export function urgenciaNaCozinha(ticket: TicketCozinha, agora: Date): Urgencia {
  const minutos = minutosNaCozinha(ticket, agora)
  if (minutos >= 25) return "atrasado"
  if (minutos >= 15) return "atencao"
  return "normal"
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
 * preparar e o pronto há mais de 15 minutos: dali em diante, entrega e retirada
 * seguem pela Fila e a mesa fecha em Mesas.
 */
export function colunasDaCozinha(
  pedidos: Pedido[],
  filtro: FiltroCozinha,
  agora: Date,
): ColunaCozinha[] {
  const tickets = ticketsDaCozinha(pedidos.filter(PASSA_NO_FILTRO[filtro]))
  const com = (status: StatusTicket) =>
    tickets
      .filter((ticket) => ticket.status === status)
      .sort(
        (a, b) =>
          // Prioridade primeiro; depois, quem chegou antes.
          Number(Boolean(b.pedido.prioridade)) - Number(Boolean(a.pedido.prioridade)) ||
          Date.parse(a.chegouEm) - Date.parse(b.chegouEm),
      )
  const naTela = (ticket: TicketCozinha) => naTelaDaCozinha(ticket, agora)

  return [
    { id: "afazer", titulo: "A fazer", status: "recebido", tickets: com("recebido") },
    { id: "preparando", titulo: "Preparando", status: "em-preparo", tickets: com("em-preparo") },
    { id: "prontos", titulo: "Prontos", status: "pronto", tickets: com("pronto").filter(naTela) },
  ]
}

/**
 * O ticket está na tela da cozinha: ainda não ficou pronto, ficou pronto há menos de
 * 15 minutos (contando do último item riscado) ou tem aviso sem ciente.
 */
export function naTelaDaCozinha(ticket: TicketCozinha, agora: Date): boolean {
  if (ticket.status !== "pronto" || ticket.avisos.length > 0) return true
  return agora.getTime() - prontoEm(ticket) < PRONTO_FICA_MINUTOS * 60_000
}

/**
 * O que a comanda perdeu da cozinha entre `antes` e `depois`: item tirado ou quantidade
 * menor, de um ticket que ainda está na tela. Um aviso por item.
 */
export function alteracoesParaCozinha(
  antes: Pedido,
  depois: Pedido,
  agora: Date,
): Omit<AvisoCozinha, "id">[] {
  return ticketsDaCozinha([antes])
    .filter((ticket) => ticket.itens.length > 0 && naTelaDaCozinha(ticket, agora))
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
