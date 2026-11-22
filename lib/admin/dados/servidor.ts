import { addDays, addMinutes, endOfDay, format, isSameDay, startOfDay, subDays } from "date-fns"
import { del, get, set } from "idb-keyval"
import { emReais, plural } from "../../formato"
import { expediente, horariosLivres, INTERVALO_MIN } from "../regras/agenda"
import {
  copiarProduto,
  reordenar,
  replicarOpcoes,
  sincronizarOpcoes,
  soltarOpcoesDe,
} from "../regras/cardapio"
import {
  comTotais,
  erroDoDesconto,
  itensPagos,
  pagamentosDoPedido,
  resumoDaConta,
  trocoDoPagamento,
  valorDosItens,
} from "../regras/conta"
import { cozinhaJaPreparou, depoisDeTirar, itensDaCozinha } from "../regras/cozinha"
import { esquemaLoja } from "../regras/esquema-loja"
import { esquemaProduto } from "../regras/esquema-produto"
import { esquemaSalao } from "../regras/esquema-salao"
import { consumoDoPedido, errosDoMovimento, saldoDepois } from "../regras/estoque"
import { normalizar } from "../regras/filtro-pedidos"
import { comEtapa, comEvento, itensEmTexto } from "../regras/historico"
import { nomePadraoDaMesa } from "../regras/mesas"
import {
  juntarComandas,
  numerosEmTexto,
  porQueNaoJunta,
  porQueNaoTransfere,
  separarQuantidade,
  servirDesdeAoReceber,
} from "../regras/movimentacoes"
import { proximoNumero } from "../regras/numero"
import {
  type Desconto,
  descontoPassaDoSubtotal,
  type Escolhas,
  errosDasEscolhas,
  precoComOpcoes,
  precoDeBalcao,
  resumoDasOpcoes,
  totaisDaVenda,
} from "../regras/pdv"
import { calcularPesagem, faltaPesar } from "../regras/pesagem"
import { rotuloDoPagamento } from "../regras/rotulos"
import { mesasSeCruzam, primeiraPosicaoLivre } from "../regras/salao"
import { proximoStatus } from "../regras/status"
import { type SegmentoPainelId, temRecurso } from "../segmentos-painel"
import { semearCustos } from "./custos-demo"
import { semearEstoque } from "./estoque-demo"
import { gerarPedidoAgora, gerarPedidos } from "./gerar-pedidos"
import { type BaseLojaV3, migrarDaVersao3 } from "./migracao"
import {
  type Bairro,
  type BaseLoja,
  type CartaoPagamento,
  type CatalogoLoja,
  type Categoria,
  type ConfigLoja,
  type ConfigSalao,
  type DescontoConta,
  type EventoComanda,
  FORMAS_MESA,
  type FormaMesa,
  type ItemPedido,
  type Mesa,
  type MotivoCancelamento,
  type Motoboy,
  type MovimentoEstoque,
  type PagamentoConta,
  type Pedido,
  type Produto,
  type StatusPedido,
  type TipoMovimento,
} from "./tipos"

/**
 * Sobe quando o formato guardado muda. A 3 (custos e histórico, sem o salão) ganha as mesas
 * novas; qualquer outra, inclusive uma 3 que já tenha salão mas não os custos, é gerada de novo.
 */
const VERSAO = 4
const DIAS_DE_HISTORICO = 90

type Guardado = { versao: number; geradoEm: string; base: BaseLoja }

/** Venda montada na caixa do PDV. Os itens vão como no Garçom: o preço sai do servidor. */
export type VendaPdv = {
  itens: ItemLancado[]
  pagamento: PagamentoMesa
  desconto: Desconto
  /** Dinheiro: quanto o cliente entregou. */
  valorRecebido?: number
  clienteNome?: string
  observacao?: string
  /** Falso: a venda vai para a fila e a cozinha. */
  concluida: boolean
}

export type FiltroPedidos = {
  /** Criados de… até… (pelo dia de `criadoEm`). */
  de?: Date
  ate?: Date
  status?: StatusPedido[]
  /** Só os concluídos neste dia, mesmo que criados antes (pelo `atualizadoEm`). */
  concluidosEm?: Date
}

/**
 * Item lançado pelo garçom ou na comanda. Do cardápio vêm só as escolhas: o preço é
 * calculado aqui. O avulso é a exceção declarada, com nome e preço digitados.
 */
export type ItemLancado = { quantidade: number; observacao?: string } & (
  | { produtoId: string; escolhas: Escolhas }
  | { avulso: { nome: string; preco: number } }
)

/** Agendamento marcado pelo painel do salão. */
export type NovoAgendamento = {
  cliente: { nome: string; telefone: string }
  /** Ids dos serviços do cardápio: o preço e a duração saem deles. */
  servicos: string[]
  /** Início, em ISO. */
  inicio: string
  pagamento: PagamentoMesa
  observacao?: string
}

/** Formas de pagar na loja (mesa, balcão e salão): dinheiro, Pix ou cartão na maquininha. */
const PAGAMENTOS_NA_LOJA = ["dinheiro", "pix", "cartao-na-entrega"] as const

/** Como a mesa paga a conta: dinheiro, Pix ou cartão na maquininha. */
export type PagamentoMesa = (typeof PAGAMENTOS_NA_LOJA)[number]

/** Lugares e forma da mesa vêm da tela: confere na hora de usar. */
function conferirLugaresEForma(lugares: number, forma: FormaMesa) {
  if (!Number.isInteger(lugares) || lugares < 1 || lugares > 20) {
    throw new Error("Informe de 1 a 20 lugares.")
  }
  if (!FORMAS_MESA.includes(forma)) {
    throw new Error("Escolha a forma da mesa.")
  }
}

/** A forma de pagamento vem da tela: confere na hora de usar, não só pelo tipo. */
function conferirPagamento(pagamento: string) {
  if (!(PAGAMENTOS_NA_LOJA as readonly string[]).includes(pagamento)) {
    throw new Error("Escolha uma forma de pagamento válida.")
  }
}

export type LancamentoMesa = {
  mesaId: string
  itens: ItemLancado[]
  /** Falso: entra na comanda sem passar pela cozinha (bebida, sobremesa pronta). */
  enviarParaCozinha: boolean
  /** Na mesa livre, tem que estar na lista do salão (quando ela existe). */
  garcom?: string
  /** Só abre a comanda com ele: a comanda aberta (a da principal, na juntada) não muda de nome. */
  clienteNome?: string
  /** Quem lançou, para o histórico. Sem ele, assina o garçom do lançamento. */
  por?: string
}

/**
 * Um pagamento da conta. `valor` é a parte que abate do saldo (no dinheiro, acima do saldo vira
 * troco); por item, o valor sai dos itens. `recebido`: o que o cliente entregou em dinheiro.
 */
export type Pagamento = {
  forma: PagamentoMesa
  valor?: number
  recebido?: number
  cartao?: CartaoPagamento
  itens?: string[]
  por?: string
}

/** Parte de um item preparado que saiu da comanda: não volta ao estoque. */
type Perda = { item: ItemPedido; quantidade: number; motivo: string }

/** Tirar ou diminuir item: o motivo (obrigatório no que a cozinha preparou) e quem fez. */
export type Retirada = { motivo?: string; por?: string }

/** Abertura da mesa pela tela de Mesas. `por`: quem está no aparelho, para o histórico. */
export type AberturaMesa = {
  pessoas: number
  garcom?: string
  clienteNome?: string
  /** A mesa está reservada: abrir mesmo assim. */
  confirmarReserva?: boolean
  /** Assina a abertura quando não há garçom (salão sem a lista). */
  por?: string
}

export type OpcoesServidor = {
  segmento: SegmentoPainelId
  carregarCatalogo: () => Promise<CatalogoLoja>
  /** Espera simulada de rede, em ms. */
  espera?: number
}

/** Gerador de ids novos com prefixo: prod-1a2b3c4d. */
const novoId = (prefixo: string) => () => `${prefixo}-${crypto.randomUUID().slice(0, 8)}`

const EM_ANDAMENTO: StatusPedido[] = ["recebido", "em-preparo", "pronto", "saiu-para-entrega"]

/** Pedido gerado em andamento: entra como já descontado do estoque inicial. */
const marcarEmAndamento = (pedido: Pedido): Pedido =>
  EM_ANDAMENTO.includes(pedido.status) ? { ...pedido, estoqueBaixado: true } : pedido

/** Ocupa as mesas que têm comanda aberta e libera as outras. */
function abrirMesas(base: BaseLoja): BaseLoja {
  const abertas = new Map(
    base.pedidos
      .filter(
        (pedido) => pedido.tipo === "mesa" && pedido.mesa && EM_ANDAMENTO.includes(pedido.status),
      )
      .map((pedido) => [pedido.mesa?.id, pedido]),
  )
  // A mesa juntada não tem comanda: fica com a principal enquanto a comanda dela está aberta.
  const juntas = new Map(
    [...abertas.values()].flatMap((comanda) =>
      (comanda.mesa?.juntadas ?? []).map((junta) => [junta.id, comanda.mesa?.id as string]),
    ),
  )
  return {
    ...base,
    mesas: base.mesas.map(
      ({ pedidoAtivoId: _pedidoAtivoId, clienteNome, ocupadaEm, juntadaCom: _junta, ...mesa }) => {
        const comanda = abertas.get(mesa.id)
        const principal = juntas.get(mesa.id)
        // Mesa ocupada (ou junta a outra) deixa de estar em limpeza.
        const { limpezaDesde: _limpezaDesde, ...semLimpeza } = mesa
        if (comanda) {
          return {
            ...semLimpeza,
            status: "ocupada",
            pedidoAtivoId: comanda.id,
            clienteNome: comanda.cliente.nome,
            ocupadaEm: comanda.criadoEm,
          }
        }
        return principal
          ? { ...semLimpeza, status: "livre", juntadaCom: principal }
          : { ...mesa, status: "livre" }
      },
    ),
  }
}

const reais = (valor: number) => Math.round(valor * 100) / 100

/**
 * O pedido mais novo que a base já teve: o de maior id em Pedidos ou o que já saiu de lá (a
 * comanda juntada). O id e o número do pedido novo seguem dele, nunca do último da lista.
 */
function ultimoPedido(
  base: BaseLoja,
): { id: number; numero: number; criadoEm: string } | undefined {
  const maior = base.pedidos.reduce<Pedido | undefined>(
    (atual, pedido) => (!atual || pedido.id > atual.id ? pedido : atual),
    undefined,
  )
  const saiu = base.ultimoPedido
  return saiu && (!maior || saiu.id > maior.id) ? saiu : maior
}

/** Id do pedido criado agora: um a mais que o do pedido mais novo que a base já teve. */
const proximoId = (base: BaseLoja) => (ultimoPedido(base)?.id ?? 0) + 1

/** Valor em reais e centavos, sem fração de centavo. */
const emCentavosExatos = (valor: number) => Number.isInteger(Number((valor * 100).toFixed(6)))

/**
 * Comanda aberta da mesa, se houver. A mesa juntada aponta para a comanda da principal; a
 * comanda da própria mesa vem antes.
 */
function comandaDa(base: BaseLoja, mesaId: string) {
  const abertas = base.pedidos.filter(
    (pedido) => pedido.tipo === "mesa" && EM_ANDAMENTO.includes(pedido.status),
  )
  return (
    abertas.find((pedido) => pedido.mesa?.id === mesaId) ??
    abertas.find((pedido) => pedido.mesa?.juntadas?.some((junta) => junta.id === mesaId))
  )
}

/**
 * A reserva marcada da mesa que já está dentro da antecedência e ainda na tolerância. Confere
 * pelo horário, e não pelo estado da mesa: a mesa em limpeza também está reservada.
 */
function reservaDaVez(base: BaseLoja, mesaId: string, agora: Date) {
  const { antecedenciaMin, toleranciaMin } = base.salao.reservas
  return base.reservas
    .filter((item) => {
      const inicio = Date.parse(item.inicio)
      return (
        item.mesaId === mesaId &&
        item.status === "marcada" &&
        inicio >= agora.getTime() - toleranciaMin * 60_000 &&
        inicio - antecedenciaMin * 60_000 <= agora.getTime()
      )
    })
    .toSorted((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0]
}

/**
 * O garçom pela lista do salão, com o nome escrito como lá (sem diferenciar acento e
 * maiúscula). Recusa quem não está na lista; com `obrigatorio`, recusa também o vazio. Sem
 * garçom ativo no salão, não há lista: devolve `undefined`.
 */
function garcomDaLista(base: BaseLoja, nome: string | undefined, obrigatorio: boolean) {
  const ativos = base.salao.garcons.filter((item) => item.ativo)
  if (ativos.length === 0) return undefined
  const pedido = nome?.trim() ?? ""
  if (!pedido) {
    if (obrigatorio) throw new Error("Escolha o garçom.")
    return undefined
  }
  const garcom = ativos.find((item) => normalizar(item.nome) === normalizar(pedido))?.nome
  if (!garcom) throw new Error("Esse garçom não está na lista do salão.")
  return garcom
}

/** O `por` do evento: o nome aparado e limitado, ou nada. */
function autor(por: string | undefined): { por?: string } {
  const nome = por?.trim().slice(0, 80)
  return nome ? { por: nome } : {}
}

/** "Mesa aberta para 3 pessoas", assinado por quem abriu. */
const eventoAberta = (em: string, pessoas: number, por: string | undefined): EventoComanda => ({
  tipo: "aberta",
  em,
  ...autor(por),
  texto: `Mesa aberta para ${plural(pessoas, "pessoa", "pessoas")}`,
})

/**
 * O item que a cozinha já preparou só sai com motivo (aparado, até 140): devolve o motivo.
 * O que ela não preparou sai sem motivo: devolve `undefined`.
 */
function motivoDaPerda(comanda: Pedido, item: ItemPedido, motivo: string | undefined) {
  if (!cozinhaJaPreparou(comanda, item)) return undefined
  const texto = motivo?.trim().slice(0, 140)
  if (!texto) throw new Error("Diga o motivo para tirar o que a cozinha já preparou.")
  return texto
}

/**
 * Tira `quantidade` do item: a perda, se a cozinha já preparou (com o motivo obrigatório), e o
 * evento "Tirou 2× Calabresa" no histórico de `depois`.
 */
function retirar(
  depois: Pedido,
  {
    comanda,
    item,
    quantidade,
    motivo,
    por,
    perder,
  }: Retirada & {
    comanda: Pedido
    item: ItemPedido
    quantidade: number
    perder: (perda: Perda) => void
  },
): Pedido {
  const porque = motivoDaPerda(comanda, item, motivo)
  if (porque) perder({ item, quantidade, motivo: porque })
  return comEvento(depois, {
    tipo: "item-removido",
    em: new Date().toISOString(),
    ...autor(por),
    texto: `Tirou ${itensEmTexto([{ ...item, quantidade }])}`,
    ...(porque ? { motivo: porque } : {}),
  })
}

/**
 * O saldo zerou: a comanda fica concluída e paga. A forma do pedido é a do maior pagamento (o
 * primeiro, no empate), e o troco do pedido só vale quando houve um pagamento único em dinheiro.
 */
/**
 * Desconto, cortesia, item tirado ou transferido zerou o saldo de uma conta já paga em parte:
 * ela fecha.
 */
const quitou = (antes: Pedido, depois: Pedido, saldo = resumoDaConta(depois).saldo) =>
  EM_ANDAMENTO.includes(depois.status) &&
  depois.itens.length > 0 &&
  (depois.pagamentos?.length ?? 0) > 0 &&
  resumoDaConta(antes).saldo > 0 &&
  saldo === 0

function fechada(comanda: Pedido, agora: string, por: string | undefined): Pedido {
  const pagamentos = comanda.pagamentos ?? []
  const maior = pagamentos.reduce<PagamentoConta | undefined>(
    (atual, pagamento) => (!atual || pagamento.valor > atual.valor ? pagamento : atual),
    undefined,
  )
  const { trocoPara: _troco, ...semTroco } = comanda
  const [unico] = pagamentos
  return comEvento(
    {
      ...semTroco,
      status: "concluido",
      situacaoPagamento: "pago",
      pagoEm: agora,
      pagamento: maior?.forma ?? comanda.pagamento,
      ...(pagamentos.length === 1 && unico.recebido ? { trocoPara: unico.recebido } : {}),
    },
    { tipo: "fechada", em: agora, ...autor(por), texto: "Conta fechada" },
  )
}

/** A mesa pediu a conta: grava a hora e o evento, ou mantém a primeira hora. */
function comContaPedida(comanda: Pedido, por: string | undefined): Pedido {
  if (comanda.itens.length === 0) throw new Error("Lance algum item antes de pedir a conta.")
  if (comanda.contaPedidaEm) return comanda
  const agora = new Date().toISOString()
  return comEvento(
    { ...comanda, contaPedidaEm: agora },
    { tipo: "conta-pedida", em: agora, ...autor(por), texto: "Pediu a conta" },
  )
}

const semContaPedida = ({ contaPedidaEm: _contaPedidaEm, ...comanda }: Pedido): Pedido => comanda

/** Subtotal, desconto e total da comanda refeitos pela conta (com taxa e couvert). */
const recalcular = comTotais

/** A ação partiu da etapa que a tela mostrava; se outra aba mudou o pedido, recusa. */
function conferirEtapa(pedido: Pedido, de: StatusPedido) {
  if (pedido.status !== de) throw new Error("Este pedido já mudou de etapa. Atualize a tela.")
}

/** O que o pedido tira do estoque agora: nada se ainda não baixou ou foi cancelado. */
const consumoAtivo = (pedido: Pedido | undefined, produtos: Produto[]) =>
  pedido?.estoqueBaixado && pedido.status !== "cancelado"
    ? consumoDoPedido(pedido, produtos)
    : new Map<string, number>()

/** "2" na unidade; "1,5 kg" no quilo. */
const quantidadeEmTexto = (produto: Produto, quantidade: number) =>
  produto.unidade === "kg"
    ? `${quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
    : String(quantidade)

/**
 * Registra um movimento no estoque do produto: novo saldo, histórico e, com "esgotar ao
 * zerar", esgota no zero e devolve na entrada seguinte (só se foi o estoque que esgotou).
 * Os combos ligados ao produto acompanham.
 */
function movimentar(
  base: BaseLoja,
  produtoId: string,
  quantidade: number,
  extra: Omit<MovimentoEstoque, "id" | "produtoId" | "quantidade" | "saldo" | "criadoEm">,
): BaseLoja {
  const produto = base.produtos.find((item) => item.id === produtoId)
  if (!produto?.estoque) return base
  const saldo = saldoDepois(produto.estoque.quantidade, quantidade)
  let estoque = { ...produto.estoque, quantidade: saldo }
  let disponivel = produto.disponivel
  if (saldo <= 0 && estoque.esgotarAoZerar && disponivel) {
    disponivel = false
    estoque = { ...estoque, esgotadoPeloEstoque: true }
  } else if (saldo > 0 && estoque.esgotadoPeloEstoque) {
    disponivel = true
    const { esgotadoPeloEstoque: _, ...resto } = estoque
    estoque = resto
  }
  const novo: Produto = { ...produto, disponivel, estoque }
  const movimento: MovimentoEstoque = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    produtoId,
    quantidade,
    saldo,
    criadoEm: new Date().toISOString(),
    ...extra,
  }
  return {
    ...base,
    produtos: sincronizarOpcoes(
      base.produtos.map((item) => (item.id === produtoId ? novo : item)),
      novo,
      produto,
    ),
    movimentosEstoque: [...base.movimentosEstoque, movimento],
  }
}

/**
 * Leva ao estoque a diferença entre o que o pedido consumia antes e depois. Vale para
 * venda, comanda, cancelamento e pesagem. Com `conferir` (PDV e garçom), recusa sair
 * mais do que há.
 */
function aplicarEstoque(
  base: BaseLoja,
  antes: Pedido | undefined,
  depois: Pedido,
  { conferir = false, tipo }: { conferir?: boolean; tipo?: TipoMovimento } = {},
): BaseLoja {
  const consumiaAntes = consumoAtivo(antes, base.produtos)
  const consomeDepois = consumoAtivo(depois, base.produtos)
  let atual = base
  for (const produtoId of new Set([...consumiaAntes.keys(), ...consomeDepois.keys()])) {
    const movimento = saldoDepois(
      consumiaAntes.get(produtoId) ?? 0,
      -(consomeDepois.get(produtoId) ?? 0),
    )
    if (movimento === 0) continue
    const produto = atual.produtos.find((item) => item.id === produtoId) as Produto
    const saldo = produto.estoque?.quantidade ?? 0
    if (conferir && movimento < 0 && saldo + movimento < 0) {
      throw new Error(
        saldo <= 0
          ? `${produto.nome} está sem estoque.`
          : `Só restam ${quantidadeEmTexto(produto, saldo)} de ${produto.nome}.`,
      )
    }
    atual = movimentar(atual, produtoId, movimento, {
      tipo: tipo ?? (movimento < 0 ? "venda" : "devolucao"),
      pedidoId: depois.id,
    })
  }
  return atual
}

/** Por quanto tempo o servidor guarda a foto de uma movimentação (a tela oferece por 6 s). */
const PRAZO_DO_DESFAZER_MS = 10_000

/** As mesas e comandas envolvidas numa movimentação, na ordem dos ids (a que não existe, vazia). */
type Recorte = { mesas: (Mesa | null)[]; pedidos: (Pedido | null)[] }

type Foto = { ate: number; mesas: string[]; pedidos: number[]; antes: Recorte; depois: Recorte }

const recorte = (base: BaseLoja, mesas: string[], pedidos: number[]): Recorte => ({
  mesas: mesas.map((id) => base.mesas.find((mesa) => mesa.id === id) ?? null),
  pedidos: pedidos.map((id) => base.pedidos.find((pedido) => pedido.id === id) ?? null),
})

/**
 * A comanda de mesa aberta que a tela mostrava. Outra aba pode tê-la fechado: recusa sem mexer
 * em nada.
 */
function comandaAberta(base: BaseLoja, pedidoId: number): Pedido & { mesa: { numero: number } } {
  const comanda = base.pedidos.find((pedido) => pedido.id === pedidoId)
  if (!comanda?.mesa || comanda.tipo !== "mesa") throw new Error("Pedido não encontrado")
  if (!EM_ANDAMENTO.includes(comanda.status)) {
    throw new Error(
      `A comanda da mesa ${comanda.mesa.numero} não está mais aberta. Atualize a tela.`,
    )
  }
  return comanda as Pedido & { mesa: { numero: number } }
}

/**
 * A mesa livre que recebe a comanda: outra (nem a própria, nem uma junta a ela), sem bloqueio,
 * sem comanda e, se reservada agora, só com a confirmação.
 */
function mesaLivreParaReceber(
  base: BaseLoja,
  origem: Pedido,
  mesaId: string,
  confirmarReserva: boolean | undefined,
): Mesa {
  const mesa = base.mesas.find((item) => item.id === mesaId)
  if (!mesa) throw new Error("Mesa não encontrada")
  const doGrupo = [origem.mesa?.id, ...(origem.mesa?.juntadas ?? []).map((item) => item.id)]
  if (doGrupo.includes(mesa.id)) throw new Error("Escolha outra mesa.")
  if (mesa.bloqueio) throw new Error(`A mesa ${mesa.numero} está bloqueada.`)
  if (mesa.juntadaCom) {
    const principal = base.mesas.find((item) => item.id === mesa.juntadaCom)
    throw new Error(`A mesa ${mesa.numero} está junto com a mesa ${principal?.numero}.`)
  }
  if (comandaDa(base, mesa.id)) {
    throw new Error(`A mesa ${mesa.numero} já está aberta. Junte as mesas ou transfira os itens.`)
  }
  const reserva = reservaDaVez(base, mesa.id, new Date())
  if (reserva && !confirmarReserva) {
    throw new Error(
      `A mesa ${mesa.numero} está reservada às ${format(new Date(reserva.inicio), "HH:mm")}. Confirme para transferir.`,
    )
  }
  return mesa
}

/**
 * Pedido de um dia que já passou não fica aberto: entrega e comanda viram concluídas. A conta de
 * mesa só fecha recebendo: a comanda que alguém mexeu (tem histórico) continua aberta na virada
 * do dia. Só a da demonstração, intocada, fecha sozinha, com o resto pago na forma dela.
 */
function encerrar(antes: Pedido, momento: string): Pedido {
  const comandaAberta = antes.tipo === "mesa" && EM_ANDAMENTO.includes(antes.status)
  if (comandaAberta && antes.eventos?.length) return antes
  const { saldo } = resumoDaConta(antes)
  const pedido: Pedido =
    comandaAberta && antes.pagamentos?.length && saldo > 0
      ? {
          ...antes,
          pagamentos: [
            ...antes.pagamentos,
            {
              id: `pag-${antes.id}-resto`,
              forma: antes.pagamento as PagamentoMesa,
              valor: saldo,
              em: momento,
            },
          ],
        }
      : antes
  if (pedido.status === "aguardando-pagamento") {
    return comEtapa(
      { ...pedido, status: "cancelado", situacaoPagamento: "cancelado", atualizadoEm: momento },
      momento,
    )
  }
  if (!EM_ANDAMENTO.includes(pedido.status)) return pedido
  return comEtapa(
    {
      ...pedido,
      status: "concluido",
      atualizadoEm: momento,
      ...(pedido.situacaoPagamento === "na-entrega"
        ? { situacaoPagamento: "pago" as const, pagoEm: momento }
        : {}),
    },
    momento,
  )
}

/**
 * Servidor de demonstração do painel: uma base por segmento, guardada no IndexedDB
 * deste navegador. Na primeira vez gera 90 dias de pedidos; ao reabrir em outro dia,
 * completa os dias que faltam.
 */
export function criarServidor({ segmento, carregarCatalogo, espera = 250 }: OpcoesServidor) {
  const chave = `clickpedido-admin-dados:${segmento}`
  let carregando: Promise<BaseLoja> | undefined

  async function salvar(base: BaseLoja) {
    const guardado: Guardado = { versao: VERSAO, geradoEm: new Date().toISOString(), base }
    await set(chave, guardado)
  }

  async function doZero(): Promise<BaseLoja> {
    const agora = new Date()
    const carregado = await carregarCatalogo()
    // Custo nos produtos antes de gerar: cada item vendido guarda uma cópia dele.
    const catalogo = { ...carregado, produtos: semearCustos(carregado.produtos, segmento) }
    const pedidos = gerarPedidos({
      catalogo,
      segmento,
      de: subDays(startOfDay(agora), DIAS_DE_HISTORICO - 1),
      agora,
    })
    const estoque = semearEstoque({ catalogo, segmento, agora })
    const aberta = abrirMesas({
      ...catalogo,
      produtos: estoque.produtos,
      // O controle começa hoje: o saldo inicial já desconta os pedidos em andamento.
      pedidos: pedidos.map(marcarEmAndamento),
      movimentosEstoque: estoque.movimentos,
      reservas: [],
      espera: [],
      chamados: [],
    })
    // A demonstração abre com uma mesa livre sendo limpa há 3 min.
    const base = {
      ...aberta,
      mesas: aberta.mesas.map((mesa) =>
        catalogo.salao.limpeza && mesa.id === "mesa-9" && mesa.status === "livre"
          ? { ...mesa, limpezaDesde: addMinutes(agora, -3).toISOString() }
          : mesa,
      ),
    }
    await salvar(base)
    return base
  }

  async function completar({ geradoEm, base }: Guardado): Promise<BaseLoja> {
    const agora = new Date()
    if (isSameDay(new Date(geradoEm), agora)) return base
    const hoje = startOfDay(agora)
    const momento = agora.toISOString()
    const anteriores = base.pedidos.map((pedido) =>
      new Date(pedido.criadoEm) < hoje ? encerrar(pedido, momento) : pedido,
    )
    const ultimo = ultimoPedido({ ...base, pedidos: anteriores })
    const novos = gerarPedidos({
      catalogo: base,
      segmento,
      de: addDays(startOfDay(new Date(geradoEm)), 1),
      agora,
      ...(ultimo ? { ultimo } : {}),
      agendamentos: anteriores,
      // A comanda que continuou aberta ocupa a mesa dela e as juntadas a ela.
      mesasOcupadas: anteriores
        .filter((pedido) => pedido.tipo === "mesa" && EM_ANDAMENTO.includes(pedido.status))
        .flatMap((pedido) =>
          pedido.mesa
            ? [pedido.mesa.id, ...(pedido.mesa.juntadas ?? []).map((junta) => junta.id)]
            : [],
        ),
    })
    const completa = abrirMesas({
      ...base,
      pedidos: [...anteriores, ...novos.map(marcarEmAndamento)],
      reservas: base.reservas ?? [],
      espera: base.espera ?? [],
      chamados: base.chamados ?? [],
    })
    await salvar(completa)
    return completa
  }

  /** Versão 2 → 3: guarda a base migrada já, com o `geradoEm` de antes, e completa os dias que faltam. */
  async function migrar(guardado: Guardado): Promise<BaseLoja> {
    const base = migrarDaVersao3(guardado.base as unknown as BaseLojaV3)
    const migrado: Guardado = { versao: VERSAO, geradoEm: guardado.geradoEm, base }
    await set(chave, migrado)
    return completar(migrado)
  }

  /** Guarda a leitura em andamento; se ela falhar, a próxima chamada tenta de novo. */
  function lembrar(leitura: Promise<BaseLoja>): Promise<BaseLoja> {
    const guardada = leitura.catch((erro) => {
      if (carregando === guardada) carregando = undefined
      throw erro
    })
    carregando = guardada
    return guardada
  }

  async function carregar(): Promise<BaseLoja> {
    return (
      carregando ??
      lembrar(
        (async () => {
          const guardado = await get<Guardado>(chave)
          if (guardado?.versao === VERSAO) return completar(guardado)
          if (guardado?.versao === 3 && !guardado.base.salao) return migrar(guardado)
          return doZero()
        })(),
      )
    )
  }

  async function responder<T>(valor: T): Promise<T> {
    if (espera > 0) await new Promise((pronto) => setTimeout(pronto, espera))
    return structuredClone(valor)
  }

  /** Altera um pedido, guarda e devolve a versão nova. */
  async function alterar(
    id: number,
    mudar: (pedido: Pedido, base: BaseLoja) => Pedido,
    estoque?: { conferir?: boolean; tipo?: TipoMovimento },
    /** Depois do estoque do pedido: movimentos à parte (a perda do item preparado). */
    depois?: (base: BaseLoja, novo: Pedido) => BaseLoja,
  ): Promise<Pedido> {
    const base = await carregar()
    const indice = base.pedidos.findIndex((pedido) => pedido.id === id)
    if (indice < 0) throw new Error("Pedido não encontrado")
    const antes = base.pedidos[indice]
    const agora = new Date().toISOString()
    // Mudou de etapa: o histórico anota para onde foi e quando.
    const novo = comEtapa({ ...mudar(antes, base), atualizadoEm: agora }, agora)
    // O estoque acompanha o que o pedido passou a consumir (ou a devolver).
    const aplicado = aplicarEstoque(base, antes, novo, estoque)
    const comEstoque = depois ? depois(aplicado, novo) : aplicado
    const pedidos = comEstoque.pedidos.with(indice, novo)
    const atualizada = abrirMesas({ ...comEstoque, pedidos })
    // A conta da mesa foi paga agora (e não por um dia que virou): a mesa (e as que estavam
    // juntas a ela) espera a limpeza.
    const contaFechada = novo.tipo === "mesa" && !antes.pagoEm && novo.pagoEm
    const usadas = [novo.mesa?.id, ...(novo.mesa?.juntadas ?? []).map((junta) => junta.id)]
    await substituir(
      contaFechada && atualizada.salao.limpeza
        ? {
            ...atualizada,
            mesas: atualizada.mesas.map((mesa) =>
              usadas.includes(mesa.id) ? { ...mesa, limpezaDesde: novo.pagoEm } : mesa,
            ),
          }
        : atualizada,
    )
    return responder(novo)
  }

  /** O item precisa estar na comanda. */
  function conferirItem(comanda: Pedido, itemId: string) {
    if (!comanda.itens.some((item) => item.id === itemId)) {
      throw new Error("Item não encontrado na comanda")
    }
  }

  /** Altera a comanda aberta de uma mesa e refaz o total. */
  function alterarComanda(
    id: number,
    mudar: (comanda: Pedido, perder: (perda: Perda) => void, base: BaseLoja) => Pedido,
  ) {
    const perdas: Perda[] = []
    return alterar(
      id,
      (pedido, base) => {
        if (pedido.tipo !== "mesa" || !EM_ANDAMENTO.includes(pedido.status)) {
          throw new Error("Só a comanda aberta de uma mesa pode mudar.")
        }
        // Tirar a rodada da cozinha ou a que estava pronta acerta o status e o "Servir".
        const novo = recalcular(
          depoisDeTirar(
            pedido,
            mudar(pedido, (perda) => perdas.push(perda), base),
          ),
        )
        // O que já foi pago não volta sozinho: a conta não pode ficar menor que ele.
        const { pago, total, saldo, itens, cortesias, descontos } = resumoDaConta(novo)
        // O desconto em reais fica parado: tirar item ou dar cortesia pode deixá-lo acima dos itens.
        if (novo.status !== "cancelado" && descontos > reais(itens - cortesias)) {
          throw new Error(
            "O desconto passaria do valor dos itens. Tire ou diminua o desconto antes.",
          )
        }
        if (novo.status !== "cancelado" && pago > total) {
          throw new Error("A conta ficaria menor que o já pago. Estorne um pagamento antes.")
        }
        return quitou(pedido, novo, saldo)
          ? fechada(novo, new Date().toISOString(), novo.eventos?.at(-1)?.por)
          : novo
      },
      // O garçom não lança mais do que há.
      { conferir: true },
      // O que a cozinha preparou não volta: a venda desfeita sai de novo como perda.
      (base, novo) =>
        perdas.reduce((atual, { item, quantidade, motivo }) => {
          const parte = { ...novo, itens: [{ ...item, quantidade }] }
          let comPerda = atual
          for (const [produtoId, consumo] of consumoDoPedido(parte, atual.produtos)) {
            comPerda = movimentar(comPerda, produtoId, -consumo, {
              tipo: "perda",
              motivo,
              pedidoId: novo.id,
            })
          }
          return comPerda
        }, base),
    )
  }

  /** Troca uma mesa pelo que `mudar` devolve; recusa id que não existe. */
  async function mudarMesa(id: string, mudar: (mesa: Mesa, base: BaseLoja) => Mesa): Promise<Mesa> {
    const base = await carregar()
    const mesa = base.mesas.find((item) => item.id === id)
    if (!mesa) throw new Error("Mesa não encontrada")
    const nova = mudar(mesa, base)
    await substituir({ ...base, mesas: base.mesas.map((item) => (item.id === id ? nova : item)) })
    return responder(nova)
  }

  async function mudarProduto(id: string, mudar: (produto: Produto) => Produto): Promise<Produto> {
    const base = await carregar()
    const produto = base.produtos.find((item) => item.id === id)
    if (!produto) throw new Error("Produto não encontrado")
    const novo = mudar(produto)
    await substituir({
      ...base,
      // Combos: as opções ligadas a este produto acompanham o nome e a disponibilidade.
      produtos: sincronizarOpcoes(
        base.produtos.map((item) => (item.id === id ? novo : item)),
        novo,
        produto,
      ),
    })
    return responder(novo)
  }

  /**
   * Entrada, saída ou contagem feita na tela de estoque: confere, registra no histórico e
   * devolve o produto com o saldo novo.
   */
  async function movimentoAMao(
    produtoId: string,
    tipo: "entrada" | "saida" | "contagem",
    informado: number,
    montar: (produto: Produto) => {
      quantidade: number
      extra: Partial<MovimentoEstoque>
      custo?: number
      produto: Produto
    },
    motivo?: string,
  ): Promise<Produto> {
    const base = await carregar()
    const produto = base.produtos.find((item) => item.id === produtoId)
    if (!produto) throw new Error("Produto não encontrado")
    if (!produto.estoque?.controlar) {
      throw new Error(`Ligue o controle de estoque de ${produto.nome} primeiro.`)
    }
    const erro = errosDoMovimento({
      tipo,
      quantidade: informado,
      unidade: produto.unidade,
      ...(motivo !== undefined ? { motivo } : {}),
    })
    if (erro) throw new Error(erro)
    const { quantidade, extra, custo } = montar(produto)
    const comCusto =
      custo === undefined
        ? base
        : {
            ...base,
            produtos: base.produtos.map((item) =>
              item.id === produtoId ? { ...item, custo } : item,
            ),
          }
    const nova = movimentar(comCusto, produtoId, quantidade, { tipo, ...extra })
    await substituir(nova)
    return responder(nova.produtos.find((item) => item.id === produtoId) as Produto)
  }

  /** Número do pedido criado aqui: o id, ou o próximo do mês onde a numeração é mensal. */
  const numeroNovo = (base: BaseLoja, id: number) =>
    proximoNumero({
      id,
      mensal: temRecurso(segmento, "numeroMensal"),
      ultimo: ultimoPedido(base),
      agora: new Date(),
    })

  /** Comanda nova da mesa, aberta agora. Sem itens, fica "pronto" e não passa pela cozinha. */
  function comandaNova(
    base: BaseLoja,
    mesa: Mesa,
    {
      id,
      agora,
      cliente,
      garcom,
      pessoas,
      itens,
      enviarParaCozinha,
    }: {
      id: number
      agora: string
      cliente?: string | undefined
      garcom?: string | undefined
      pessoas?: number
      itens: ItemPedido[]
      enviarParaCozinha: boolean
    },
  ): Pedido {
    return {
      id,
      numero: numeroNovo(base, id),
      token: crypto.randomUUID(),
      origem: "garcom",
      tipo: "mesa",
      status: enviarParaCozinha ? "recebido" : "pronto",
      cliente: { nome: cliente || mesa.nome, telefone: base.loja.telefone },
      mesa: {
        id: mesa.id,
        numero: mesa.numero,
        ...(garcom ? { garcom } : {}),
        ...(pessoas !== undefined ? { pessoas } : {}),
      },
      itens,
      subtotal: 0,
      desconto: 0,
      taxaEntrega: 0,
      total: 0,
      pagamento: "dinheiro",
      situacaoPagamento: "na-entrega",
      criadoEm: agora,
      atualizadoEm: agora,
      historico: [],
      enviarParaCozinha,
      // Cada lançamento do garçom tira do estoque.
      estoqueBaixado: true,
      // Taxa e couvert do salão de agora: mudar a configuração não mexe na conta aberta.
      ...(base.salao.taxaServico.ativa
        ? { taxaServico: { percentual: base.salao.taxaServico.percentual } }
        : {}),
      ...(base.salao.couvert.ativo ? { couvert: { porPessoa: base.salao.couvert.porPessoa } } : {}),
    }
  }

  /** Troca a base inteira (já carregada) e guarda. */
  async function substituir(nova: BaseLoja) {
    carregando = Promise.resolve(nova)
    await salvar(nova)
  }

  /**
   * Nome, preço e opções de um item lançado. Do cardápio, o preço sai do produto
   * (balcão quando o segmento usa), dos adicionais e do "grátis até"; as escolhas
   * passam pelo mínimo e o máximo de cada grupo.
   */
  function precificar(
    base: BaseLoja,
    lancado: ItemLancado,
  ): Pick<ItemPedido, "produtoId" | "nome" | "precoUnitario" | "custoUnitario" | "opcoes"> & {
    produtosDasOpcoes: string[]
  } {
    if ("avulso" in lancado) {
      const nome = lancado.avulso.nome.trim().slice(0, 80)
      if (!nome) throw new Error("Informe o nome do item avulso.")
      if (!(lancado.avulso.preco > 0 && lancado.avulso.preco <= 9999)) {
        throw new Error("Informe um preço válido.")
      }
      return {
        produtoId: null,
        nome,
        precoUnitario: reais(lancado.avulso.preco),
        opcoes: [],
        produtosDasOpcoes: [],
      }
    }
    const produto = base.produtos.find((item) => item.id === lancado.produtoId)
    if (!produto) throw new Error("Produto não encontrado")
    if (!produto.disponivel) throw new Error(`${produto.nome} está esgotado.`)
    const grupos = produto.grupos.filter((grupo) => grupo.ativo)
    const validas = new Map(
      grupos.map((grupo) => [
        grupo.id,
        new Set(grupo.itens.filter((item) => item.ativo).map((item) => item.id)),
      ]),
    )
    for (const [grupoId, ids] of Object.entries(lancado.escolhas)) {
      if (ids.some((opcao) => !validas.get(grupoId)?.has(opcao))) {
        throw new Error(`${produto.nome}: opção inválida.`)
      }
      // Combo: a opção que é outro produto só vale enquanto ele existe.
      const grupo = grupos.find((item) => item.id === grupoId)
      for (const opcao of grupo?.itens.filter((item) => ids.includes(item.id)) ?? []) {
        if (opcao.produtoId && !base.produtos.some((item) => item.id === opcao.produtoId)) {
          throw new Error(`${produto.nome}: ${opcao.nome} não está mais no cardápio.`)
        }
      }
    }
    const [erro] = Object.values(errosDasEscolhas(grupos, lancado.escolhas))
    if (erro) throw new Error(`${produto.nome}: ${erro}`)
    // Combos: os produtos ligados às opções escolhidas saem do estoque junto.
    const produtosDasOpcoes = grupos.flatMap((grupo) =>
      grupo.itens.flatMap((opcao) =>
        opcao.produtoId && lancado.escolhas[grupo.id]?.includes(opcao.id) ? [opcao.produtoId] : [],
      ),
    )
    return {
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: precoComOpcoes(precoDeBalcao(produto, segmento), grupos, lancado.escolhas),
      // A cópia do custo de agora: a margem do passado não muda quando o custo mudar.
      ...(produto.custo !== undefined ? { custoUnitario: produto.custo } : {}),
      opcoes: resumoDasOpcoes(grupos, lancado.escolhas),
      produtosDasOpcoes,
    }
  }

  /** Serviços do agendamento: existem e estão disponíveis. */
  function servicosDo(base: BaseLoja, ids: string[]) {
    if (ids.length === 0) throw new Error("Escolha pelo menos um serviço.")
    return ids.map((id) => {
      const produto = base.produtos.find((item) => item.id === id)
      if (!produto) throw new Error("Serviço não encontrado")
      if (!produto.ativo || !produto.disponivel)
        throw new Error(`${produto.nome} está indisponível.`)
      return produto
    })
  }

  const duracaoDe = (servicos: Produto[]) =>
    servicos.reduce((soma, servico) => soma + (servico.duracaoMin ?? 60), 0)

  /** Confere se o horário cabe na agenda e diz o motivo quando não cabe. */
  function conferirHorario(base: BaseLoja, inicio: Date, duracaoMin: number, ignorarId?: number) {
    const dele = expediente(inicio, base.loja.horarios)
    if (!dele) throw new Error("O salão não abre neste dia.")
    const agora = new Date()
    if (inicio < agora) throw new Error("Esse horário já passou.")
    const fim = inicio.getTime() + duracaoMin * 60_000
    const noIntervalo = (inicio.getTime() - dele.abre.getTime()) % (INTERVALO_MIN * 60_000) === 0
    if (inicio < dele.abre || fim > dele.fecha.getTime() || !noIntervalo) {
      throw new Error("Fora do horário de atendimento.")
    }
    const livres = horariosLivres({
      dia: inicio,
      duracaoMin,
      agendamentos: base.pedidos,
      horarios: base.loja.horarios,
      capacidade: base.loja.capacidadeAtendimentos ?? 1,
      agora,
      ...(ignorarId ? { ignorarId } : {}),
    })
    if (!livres.some((livre) => livre.getTime() === inicio.getTime())) {
      throw new Error("Esse horário está cheio.")
    }
  }

  async function mudarLoja(mudanca: Partial<ConfigLoja>): Promise<ConfigLoja> {
    const base = await carregar()
    const loja = { ...base.loja, ...mudanca }
    await substituir({ ...base, loja })
    return responder(loja)
  }

  /** A última conta de mesa fechada (paga) da mesa, pela hora do pagamento (no empate, a mais nova). */
  const ultimaFechada = (base: BaseLoja, mesaId: string) =>
    base.pedidos
      .filter(
        (pedido) =>
          pedido.tipo === "mesa" &&
          pedido.mesa?.id === mesaId &&
          pedido.status === "concluido" &&
          pedido.pagoEm,
      )
      .toSorted(
        (a, b) => Date.parse(b.pagoEm as string) - Date.parse(a.pagoEm as string) || b.id - a.id,
      )[0]

  /**
   * Por que a conta não pode ser reaberta agora, ou `null`: só a última conta fechada da mesa,
   * no mesmo dia do pagamento, com a mesa livre ou em limpeza (Q37). A conta que tinha mesas
   * juntadas reabre junta: cada uma delas também tem que estar livre.
   */
  function porQueNaoReabre(base: BaseLoja, conta: Pedido, agora: Date): string | null {
    const mesa = base.mesas.find((item) => item.id === conta.mesa?.id)
    if (conta.tipo !== "mesa" || !mesa || conta.status !== "concluido" || !conta.pagoEm) {
      return "Só a conta de mesa fechada pode ser reaberta."
    }
    if (!isSameDay(new Date(conta.pagoEm), agora)) return "Só dá para reabrir a conta no mesmo dia."
    if (ultimaFechada(base, mesa.id)?.id !== conta.id) {
      return "Só dá para reabrir a última conta da mesa."
    }
    if (mesa.bloqueio) return `A mesa ${mesa.numero} está bloqueada.`
    if (comandaDa(base, mesa.id)) return `A mesa ${mesa.numero} já está aberta.`
    for (const junta of conta.mesa?.juntadas ?? []) {
      const secundaria = base.mesas.find((item) => item.id === junta.id)
      const porQue = !secundaria
        ? `A mesa ${junta.numero} foi excluída.`
        : secundaria.bloqueio
          ? `A mesa ${secundaria.numero} está bloqueada.`
          : secundaria.juntadaCom
            ? `A mesa ${secundaria.numero} já está junto com a mesa ${base.mesas.find((item) => item.id === secundaria.juntadaCom)?.numero}.`
            : comandaDa(base, secundaria.id)
              ? `A mesa ${secundaria.numero} já está aberta.`
              : null
      if (porQue) return `${porQue} Reabrir não junta de novo.`
    }
    return null
  }

  /**
   * Um pagamento contra o saldo: confere forma, cartão, itens e valor, grava o pagamento e o
   * evento, e fecha a conta quando o saldo zera. Sem valor nem itens, paga o saldo.
   */
  function receber(comanda: Pedido, pagamento: Pagamento): Pedido {
    conferirPagamento(pagamento.forma)
    if (comanda.itens.length === 0) throw new Error("A comanda está vazia.")
    if (resumoDaConta(comanda).saldo === 0) {
      throw new Error("Não há saldo a receber. Feche a conta.")
    }
    const cartao = pagamento.forma === "cartao-na-entrega" ? pagamento.cartao : undefined
    if (pagamento.forma === "cartao-na-entrega" && cartao !== "credito" && cartao !== "debito") {
      throw new Error("Escolha crédito ou débito.")
    }
    // Por item, o valor sai dos itens marcados (com a taxa deles).
    const itens = pagamento.itens?.length ? [...new Set(pagamento.itens)] : undefined
    // O desconto é da conta: por item, cada item teria de levar a parte dele (fica para depois).
    if (itens && comanda.descontoConta) {
      throw new Error("Com desconto na conta, divida igualmente ou receba um valor.")
    }
    if (itens) {
      const pagos = itensPagos(comanda)
      for (const itemId of itens) {
        conferirItem(comanda, itemId)
        if (pagos.has(itemId)) throw new Error("Esse item já foi pago.")
      }
    }
    const pedido = itens
      ? valorDosItens(comanda, itens)
      : (pagamento.valor ?? resumoDaConta(comanda).saldo)
    if (!(pedido > 0) || !emCentavosExatos(pedido)) {
      throw new Error("Informe um valor acima de zero.")
    }
    const { saldo } = resumoDaConta(comanda)
    const dinheiro = pagamento.forma === "dinheiro"
    if (pedido > saldo && !dinheiro) {
      throw new Error(`O valor passa do saldo de ${emReais(saldo)}.`)
    }
    // No dinheiro, o que passa do saldo é troco.
    const valor = Math.min(pedido, saldo)
    const recebido = dinheiro ? (pagamento.recebido ?? pedido) : valor
    if (!Number.isFinite(recebido) || !emCentavosExatos(recebido)) {
      throw new Error("Informe um valor recebido válido.")
    }
    if (recebido < pedido) throw new Error("O valor recebido é menor que o da parte.")
    const troco = trocoDoPagamento({ valor, saldo, recebido })
    const agora = new Date().toISOString()
    const novo: PagamentoConta = {
      id: `pag-${crypto.randomUUID().slice(0, 8)}`,
      forma: pagamento.forma,
      valor,
      em: agora,
      ...autor(pagamento.por),
      ...(dinheiro && troco > 0 ? { recebido, troco } : {}),
      ...(cartao ? { cartao } : {}),
      ...(itens ? { itens } : {}),
    }
    const paga = comEvento(
      { ...comanda, pagamentos: [...(comanda.pagamentos ?? []), novo] },
      {
        tipo: "pagamento",
        em: agora,
        ...autor(pagamento.por),
        texto: [
          `${rotuloDoPagamento(novo)} ${emReais(novo.valor)}`,
          novo.troco ? `troco ${emReais(novo.troco)}` : null,
          itens ? plural(itens.length, "item", "itens") : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    )
    return resumoDaConta(paga).saldo > 0 ? paga : fechada(paga, agora, pagamento.por)
  }

  /** As fotos do desfazer: o antes e o depois das mesas e comandas de cada movimentação. */
  const fotos = new Map<string, Foto>()

  /**
   * A base guardada, e não a desta aba: outra aba pode ter mudado a mesa. As movimentações e o
   * desfazer partem daqui (ponto de atenção 2).
   */
  function reler(): Promise<BaseLoja> {
    carregando = undefined
    return carregar()
  }

  /**
   * Faz uma movimentação sobre a base relida, guarda e tira a foto para o desfazer: as mesas e
   * comandas envolvidas, antes e depois. Devolve a base nova e o id da foto.
   */
  async function mover(
    fazer: (base: BaseLoja) => { nova: BaseLoja; mesas: string[]; pedidos: number[] },
  ): Promise<{ base: BaseLoja; desfazer: string }> {
    const base = await reler()
    const { nova, mesas, pedidos } = fazer(base)
    const final = abrirMesas(nova)
    await substituir(final)
    const desfazer = `desfazer-${crypto.randomUUID().slice(0, 8)}`
    fotos.set(desfazer, {
      ate: Date.now() + PRAZO_DO_DESFAZER_MS,
      mesas,
      pedidos,
      antes: recorte(base, mesas, pedidos),
      depois: recorte(final, mesas, pedidos),
    })
    return { base: final, desfazer }
  }

  return {
    async base(): Promise<BaseLoja> {
      return responder(await carregar())
    },

    /** Só a configuração da loja, sem copiar os pedidos. */
    async loja(): Promise<ConfigLoja> {
      return responder((await carregar()).loja)
    },

    /** A chave abre ou fecha na mão: a loja passa para o controle manual (a tela avisa antes). */
    definirAberta(aberta: boolean) {
      return mudarLoja({ aberta, controleAutomatico: false })
    },

    /** Liga ou desliga só a entrega: a loja continua aberta para retirada e salão. */
    definirEntrega(aceitaEntrega: boolean) {
      return mudarLoja({ aceitaEntrega })
    },

    pedidos: {
      async listar({ de, ate, status, concluidosEm }: FiltroPedidos = {}): Promise<Pedido[]> {
        const inicio = de ? startOfDay(de).getTime() : -Infinity
        const fim = ate ? endOfDay(ate).getTime() : Infinity
        const { pedidos } = await carregar()
        const filtrados = pedidos.filter((pedido) => {
          const criado = Date.parse(pedido.criadoEm)
          return (
            criado >= inicio &&
            criado <= fim &&
            (!status || status.includes(pedido.status)) &&
            (!concluidosEm ||
              (pedido.status === "concluido" &&
                isSameDay(new Date(pedido.atualizadoEm), concluidosEm)))
          )
        })
        return responder(filtrados.toReversed())
      },

      async buscar(id: number): Promise<Pedido | undefined> {
        const { pedidos } = await carregar()
        return responder(pedidos.find((pedido) => pedido.id === id))
      },

      /** `de`: a etapa que a tela mostrava. Outra aba pode ter mudado o pedido antes. */
      avancar(id: number, de: StatusPedido) {
        return alterar(id, (pedido) => {
          conferirEtapa(pedido, de)
          const proximo = proximoStatus(pedido.tipo, pedido.status)
          if (!proximo) throw new Error("Este pedido não tem próxima etapa")
          const pagoAgora = proximo === "concluido" && pedido.situacaoPagamento === "na-entrega"
          const avancado: Pedido = {
            ...pedido,
            status: proximo,
            ...(pagoAgora
              ? { situacaoPagamento: "pago" as const, pagoEm: new Date().toISOString() }
              : {}),
          }
          // A cozinha terminou a rodada da mesa: há o que servir (fica a hora mais antiga).
          if (pedido.tipo !== "mesa" || proximo !== "pronto") return avancado
          const agora = new Date().toISOString()
          const [rodada] = itensDaCozinha(pedido).atuais
          return comEvento(
            { ...avancado, servirDesde: pedido.servirDesde ?? agora },
            {
              tipo: "pronta",
              em: agora,
              texto: `A cozinha terminou a rodada ${rodada?.rodada ?? 1}`,
            },
          )
        })
      },

      /** `motivo` é opcional: quem está com pressa cancela sem escolher. */
      cancelar(id: number, de: StatusPedido, motivo?: MotivoCancelamento) {
        return alterar(id, (pedido) => {
          conferirEtapa(pedido, de)
          if (pedido.status === "concluido")
            throw new Error("Pedido concluído não pode ser cancelado")
          // A comanda aberta tem motivo, perda e histórico: sai por mesas.cancelarComanda (Q36).
          if (pedido.tipo === "mesa" && pedido.mesa) {
            throw new Error("Cancele a comanda pela tela de Mesas.")
          }
          return {
            ...pedido,
            status: "cancelado",
            situacaoPagamento: pedido.situacaoPagamento === "pago" ? "pago" : "cancelado",
            // O que saiu do estoque volta (o alterar leva a diferença).
            estoqueBaixado: false,
            ...(motivo ? { motivoCancelamento: motivo } : {}),
          }
        })
      },

      marcarPago(id: number) {
        return alterar(id, (pedido) => {
          if (pedido.status === "cancelado") {
            throw new Error("Pedido cancelado não recebe pagamento.")
          }
          if (pedido.situacaoPagamento === "pago") throw new Error("Este pedido já está pago.")
          // A comanda aberta tem saldo, troco e histórico: recebe-se por mesas.pagar.
          if (pedido.tipo === "mesa" && pedido.mesa && EM_ANDAMENTO.includes(pedido.status)) {
            throw new Error("Receba a conta pela tela de Mesas.")
          }
          if (faltaPesar(pedido)) throw new Error("Pese o pedido antes de receber.")
          return {
            ...pedido,
            situacaoPagamento: "pago",
            pagoEm: new Date().toISOString(),
            // Pago online, o pedido entra na loja e o estoque sai, mesmo sem saldo.
            ...(pedido.status === "aguardando-pagamento"
              ? { status: "recebido" as const, estoqueBaixado: true }
              : {}),
          }
        })
      },

      /** Demonstração ao vivo: chega um pedido novo agora. */
      async simular(): Promise<Pedido> {
        const base = await carregar()
        const agora = new Date()
        const ultimo = ultimoPedido(base)
        const novo = {
          ...gerarPedidoAgora({
            catalogo: base,
            segmento,
            agora,
            ...(ultimo ? { ultimo } : {}),
            agendamentos: base.pedidos,
            semente: agora.getTime() + base.pedidos.length,
          }),
          // A semente sai da hora: o token do pedido real não pode ser previsível.
          token: crypto.randomUUID(),
        }
        // Recebido, o estoque sai na hora; aguardando pagamento online, só quando pagar.
        const chegou: Pedido =
          novo.status === "aguardando-pagamento" ? novo : { ...novo, estoqueBaixado: true }
        const comEstoque = aplicarEstoque(base, undefined, chegou)
        await substituir({ ...comEstoque, pedidos: [...comEstoque.pedidos, chegou] })
        return responder(chegou)
      },

      /** Açougue: o peso da balança (em gramas, por item) refaz os valores do pedido. */
      registrarPesagem(id: number, pesos: Record<string, number>) {
        return alterar(
          id,
          (pedido) => {
            if (pedido.status === "cancelado" || pedido.status === "concluido") {
              throw new Error("Pedido encerrado não muda de valor.")
            }
            const pesagem = calcularPesagem(pedido, pesos)
            return {
              ...pedido,
              itens: pesagem.itens,
              subtotal: pesagem.subtotal,
              total: pesagem.novoTotal,
              pesagem: {
                totalEstimado: pesagem.totalEstimado,
                diferenca: pesagem.diferenca,
                pesadoEm: new Date().toISOString(),
              },
            }
          },
          { tipo: "pesagem" },
        )
      },

      /** O cupom saiu: guarda a hora, que aparece como "Impresso às". */
      marcarImpresso(id: number) {
        return alterar(id, (pedido) => ({ ...pedido, impressoEm: new Date().toISOString() }))
      },

      atribuirMotoboy(id: number, motoboyId: string) {
        return alterar(id, (pedido, base) => {
          if (pedido.tipo !== "entrega") throw new Error("Só pedido de entrega tem motoboy")
          const motoboy = base.motoboys.find((item) => item.id === motoboyId && item.ativo)
          if (!motoboy) throw new Error("Motoboy não encontrado ou inativo")
          return { ...pedido, motoboyId }
        })
      },
    },

    produtos: {
      /** Na ordem do cardápio: categoria, depois a ordem do produto e o nome. */
      async listar(): Promise<Produto[]> {
        const { produtos, categorias } = await carregar()
        const ordemDa = new Map(categorias.map((categoria) => [categoria.id, categoria.ordem]))
        return responder(
          produtos.toSorted(
            (a, b) =>
              (ordemDa.get(a.categoriaId) ?? 0) - (ordemDa.get(b.categoriaId) ?? 0) ||
              a.ordem - b.ordem ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          ),
        )
      },

      /**
       * Cria ou atualiza pelo id. Confere com o mesmo esquema do formulário; o esquema só
       * valida (os campos que ele não conhece, como a ordem, são guardados como vieram).
       */
      async salvar(produto: Produto): Promise<Produto> {
        const conferido = esquemaProduto(segmento).safeParse(produto)
        if (!conferido.success) throw new Error(conferido.error.issues[0].message)
        const base = await carregar()
        if (!base.categorias.some((categoria) => categoria.id === produto.categoriaId)) {
          throw new Error("Escolha uma categoria que exista.")
        }
        const anterior = base.produtos.find((item) => item.id === produto.id)
        const produtos = sincronizarOpcoes(
          anterior
            ? base.produtos.map((item) => (item.id === produto.id ? produto : item))
            : [...base.produtos, produto],
          produto,
          anterior,
        )
        await substituir({ ...base, produtos })
        return responder(produto)
      },

      alternar(id: string, campo: "disponivel" | "ativo" | "destaque") {
        return mudarProduto(id, (produto) => {
          const mudado = { ...produto, [campo]: !produto[campo] }
          // Mexeu na mão: a próxima entrada não reativa sozinha.
          if (campo !== "disponivel" || !produto.estoque?.esgotadoPeloEstoque) return mudado
          const { esgotadoPeloEstoque: _, ...estoque } = produto.estoque
          return { ...mudado, estoque }
        })
      },

      /** Preço editado na própria linha da lista. */
      definirPreco(id: string, preco: number) {
        return mudarProduto(id, (produto) => {
          if (!(preco > 0 && preco <= 9999)) throw new Error("Informe um preço válido.")
          return { ...produto, preco: Math.round(preco * 100) / 100 }
        })
      },

      /** A cópia entra logo depois do original, na mesma categoria. */
      async copiar(id: string): Promise<Produto> {
        const base = await carregar()
        const original = base.produtos.find((produto) => produto.id === id)
        if (!original) throw new Error("Produto não encontrado")
        const copia = { ...copiarProduto(original, novoId("prod")), ordem: original.ordem + 1 }
        const produtos = [
          ...base.produtos.map((produto) =>
            produto.categoriaId === original.categoriaId && produto.ordem > original.ordem
              ? { ...produto, ordem: produto.ordem + 1 }
              : produto,
          ),
          copia,
        ]
        await substituir({ ...base, produtos })
        return responder(copia)
      },

      /** Nos combos, a opção que era este produto fica desligada e sem a ligação. */
      async excluir(id: string): Promise<void> {
        const base = await carregar()
        await substituir({
          ...base,
          produtos: soltarOpcoesDe(
            base.produtos.filter((produto) => produto.id !== id),
            id,
          ),
        })
      },

      /** Os outros produtos da categoria recebem as opções deste. Devolve quantos mudaram. */
      async replicarOpcoes(id: string): Promise<number> {
        const base = await carregar()
        const origem = base.produtos.find((produto) => produto.id === id)
        if (!origem) throw new Error("Produto não encontrado")
        const produtos = replicarOpcoes(base.produtos, id, novoId("opc"))
        await substituir({ ...base, produtos })
        return base.produtos.filter(
          (produto) => produto.id !== id && produto.categoriaId === origem.categoriaId,
        ).length
      },
    },

    categorias: {
      async listar(): Promise<Categoria[]> {
        return responder((await carregar()).categorias.toSorted((a, b) => a.ordem - b.ordem))
      },

      /** Categoria nova entra no fim do cardápio. */
      async criar(nome: string): Promise<Categoria> {
        const limpo = nome.trim()
        if (!limpo) throw new Error("Informe o nome da categoria.")
        const base = await carregar()
        const categoria: Categoria = {
          id: novoId("cat")(),
          nome: limpo.slice(0, 60),
          ordem: Math.max(0, ...base.categorias.map((item) => item.ordem)) + 1,
          ativa: true,
        }
        await substituir({ ...base, categorias: [...base.categorias, categoria] })
        return responder(categoria)
      },

      async salvar(categoria: Categoria): Promise<Categoria> {
        const nome = categoria.nome.trim()
        if (!nome) throw new Error("Informe o nome da categoria.")
        const base = await carregar()
        if (!base.categorias.some((item) => item.id === categoria.id)) {
          throw new Error("Categoria não encontrada")
        }
        const salva = { ...categoria, nome: nome.slice(0, 60) }
        await substituir({
          ...base,
          categorias: base.categorias.map((item) => (item.id === categoria.id ? salva : item)),
        })
        return responder(salva)
      },

      async reordenar(de: string, para: string): Promise<Categoria[]> {
        const base = await carregar()
        const categorias = reordenar(base.categorias, de, para)
        await substituir({ ...base, categorias })
        return responder(categorias)
      },

      async excluir(id: string): Promise<void> {
        const base = await carregar()
        if (base.produtos.some((produto) => produto.categoriaId === id)) {
          throw new Error("Mova ou exclua os produtos antes.")
        }
        await substituir({ ...base, categorias: base.categorias.filter((item) => item.id !== id) })
      },
    },

    pdv: {
      /**
       * Venda no balcão: nasce paga, como retirada. Os itens chegam como no Garçom: do
       * cardápio vêm só as escolhas e o preço é calculado aqui (balcão, adicionais e
       * "grátis até"); só o avulso traz preço digitado. Subtotal, desconto e total também
       * são refeitos aqui: nenhum valor da tela é usado.
       */
      async finalizar(venda: VendaPdv): Promise<Pedido> {
        conferirPagamento(venda.pagamento)
        // Arredonda antes de filtrar: 0,4 vira 0 e fica de fora, em vez de entrar zerado.
        const lancados = venda.itens
          .map((item) => ({ ...item, quantidade: Math.round(item.quantidade) }))
          .filter((item) => Number.isFinite(item.quantidade) && item.quantidade >= 1)
        if (lancados.length === 0) throw new Error("Inclua pelo menos um item.")

        const base = await carregar()
        const itens = lancados.map((lancado) => {
          const { produtoId, nome, precoUnitario, custoUnitario, opcoes, produtosDasOpcoes } =
            precificar(base, lancado)
          const observacao = lancado.observacao?.trim().slice(0, 140)
          return {
            chave: "",
            produtoId,
            nome,
            quantidade: Math.min(lancado.quantidade, 999),
            precoUnitario,
            ...(custoUnitario !== undefined ? { custoUnitario } : {}),
            opcoes,
            produtosDasOpcoes,
            ...(observacao ? { observacao } : {}),
          }
        })
        const totais = totaisDaVenda(itens, venda.desconto)
        if (descontoPassaDoSubtotal(totais.subtotal, venda.desconto)) {
          throw new Error("O desconto passa do subtotal.")
        }
        if (
          venda.pagamento === "dinheiro" &&
          (venda.valorRecebido ?? totais.total) < totais.total
        ) {
          throw new Error("O valor recebido é menor que o total.")
        }

        const agora = new Date().toISOString()
        const clienteNome = venda.clienteNome?.trim().slice(0, 80)
        const observacao = venda.observacao?.trim().slice(0, 280)
        const id = proximoId(base)
        const pedido: Pedido = comEtapa(
          {
            id,
            numero: numeroNovo(base, id),
            token: crypto.randomUUID(),
            origem: "pdv",
            tipo: "retirada",
            status: venda.concluida ? "concluido" : "recebido",
            cliente: { nome: clienteNome || "Venda no balcão", telefone: base.loja.telefone },
            itens: itens.map((item, indice) => ({
              id: `${id}-${indice + 1}`,
              produtoId: item.produtoId,
              nome: item.nome,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              ...(item.custoUnitario !== undefined ? { custoUnitario: item.custoUnitario } : {}),
              opcoes: item.opcoes,
              ...(item.produtosDasOpcoes.length > 0
                ? { produtosDasOpcoes: item.produtosDasOpcoes }
                : {}),
              ...(item.observacao ? { observacao: item.observacao } : {}),
              total: reais(item.precoUnitario * item.quantidade),
            })),
            subtotal: totais.subtotal,
            desconto: totais.desconto,
            taxaEntrega: 0,
            total: totais.total,
            pagamento: venda.pagamento,
            situacaoPagamento: "pago",
            pagoEm: agora,
            ...(venda.pagamento === "dinheiro" && venda.valorRecebido
              ? { trocoPara: venda.valorRecebido }
              : {}),
            ...(observacao ? { observacao } : {}),
            criadoEm: agora,
            atualizadoEm: agora,
            historico: [],
            enviarParaCozinha: !venda.concluida,
            // A venda fechada no balcão já tira do estoque.
            estoqueBaixado: true,
          },
          agora,
        )
        const comEstoque = aplicarEstoque(base, undefined, pedido, { conferir: true })
        await substituir({ ...comEstoque, pedidos: [...comEstoque.pedidos, pedido] })
        return responder(pedido)
      },

      /** Vendas do PDV de hoje, da mais nova para a mais antiga. */
      async ultimasVendas(): Promise<Pedido[]> {
        const hoje = startOfDay(new Date()).getTime()
        const { pedidos } = await carregar()
        return responder(
          pedidos
            .filter(
              (pedido) =>
                pedido.origem === "pdv" &&
                pedido.status !== "cancelado" &&
                Date.parse(pedido.criadoEm) >= hoje,
            )
            .toReversed()
            .slice(0, 12),
        )
      },
    },

    agendamentos: {
      /** Horários livres do dia para os serviços escolhidos, em ISO. */
      async horarios({
        dia,
        servicos,
        ignorarId,
      }: {
        dia: Date
        servicos: string[]
        ignorarId?: number
      }): Promise<string[]> {
        const base = await carregar()
        const livres = horariosLivres({
          dia,
          duracaoMin: duracaoDe(servicosDo(base, servicos)),
          agendamentos: base.pedidos,
          horarios: base.loja.horarios,
          capacidade: base.loja.capacidadeAtendimentos ?? 1,
          agora: new Date(),
          ...(ignorarId ? { ignorarId } : {}),
        })
        return responder(livres.map((livre) => livre.toISOString()))
      },

      /** Marca um atendimento: preço e duração dos serviços; pago no salão. */
      async criar(novo: NovoAgendamento): Promise<Pedido> {
        const nome = novo.cliente.nome.trim().slice(0, 80)
        if (!nome) throw new Error("Informe o nome da cliente.")
        conferirPagamento(novo.pagamento)
        const base = await carregar()
        const servicos = servicosDo(base, novo.servicos)
        const duracaoMin = duracaoDe(servicos)
        const inicio = new Date(novo.inicio)
        conferirHorario(base, inicio, duracaoMin)

        const agora = new Date().toISOString()
        const id = proximoId(base)
        const itens: ItemPedido[] = servicos.map((servico, indice) => ({
          id: `${id}-${indice + 1}`,
          produtoId: servico.id,
          nome: servico.nome,
          quantidade: 1,
          precoUnitario: servico.preco,
          ...(servico.custo !== undefined ? { custoUnitario: servico.custo } : {}),
          opcoes: [],
          total: servico.preco,
        }))
        const total = reais(itens.reduce((soma, item) => soma + item.total, 0))
        const observacao = novo.observacao?.trim().slice(0, 280)
        const pedido: Pedido = {
          id,
          numero: numeroNovo(base, id),
          token: crypto.randomUUID(),
          origem: "painel",
          tipo: "atendimento",
          status: "recebido",
          cliente: { nome, telefone: novo.cliente.telefone.replace(/\D/g, "").slice(0, 13) },
          itens,
          subtotal: total,
          desconto: 0,
          taxaEntrega: 0,
          total,
          pagamento: novo.pagamento,
          situacaoPagamento: "na-entrega",
          ...(observacao ? { observacao } : {}),
          criadoEm: agora,
          atualizadoEm: agora,
          historico: [{ status: "recebido", em: agora }],
          enviarParaCozinha: false,
          agendamento: { inicio: inicio.toISOString(), duracaoMin },
        }
        await substituir({ ...base, pedidos: [...base.pedidos, pedido] })
        return responder(pedido)
      },

      /** Novo horário, com as mesmas regras; só antes de o atendimento começar. */
      remarcar(id: number, inicio: string) {
        return alterar(id, (pedido, base) => {
          if (!pedido.agendamento || pedido.status !== "recebido") {
            throw new Error("Só dá para remarcar antes de começar.")
          }
          const novoInicio = new Date(inicio)
          conferirHorario(base, novoInicio, pedido.agendamento.duracaoMin, pedido.id)
          return {
            ...pedido,
            agendamento: { ...pedido.agendamento, inicio: novoInicio.toISOString() },
          }
        })
      },
    },

    salao: {
      async config(): Promise<ConfigSalao> {
        return responder((await carregar()).salao)
      },

      /** Valida, impede tirar área que ainda tem mesas e guarda a configuração limpa. */
      async salvar(config: ConfigSalao): Promise<ConfigSalao> {
        const lida = esquemaSalao.safeParse(config)
        if (!lida.success) throw new Error(lida.error.issues[0].message)
        const base = await carregar()
        const mantidas = new Set(lida.data.areas.map((area) => area.id))
        const retirada = base.salao.areas.find(
          (area) => !mantidas.has(area.id) && base.mesas.some((mesa) => mesa.areaId === area.id),
        )
        if (retirada) {
          throw new Error(`Mova as mesas da área ${retirada.nome} antes de excluí-la.`)
        }
        // Sem a limpeza, nenhuma mesa pode ficar esperando ser limpa.
        const mesas =
          base.salao.limpeza && !lida.data.limpeza
            ? base.mesas.map(({ limpezaDesde: _, ...mesa }) => mesa)
            : base.mesas
        await substituir({ ...base, salao: lida.data, mesas })
        return responder(lida.data)
      },
    },

    mesas: {
      async listar(): Promise<Mesa[]> {
        return responder((await carregar()).mesas.toSorted((a, b) => a.numero - b.numero))
      },

      async criar({
        numero,
        nome,
        areaId,
        lugares = 4,
        forma = "quadrada",
      }: {
        numero: number
        nome?: string
        areaId?: string
        lugares?: number
        forma?: FormaMesa
      }): Promise<Mesa> {
        if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
          throw new Error("Informe o número da mesa.")
        }
        const base = await carregar()
        if (base.mesas.some((mesa) => mesa.numero === numero)) {
          throw new Error(`Já existe a mesa ${numero}.`)
        }
        conferirLugaresEForma(lugares, forma)
        const area =
          areaId !== undefined
            ? base.salao.areas.find((item) => item.id === areaId)
            : base.salao.areas.toSorted((a, b) => a.ordem - b.ordem)[0]
        if (!area) throw new Error("Escolha uma área do salão.")
        const posicao = primeiraPosicaoLivre(base.mesas, area.id, { forma, lugares })
        if (!posicao) throw new Error("Não cabe mais mesa nessa área do mapa.")
        const mesa: Mesa = {
          id: novoId("mesa")(),
          numero,
          nome: nome?.trim().slice(0, 40) || nomePadraoDaMesa(numero),
          status: "livre",
          areaId: area.id,
          lugares,
          forma,
          posicao,
        }
        await substituir({ ...base, mesas: [...base.mesas, mesa] })
        return responder(mesa)
      },

      /**
       * Troca número, nome, área, lugares e forma. A mesa ocupada não muda de número. Se mudar
       * de área, ou se o tamanho novo cruzar outra mesa, vai para a primeira posição livre.
       */
      async editar(
        id: string,
        {
          numero,
          nome,
          areaId,
          lugares,
          forma,
        }: { numero: number; nome?: string; areaId: string; lugares: number; forma: FormaMesa },
      ): Promise<Mesa> {
        const base = await carregar()
        const mesa = base.mesas.find((item) => item.id === id)
        if (!mesa) throw new Error("Mesa não encontrada")
        if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
          throw new Error("Informe o número da mesa.")
        }
        if (base.mesas.some((outra) => outra.id !== id && outra.numero === numero)) {
          throw new Error(`Já existe a mesa ${numero}.`)
        }
        if (numero !== mesa.numero && comandaDa(base, id)) {
          throw new Error("Feche a conta antes de mudar o número da mesa.")
        }
        conferirLugaresEForma(lugares, forma)
        const area = base.salao.areas.find((item) => item.id === areaId)
        if (!area) throw new Error("Escolha uma área do salão.")
        const outras = base.mesas.filter((outra) => outra.id !== id)
        const novaForma = { forma, lugares }
        const cruza = outras.some(
          (outra) =>
            outra.areaId === area.id &&
            mesasSeCruzam({ ...novaForma, posicao: mesa.posicao }, outra),
        )
        const posicao =
          area.id === mesa.areaId && !cruza
            ? mesa.posicao
            : primeiraPosicaoLivre(outras, area.id, novaForma)
        if (!posicao) throw new Error("Não cabe mais mesa nessa área do mapa.")
        const editada: Mesa = {
          ...mesa,
          numero,
          nome: nome?.trim().slice(0, 40) || nomePadraoDaMesa(numero),
          areaId: area.id,
          lugares,
          forma,
          posicao,
        }
        await substituir({
          ...base,
          mesas: base.mesas.map((item) => (item.id === id ? editada : item)),
        })
        return responder(editada)
      },

      /** Tira a mesa de uso. O motivo é aparado e cortado em 80 caracteres. */
      bloquear(id: string, motivo?: string) {
        return mudarMesa(id, (mesa, base) => {
          if (comandaDa(base, id)) throw new Error("Feche a conta antes de bloquear a mesa.")
          const texto = motivo?.trim().slice(0, 80)
          return { ...mesa, bloqueio: texto ? { motivo: texto } : {} }
        })
      },

      desbloquear(id: string) {
        return mudarMesa(id, ({ bloqueio: _bloqueio, ...mesa }) => mesa)
      },

      /** A mesa saiu da limpeza. Dá para desfazer por 10 s (Q46). */
      async marcarLimpa(id: string): Promise<{ mesa: Mesa; desfazer: string }> {
        const { base, desfazer } = await mover((base) => {
          if (!base.mesas.some((mesa) => mesa.id === id)) throw new Error("Mesa não encontrada")
          return {
            nova: {
              ...base,
              mesas: base.mesas.map((mesa) => {
                if (mesa.id !== id) return mesa
                const { limpezaDesde: _limpezaDesde, ...limpa } = mesa
                return limpa
              }),
            },
            mesas: [id],
            pedidos: [],
          }
        })
        return responder({ mesa: base.mesas.find((mesa) => mesa.id === id) as Mesa, desfazer })
      },

      async excluir(id: string): Promise<void> {
        const base = await carregar()
        if (comandaDa(base, id)) throw new Error("Feche a conta antes de excluir a mesa.")
        await substituir({ ...base, mesas: base.mesas.filter((mesa) => mesa.id !== id) })
      },

      /**
       * Abre a mesa com a comanda vazia: pessoas, garçom da lista e, se quiser, o cliente.
       * Mais pessoas que lugares não recusa (a tela avisa).
       */
      async abrir(
        mesaId: string,
        { pessoas, garcom: garcomPedido, clienteNome, confirmarReserva, por }: AberturaMesa,
      ): Promise<Pedido> {
        const base = await carregar()
        const mesa = base.mesas.find((item) => item.id === mesaId)
        if (!mesa) throw new Error("Mesa não encontrada")
        if (mesa.bloqueio) throw new Error(`A mesa ${mesa.numero} está bloqueada.`)
        if (comandaDa(base, mesa.id)) throw new Error(`A mesa ${mesa.numero} já está aberta.`)
        if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 99) {
          throw new Error("Informe de 1 a 99 pessoas.")
        }
        const reserva = reservaDaVez(base, mesa.id, new Date())
        if (reserva && !confirmarReserva) {
          throw new Error(
            `A mesa ${mesa.numero} está reservada às ${format(new Date(reserva.inicio), "HH:mm")}. Confirme para abrir.`,
          )
        }
        const garcom = garcomDaLista(base, garcomPedido, true)
        const agora = new Date().toISOString()
        const id = proximoId(base)
        const comanda = comEvento(
          comEtapa(
            // O couvert já entra na conta da mesa vazia.
            recalcular(
              comandaNova(base, mesa, {
                id,
                agora,
                cliente: clienteNome?.trim().slice(0, 80),
                garcom,
                pessoas,
                itens: [],
                enviarParaCozinha: false,
              }),
            ),
            agora,
          ),
          eventoAberta(agora, pessoas, garcom ?? por),
        )
        await substituir(abrirMesas({ ...base, pedidos: [...base.pedidos, comanda] }))
        return responder(comanda)
      },

      /**
       * Lança itens na mesa: abre a comanda ou acrescenta uma rodada nova. Com cozinha,
       * a comanda volta para "Novo" e a cozinha vê só esta rodada.
       */
      async lancar(lancamento: LancamentoMesa): Promise<Pedido> {
        const base = await carregar()
        const mesa = base.mesas.find((item) => item.id === lancamento.mesaId)
        if (!mesa) throw new Error("Mesa não encontrada")
        if (mesa.bloqueio) throw new Error(`A mesa ${mesa.numero} está bloqueada.`)
        if (lancamento.itens.length === 0) throw new Error("Inclua pelo menos um item.")

        const agora = new Date().toISOString()
        const aberta = comandaDa(base, mesa.id)
        // Na mesa livre, o lançamento abre a mesa com as regras da tela de Mesas: a reserva
        // só se confirma lá, e o garçom tem que ser da lista do salão.
        if (!aberta && reservaDaVez(base, mesa.id, new Date())) {
          throw new Error(`A mesa ${mesa.numero} está reservada. Abra pela tela de Mesas.`)
        }
        const garcom = aberta
          ? undefined
          : (garcomDaLista(base, lancamento.garcom, false) ??
            lancamento.garcom?.trim().slice(0, 80))
        const rodada = Math.max(0, ...(aberta?.itens.map((item) => item.rodada ?? 1) ?? [])) + 1
        const id = aberta?.id ?? proximoId(base)
        const vaiParaCozinha = lancamento.enviarParaCozinha
        const novos: ItemPedido[] = lancamento.itens.map((lancado, indice) => {
          const { produtoId, nome, precoUnitario, custoUnitario, opcoes, produtosDasOpcoes } =
            precificar(base, lancado)
          // Como o 0 e o negativo, o que não é número vira 1.
          const pedida = Number.isFinite(lancado.quantidade) ? Math.round(lancado.quantidade) : 1
          const quantidade = Math.min(Math.max(pedida, 1), 999)
          const observacao = lancado.observacao?.trim().slice(0, 140)
          return {
            id: `${id}-${rodada}-${indice + 1}`,
            produtoId,
            nome,
            quantidade,
            precoUnitario,
            ...(custoUnitario !== undefined ? { custoUnitario } : {}),
            opcoes,
            ...(produtosDasOpcoes.length > 0 ? { produtosDasOpcoes } : {}),
            // As escolhas ficam no item: editar abre a janela já marcada.
            ...("escolhas" in lancado && Object.keys(lancado.escolhas).length > 0
              ? { escolhas: lancado.escolhas }
              : {}),
            ...(observacao ? { observacao } : {}),
            total: reais(precoUnitario * quantidade),
            rodada,
            vaiParaCozinha,
            lancadoEm: agora,
          }
        })

        const cliente = lancamento.clienteNome?.trim().slice(0, 80)
        const por = lancamento.por?.trim() ? lancamento.por : (garcom ?? lancamento.garcom)
        const comanda: Pedido = comEvento(
          comEtapa(
            recalcular(
              aberta
                ? {
                    // Lançar de novo desfaz o "Pediu a conta" (Q23).
                    ...semContaPedida(aberta),
                    itens: [...aberta.itens, ...novos],
                    status: vaiParaCozinha ? "recebido" : aberta.status,
                    enviarParaCozinha: aberta.enviarParaCozinha || vaiParaCozinha,
                    atualizadoEm: agora,
                    estoqueBaixado: true,
                  }
                : comEvento(
                    comandaNova(base, mesa, {
                      id,
                      agora,
                      cliente,
                      garcom,
                      pessoas: 1,
                      itens: novos,
                      enviarParaCozinha: vaiParaCozinha,
                    }),
                    eventoAberta(agora, 1, garcom),
                  ),
            ),
            agora,
          ),
          {
            tipo: "rodada",
            em: agora,
            ...autor(por),
            texto: `Rodada ${rodada} ${vaiParaCozinha ? "para a cozinha" : "lançada na mesa"}: ${itensEmTexto(novos)}`,
          },
        )
        const comEstoque = aplicarEstoque(base, aberta, comanda, { conferir: true })
        const pedidos = aberta
          ? comEstoque.pedidos.map((pedido) => (pedido.id === comanda.id ? comanda : pedido))
          : [...comEstoque.pedidos, comanda]
        await substituir(abrirMesas({ ...comEstoque, pedidos }))
        return responder(comanda)
      },

      /**
       * Muda a quantidade. Diminuir é tirar parte do item (com motivo, se a cozinha já preparou);
       * o que a cozinha preparou não aumenta: o pedido a mais é uma rodada nova.
       */
      alterarQuantidade(
        pedidoId: number,
        itemId: string,
        quantidade: number,
        { motivo, por }: Retirada = {},
      ) {
        return alterarComanda(pedidoId, (comanda, perder) => {
          if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
            throw new Error("Informe uma quantidade válida.")
          }
          conferirItem(comanda, itemId)
          const item = comanda.itens.find((atual) => atual.id === itemId) as ItemPedido
          const mudado = {
            ...comanda,
            itens: comanda.itens.map((atual) =>
              atual.id === itemId
                ? { ...atual, quantidade, total: reais(atual.precoUnitario * quantidade) }
                : atual,
            ),
          }
          if (quantidade > item.quantidade && cozinhaJaPreparou(comanda, item)) {
            throw new Error(`A cozinha já preparou ${item.nome}. Lance de novo para pedir mais.`)
          }
          // A cortesia e o pagamento por item valem para o que já estava: o a mais é item novo.
          if (quantidade > item.quantidade && (item.cortesia || itensPagos(comanda).has(item.id))) {
            throw new Error("Lance o item de novo.")
          }
          if (quantidade >= item.quantidade) return mudado
          return retirar(mudado, {
            comanda,
            item,
            quantidade: item.quantidade - quantidade,
            motivo,
            por,
            perder,
          })
        })
      },

      /**
       * Troca a observação e, no item do cardápio, as opções (o preço é refeito aqui). Só
       * enquanto a cozinha não preparou: depois, tira com motivo e lança de novo (Q29).
       */
      editarItem(
        pedidoId: number,
        itemId: string,
        { observacao, escolhas, por }: { observacao?: string; escolhas?: Escolhas; por?: string },
      ) {
        return alterarComanda(pedidoId, (comanda, _perder, base) => {
          conferirItem(comanda, itemId)
          const item = comanda.itens.find((atual) => atual.id === itemId) as ItemPedido
          if (cozinhaJaPreparou(comanda, item)) {
            throw new Error(`A cozinha já preparou ${item.nome}. Tire com motivo e lance de novo.`)
          }
          const { observacao: _antiga, ...semObservacao } = item
          let editado: ItemPedido = semObservacao
          if (escolhas && item.produtoId) {
            const { precoUnitario, opcoes, produtosDasOpcoes } = precificar(base, {
              produtoId: item.produtoId,
              escolhas,
              quantidade: item.quantidade,
            })
            const { produtosDasOpcoes: _ligados, ...semLigados } = editado
            editado = {
              ...semLigados,
              precoUnitario,
              opcoes,
              ...(produtosDasOpcoes.length > 0 ? { produtosDasOpcoes } : {}),
              escolhas,
              total: reais(precoUnitario * item.quantidade),
            }
          }
          const texto = (observacao ?? item.observacao ?? "").trim().slice(0, 140)
          if (texto) editado = { ...editado, observacao: texto }
          return comEvento(
            {
              ...comanda,
              itens: comanda.itens.map((atual) => (atual.id === itemId ? editado : atual)),
            },
            {
              tipo: "item-editado",
              em: new Date().toISOString(),
              ...autor(por),
              texto: `${item.nome}: ${[...editado.opcoes, texto].filter(Boolean).join(" · ") || "sem observação"}`,
            },
          )
        })
      },

      /** Tira o item da comanda. O que a cozinha já preparou exige motivo e vira perda. */
      removerItem(pedidoId: number, itemId: string, { motivo, por }: Retirada = {}) {
        return alterarComanda(pedidoId, (comanda, perder) => {
          conferirItem(comanda, itemId)
          const item = comanda.itens.find((atual) => atual.id === itemId) as ItemPedido
          return retirar(
            { ...comanda, itens: comanda.itens.filter((atual) => atual.id !== itemId) },
            { comanda, item, quantidade: item.quantidade, motivo, por, perder },
          )
        })
      },

      /**
       * Cancela a comanda com itens (Q36): exige motivo, vai para Pedidos como cancelada e o
       * estoque segue item a item (o preparado vira perda). A mesa fica livre, sem limpeza.
       */
      cancelarComanda(pedidoId: number, { motivo, por }: { motivo: string; por?: string }) {
        return alterarComanda(pedidoId, (comanda, perder) => {
          if (comanda.itens.length === 0) throw new Error("A comanda está vazia. Libere a mesa.")
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo do cancelamento.")
          if (comanda.pagamentos?.length) throw new Error("Estorne os pagamentos antes.")
          for (const item of comanda.itens) {
            if (cozinhaJaPreparou(comanda, item)) {
              perder({ item, quantidade: item.quantidade, motivo: texto })
            }
          }
          return comEvento(
            {
              ...comanda,
              status: "cancelado",
              situacaoPagamento: "cancelado",
              motivoCancelamento: "outro",
              detalheCancelamento: texto,
            },
            {
              tipo: "cancelada",
              em: new Date().toISOString(),
              ...autor(por),
              texto: "Comanda cancelada",
              motivo: texto,
            },
          )
        })
      },

      /** O que a cozinha aprontou foi para a mesa: limpa o "Servir". */
      marcarServido(pedidoId: number, por?: string) {
        return alterarComanda(pedidoId, ({ servirDesde, ...comanda }) => {
          if (!servirDesde) throw new Error("Não há nada para servir.")
          return comEvento(comanda, {
            tipo: "servida",
            em: new Date().toISOString(),
            ...autor(por),
            texto: "Rodada servida",
          })
        })
      },

      /** A mesa pediu a conta: fica a hora do primeiro pedido. */
      pedirConta(pedidoId: number, por?: string) {
        return alterarComanda(pedidoId, (comanda) => comContaPedida(comanda, por))
      },

      /** A pré-conta saiu na impressora: a mesa pediu a conta (se ainda não tinha pedido). */
      imprimirPreConta(pedidoId: number, por?: string) {
        return alterarComanda(pedidoId, (comanda) =>
          comEvento(comContaPedida(comanda, por), {
            tipo: "pre-conta",
            em: new Date().toISOString(),
            ...autor(por),
            texto: "Pré-conta impressa",
          }),
        )
      },

      /** Um pagamento contra o saldo da conta. */
      pagar(pedidoId: number, pagamento: Pagamento) {
        return alterarComanda(pedidoId, (comanda) => receber(comanda, pagamento))
      },

      /**
       * Recebe o saldo inteiro de uma vez, numa forma só. Sem saldo (tudo em cortesia, ou a conta
       * reaberta sem mudança), fecha sem pagamento, e a forma não importa.
       */
      fecharConta(
        pedidoId: number,
        forma?: PagamentoMesa,
        { cartao, por }: { cartao?: CartaoPagamento; por?: string } = {},
      ) {
        return alterarComanda(pedidoId, (comanda) => {
          if (comanda.itens.length === 0) throw new Error("A comanda está vazia.")
          if (resumoDaConta(comanda).saldo === 0) {
            return fechada(comanda, new Date().toISOString(), por)
          }
          return receber(comanda, {
            forma: forma as PagamentoMesa,
            ...(cartao ? { cartao } : {}),
            ...(por ? { por } : {}),
          })
        })
      },

      /** Desconto da conta, em reais ou em %, com motivo. Valor zero tira o desconto (com motivo). */
      descontar(pedidoId: number, { por, ...desconto }: DescontoConta & { por?: string }) {
        return alterarComanda(pedidoId, ({ descontoConta: anterior, ...comanda }) => {
          const motivo = desconto.motivo.trim().slice(0, 140)
          if (desconto.valor === 0) {
            if (!anterior) throw new Error("Esta conta não tem desconto.")
            if (!motivo) throw new Error("Diga o motivo para tirar o desconto.")
            return comEvento(comanda, {
              tipo: "desconto",
              em: new Date().toISOString(),
              ...autor(por),
              texto: "Tirou o desconto",
              motivo,
            })
          }
          const novo: DescontoConta = { modo: desconto.modo, valor: desconto.valor, motivo }
          const { itens, cortesias } = resumoDaConta(comanda)
          const erro = erroDoDesconto(novo, reais(itens - cortesias))
          if (erro) throw new Error(erro)
          const comDesconto = { ...comanda, descontoConta: novo }
          const valor = emReais(resumoDaConta(comDesconto).descontos)
          return comEvento(comDesconto, {
            tipo: "desconto",
            em: new Date().toISOString(),
            ...autor(por),
            texto:
              novo.modo === "percentual"
                ? `Desconto de ${novo.valor.toLocaleString("pt-BR")}% (${valor})`
                : `Desconto de ${valor}`,
            motivo,
          })
        })
      },

      /** Cortesia: o item fica na comanda, zerado, com o motivo. O estoque não volta (foi consumido). */
      darCortesia(
        pedidoId: number,
        itemId: string,
        { motivo, por }: { motivo: string; por?: string },
      ) {
        return alterarComanda(pedidoId, (comanda) => {
          conferirItem(comanda, itemId)
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo da cortesia.")
          const item = comanda.itens.find((atual) => atual.id === itemId) as ItemPedido
          if (item.cortesia) throw new Error(`${item.nome} já é cortesia.`)
          if (itensPagos(comanda).has(itemId)) throw new Error("Esse item já foi pago.")
          return comEvento(
            {
              ...comanda,
              itens: comanda.itens.map((atual) =>
                atual.id === itemId ? { ...atual, cortesia: { motivo: texto } } : atual,
              ),
            },
            {
              tipo: "cortesia",
              em: new Date().toISOString(),
              ...autor(por),
              texto: `Cortesia: ${itensEmTexto([item])}`,
              motivo: texto,
            },
          )
        })
      },

      /** Tira a taxa de serviço da conta, com motivo (fica guardado na própria taxa). */
      tirarTaxa(pedidoId: number, { motivo, por }: { motivo: string; por?: string }) {
        return alterarComanda(pedidoId, (comanda) => {
          if (!comanda.taxaServico || comanda.taxaServico.removida) {
            throw new Error("Esta conta não tem taxa de serviço.")
          }
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo para tirar a taxa de serviço.")
          return comEvento(
            { ...comanda, taxaServico: { ...comanda.taxaServico, removida: { motivo: texto } } },
            {
              tipo: "taxa-removida",
              em: new Date().toISOString(),
              ...autor(por),
              texto: "Tirou a taxa de serviço",
              motivo: texto,
            },
          )
        })
      },

      /** Tira o couvert da conta, com motivo (fica guardado no próprio couvert). */
      tirarCouvert(pedidoId: number, { motivo, por }: { motivo: string; por?: string }) {
        return alterarComanda(pedidoId, (comanda) => {
          if (!comanda.couvert || comanda.couvert.removido) {
            throw new Error("Esta conta não tem couvert.")
          }
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo para tirar o couvert.")
          return comEvento(
            { ...comanda, couvert: { ...comanda.couvert, removido: { motivo: texto } } },
            {
              tipo: "couvert-removido",
              em: new Date().toISOString(),
              ...autor(por),
              texto: "Tirou o couvert",
              motivo: texto,
            },
          )
        })
      },

      /** Tira um pagamento da conta aberta, com motivo: o saldo volta. */
      estornarPagamento(
        pedidoId: number,
        pagamentoId: string,
        { motivo, por }: { motivo: string; por?: string },
      ) {
        return alterarComanda(pedidoId, (comanda) => {
          const pagamento = comanda.pagamentos?.find((item) => item.id === pagamentoId)
          if (!pagamento) throw new Error("Pagamento não encontrado")
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo do estorno.")
          return comEvento(
            {
              ...comanda,
              pagamentos: (comanda.pagamentos ?? []).filter((item) => item.id !== pagamentoId),
            },
            {
              tipo: "pagamento-estornado",
              em: new Date().toISOString(),
              ...autor(por),
              texto: `Estornou ${rotuloDoPagamento(pagamento)} ${emReais(pagamento.valor)}`,
              motivo: texto,
            },
          )
        })
      },

      /** A conta da mesa que pode ser reaberta agora (a última, fechada hoje), ou `null`. */
      async ultimaConta(mesaId: string): Promise<Pedido | null> {
        const base = await carregar()
        const conta = ultimaFechada(base, mesaId)
        return responder(conta && !porQueNaoReabre(base, conta, new Date()) ? conta : null)
      },

      /** Reabre a última conta fechada da mesa, no mesmo dia, com motivo. Os pagamentos ficam. */
      reabrir(pedidoId: number, { motivo, por }: { motivo: string; por?: string }) {
        return alterar(pedidoId, (conta, base) => {
          const texto = motivo?.trim().slice(0, 140)
          if (!texto) throw new Error("Diga o motivo para reabrir a conta.")
          const erro = porQueNaoReabre(base, conta, new Date())
          if (erro) throw new Error(erro)
          const { pagoEm: _pagoEm, trocoPara: _trocoPara, ...aberta } = conta
          // Paga antes da Fase 4, sem `pagamentos`: o pagamento que ela teve fica gravado.
          const pagamentos: PagamentoConta[] =
            conta.pagamentos ??
            pagamentosDoPedido(conta).map((pagamento) => ({
              id: `pag-${crypto.randomUUID().slice(0, 8)}`,
              forma: pagamento.forma as PagamentoMesa,
              valor: pagamento.valor,
              em: pagamento.em,
            }))
          return comEvento(
            { ...aberta, pagamentos, status: "pronto", situacaoPagamento: "na-entrega" },
            {
              tipo: "reaberta",
              em: new Date().toISOString(),
              ...autor(por),
              texto: "Conta reaberta",
              motivo: texto,
            },
          )
        })
      },

      /**
       * Leva a comanda para uma mesa livre. A de origem fica livre, sem limpeza (só fechar a
       * conta põe em limpeza); o estoque não muda. Dá para desfazer por 10 s.
       */
      async transferir(
        pedidoId: number,
        mesaDestinoId: string,
        { confirmarReserva, por }: { confirmarReserva?: boolean; por?: string } = {},
      ): Promise<{ comanda: Pedido; desfazer: string }> {
        const { base, desfazer } = await mover((base) => {
          const comanda = comandaAberta(base, pedidoId)
          if (comanda.mesa.juntadas?.length) throw new Error("Separe as mesas antes de transferir.")
          const destino = mesaLivreParaReceber(base, comanda, mesaDestinoId, confirmarReserva)
          const origem = base.mesas.find((mesa) => mesa.id === comanda.mesa.id)
          const agora = new Date().toISOString()
          const novo = comEvento(
            {
              ...comanda,
              mesa: { ...comanda.mesa, id: destino.id, numero: destino.numero },
              // Sem cliente, a comanda leva o nome da mesa: ele acompanha a mesa nova.
              ...(comanda.cliente.nome === origem?.nome
                ? { cliente: { ...comanda.cliente, nome: destino.nome } }
                : {}),
              atualizadoEm: agora,
            },
            {
              tipo: "transferida",
              em: agora,
              ...autor(por),
              texto: `Transferida da mesa ${comanda.mesa.numero} para a mesa ${destino.numero}`,
            },
          )
          return {
            nova: {
              ...base,
              pedidos: base.pedidos.map((pedido) => (pedido.id === novo.id ? novo : pedido)),
            },
            mesas: [comanda.mesa.id, destino.id],
            pedidos: [novo.id],
          }
        })
        return responder({
          comanda: base.pedidos.find((pedido) => pedido.id === pedidoId) as Pedido,
          desfazer,
        })
      },

      /**
       * Junta mesas à da comanda (a principal). A mesa livre só fica "Com a mesa X"; a aberta traz
       * a comanda dela, que sai de Pedidos (`juntarComandas`). O estoque não muda.
       */
      async juntar(
        pedidoId: number,
        mesaIds: string[],
        { por }: { por?: string } = {},
      ): Promise<{ comanda: Pedido; desfazer: string }> {
        const { base, desfazer } = await mover((base) => {
          let comanda: Pedido = comandaAberta(base, pedidoId)
          if (mesaIds.length === 0) throw new Error("Escolha as mesas para juntar.")
          const principalId = comanda.mesa?.id as string
          const agora = new Date().toISOString()
          const saem: number[] = []
          for (const mesaId of new Set(mesaIds)) {
            const mesa = base.mesas.find((item) => item.id === mesaId)
            if (!mesa) throw new Error("Mesa não encontrada")
            if (mesa.id === principalId) throw new Error("Escolha outra mesa.")
            if (mesa.bloqueio) throw new Error(`A mesa ${mesa.numero} está bloqueada.`)
            if (mesa.juntadaCom) {
              const com = base.mesas.find((item) => item.id === mesa.juntadaCom)
              throw new Error(`A mesa ${mesa.numero} já está junto com a mesa ${com?.numero}.`)
            }
            const daMesa = comandaDa(base, mesa.id)
            let texto = `Juntou a mesa ${mesa.numero}`
            if (daMesa) {
              const erro = porQueNaoJunta(comanda, daMesa)
              if (erro) throw new Error(erro)
              comanda = juntarComandas(comanda, daMesa)
              saem.push(daMesa.id)
              if (daMesa.itens.length > 0) texto += `: ${itensEmTexto(daMesa.itens)}`
            } else {
              const reserva = reservaDaVez(base, mesa.id, new Date())
              if (reserva) {
                throw new Error(
                  `A mesa ${mesa.numero} está reservada às ${format(new Date(reserva.inicio), "HH:mm")}.`,
                )
              }
              const juntadas = [
                ...(comanda.mesa?.juntadas ?? []),
                { id: mesa.id, numero: mesa.numero },
              ]
              comanda = {
                ...comanda,
                mesa: {
                  ...(comanda.mesa as NonNullable<Pedido["mesa"]>),
                  juntadas: juntadas.toSorted((a, b) => a.numero - b.numero),
                },
              }
            }
            comanda = comEvento(comanda, { tipo: "juntada", em: agora, ...autor(por), texto })
          }
          // A taxa da principal vale para tudo: se a secundária pagou com uma taxa maior, recusa.
          const { pago, total } = resumoDaConta(comanda)
          if (pago > total) {
            throw new Error("A conta ficaria menor que o já pago. Estorne um pagamento antes.")
          }
          const junta = { ...comanda, atualizadoEm: agora }
          // A comanda que sai de Pedidos pode ser a mais nova: o id e o número dela ficam guardados.
          const ultimo = ultimoPedido(base)
          return {
            nova: {
              ...base,
              ...(ultimo
                ? {
                    ultimoPedido: {
                      id: ultimo.id,
                      numero: ultimo.numero,
                      criadoEm: ultimo.criadoEm,
                    },
                  }
                : {}),
              pedidos: base.pedidos
                .filter((pedido) => !saem.includes(pedido.id))
                .map((pedido) => (pedido.id === junta.id ? junta : pedido)),
            },
            mesas: [principalId, ...mesaIds],
            pedidos: [junta.id, ...saem],
          }
        })
        return responder({
          comanda: base.pedidos.find((pedido) => pedido.id === pedidoId) as Pedido,
          desfazer,
        })
      },

      /**
       * Leva itens (ou parte de uma linha) para outra mesa: a aberta recebe na comanda dela (a
       * juntada, na da principal); a livre abre com o garçom da origem e 1 pessoa. O item chega
       * com `transferido`, preparado ou não. O estoque não muda.
       */
      async transferirItens(
        pedidoId: number,
        {
          mesaDestinoId,
          itens,
          confirmarReserva,
          por,
        }: {
          mesaDestinoId: string
          itens: { itemId: string; quantidade: number }[]
          confirmarReserva?: boolean
          por?: string
        },
      ): Promise<{ comanda: Pedido; destino: Pedido; desfazer: string }> {
        let destinoId = 0
        const { base, desfazer } = await mover((base) => {
          const origem = comandaAberta(base, pedidoId)
          if (itens.length === 0) throw new Error("Escolha os itens.")
          const aberta = comandaDa(base, mesaDestinoId)
          const mesa = aberta
            ? (base.mesas.find((item) => item.id === mesaDestinoId) as Mesa)
            : mesaLivreParaReceber(base, origem, mesaDestinoId, confirmarReserva)
          // A mesa aberta não fica bloqueada (bloquear pede a conta fechada); a livre passa por
          // mesaLivreParaReceber, que recusa a bloqueada.
          if (aberta?.id === origem.id) throw new Error("Escolha outra mesa.")
          const agora = new Date().toISOString()
          let ficam = origem.itens
          const vao: ItemPedido[] = []
          for (const { itemId, quantidade } of itens) {
            const item = ficam.find((atual) => atual.id === itemId)
            if (!item) throw new Error("Item não encontrado na comanda")
            if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > item.quantidade) {
              throw new Error("Informe uma quantidade válida.")
            }
            const erro = porQueNaoTransfere(origem, item)
            if (erro) throw new Error(erro)
            const { fica, vai } = separarQuantidade(
              item,
              quantidade,
              `${item.id}-t${crypto.randomUUID().slice(0, 4)}`,
            )
            ficam = fica
              ? ficam.map((atual) => (atual.id === item.id ? fica : atual))
              : ficam.filter((atual) => atual.id !== item.id)
            vao.push({
              ...vai,
              transferido: {
                daMesa: origem.mesa.numero,
                preparado: cozinhaJaPreparou(origem, item),
              },
            })
          }
          const saiu = recalcular(depoisDeTirar(origem, { ...origem, itens: ficam }))
          const { pago, total, itens: valorDosItens, cortesias, descontos } = resumoDaConta(saiu)
          if (descontos > reais(valorDosItens - cortesias)) {
            throw new Error(
              "O desconto passaria do valor dos itens. Tire ou diminua o desconto antes.",
            )
          }
          if (pago > total) {
            throw new Error("A conta ficaria menor que o já pago. Estorne um pagamento antes.")
          }
          const texto = itensEmTexto(vao)
          const transferiu = comEvento(
            { ...saiu, atualizadoEm: agora },
            {
              tipo: "itens-transferidos",
              em: agora,
              ...autor(por),
              texto: `Transferiu ${texto} para a mesa ${mesa.numero}`,
            },
          )
          // O que ficou já estava pago: a conta da origem fecha, como ao tirar um item.
          const fechou = quitou(origem, transferiu)
          const novaOrigem = fechou ? fechada(transferiu, agora, por) : transferiu
          const id = aberta?.id ?? proximoId(base)
          destinoId = id
          const garcom = origem.mesa.garcom
          const recebeu = recalcular(
            aberta
              ? // Receber itens muda a conta, como lançar: o "Pediu a conta" sai (Q23).
                { ...semContaPedida(aberta), itens: [...aberta.itens, ...vao], atualizadoEm: agora }
              : comEtapa(
                  comEvento(
                    comandaNova(base, mesa, {
                      id,
                      agora,
                      garcom,
                      pessoas: 1,
                      itens: vao,
                      enviarParaCozinha: false,
                    }),
                    eventoAberta(agora, 1, por ?? garcom),
                  ),
                  agora,
                ),
          )
          // O item pronto e não servido leva o "Servir" para a mesa que o recebe.
          const servirDesde = servirDesdeAoReceber(origem, vao, aberta)
          const novoDestino = comEvento(servirDesde ? { ...recebeu, servirDesde } : recebeu, {
            tipo: "itens-transferidos",
            em: agora,
            ...autor(por),
            texto: `Recebeu ${texto} da mesa ${origem.mesa.numero}`,
          })
          const pedidos = base.pedidos.map((pedido) =>
            pedido.id === novaOrigem.id
              ? novaOrigem
              : pedido.id === novoDestino.id
                ? novoDestino
                : pedido,
          )
          return {
            nova: {
              ...base,
              pedidos: aberta ? pedidos : [...pedidos, novoDestino],
              // Com a limpeza ligada, a mesa da conta que fechou (e as juntas a ela) espera a limpeza.
              mesas:
                fechou && base.salao.limpeza
                  ? base.mesas.map((item) =>
                      [
                        origem.mesa.id,
                        ...(origem.mesa.juntadas ?? []).map((junta) => junta.id),
                      ].includes(item.id)
                        ? { ...item, limpezaDesde: agora }
                        : item,
                    )
                  : base.mesas,
            },
            mesas: [...new Set([origem.mesa.id, mesa.id, novoDestino.mesa?.id as string])],
            pedidos: [novaOrigem.id, novoDestino.id],
          }
        })
        const buscar = (id: number) => base.pedidos.find((pedido) => pedido.id === id) as Pedido
        return responder({ comanda: buscar(pedidoId), destino: buscar(destinoId), desfazer })
      },

      /** Solta as mesas juntadas: elas voltam livres, e itens, pessoas e pagamentos ficam. */
      async separar(
        pedidoId: number,
        { por }: { por?: string } = {},
      ): Promise<{ comanda: Pedido; desfazer: string }> {
        const { base, desfazer } = await mover((base) => {
          const comanda = comandaAberta(base, pedidoId)
          const { juntadas = [], ...mesa } = comanda.mesa
          if (juntadas.length === 0) {
            throw new Error(`A mesa ${mesa.numero} não está junto com outra.`)
          }
          const numeros = juntadas.map((junta) => junta.numero)
          const agora = new Date().toISOString()
          const separada = comEvento(
            { ...comanda, mesa, atualizadoEm: agora },
            {
              tipo: "separada",
              em: agora,
              ...autor(por),
              texto:
                numeros.length === 1
                  ? `Separou a mesa ${numeros[0]}`
                  : `Separou as mesas ${numerosEmTexto(numeros)}`,
            },
          )
          return {
            nova: {
              ...base,
              pedidos: base.pedidos.map((pedido) =>
                pedido.id === separada.id ? separada : pedido,
              ),
            },
            mesas: [mesa.id, ...juntadas.map((junta) => junta.id)],
            pedidos: [separada.id],
          }
        })
        return responder({
          comanda: base.pedidos.find((pedido) => pedido.id === pedidoId) as Pedido,
          desfazer,
        })
      },

      /**
       * Volta a movimentação: as mesas e comandas da foto voltam a ser como eram, se nada mudou
       * nelas desde então. A foto vale 10 s e uma vez só.
       */
      async desfazer(id: string): Promise<void> {
        const foto = fotos.get(id)
        if (!foto || Date.now() > foto.ate) {
          fotos.delete(id)
          throw new Error("O tempo para desfazer acabou.")
        }
        const base = await reler()
        const agora = recorte(base, foto.mesas, foto.pedidos)
        if (JSON.stringify(agora) !== JSON.stringify(foto.depois)) {
          throw new Error("A mesa mudou depois disso. Desfaça pela comanda.")
        }
        fotos.delete(id)
        // A comanda que a movimentação criou sai; a que ela tirou volta no lugar, pelo id.
        const pedidos = base.pedidos.filter((pedido) => !foto.pedidos.includes(pedido.id))
        for (const antes of foto.antes.pedidos) {
          if (!antes) continue
          const depois = pedidos.findIndex((pedido) => pedido.id > antes.id)
          pedidos.splice(depois < 0 ? pedidos.length : depois, 0, antes)
        }
        const mesas = base.mesas.map(
          (mesa) => foto.antes.mesas.find((antes) => antes?.id === mesa.id) ?? mesa,
        )
        await substituir(abrirMesas({ ...base, mesas, pedidos }))
      },

      /** Mesa com itens só sai pelo fechamento da conta; comanda vazia é cancelada. */
      async liberar(mesaId: string): Promise<void> {
        const comanda = comandaDa(await carregar(), mesaId)
        if (!comanda) return
        await alterarComanda(comanda.id, (aberta) => {
          if (aberta.itens.length > 0) throw new Error("Feche a conta antes de liberar a mesa.")
          return { ...aberta, status: "cancelado", situacaoPagamento: "cancelado" }
        })
      },
    },

    estoque: {
      /** Histórico do mais novo para o mais antigo; de um produto ou de todos. */
      async movimentos(produtoId?: string): Promise<MovimentoEstoque[]> {
        const { movimentosEstoque } = await carregar()
        return responder(
          movimentosEstoque
            .filter((movimento) => !produtoId || movimento.produtoId === produtoId)
            .toReversed(),
        )
      },

      /** Compra ou reposição; o custo informado passa a ser o custo do produto. */
      entrada(
        produtoId: string,
        dados: { quantidade: number; custoUnitario?: number; observacao?: string },
      ) {
        return movimentoAMao(produtoId, "entrada", dados.quantidade, (produto) => ({
          quantidade: dados.quantidade,
          extra: {
            ...(dados.custoUnitario !== undefined ? { custoUnitario: dados.custoUnitario } : {}),
            ...(dados.observacao?.trim()
              ? { observacao: dados.observacao.trim().slice(0, 140) }
              : {}),
          },
          ...(dados.custoUnitario !== undefined && dados.custoUnitario >= 0
            ? { custo: Math.round(dados.custoUnitario * 100) / 100 }
            : {}),
          produto,
        }))
      },

      /** Perda, quebra, vencimento ou consumo interno: o motivo é obrigatório. */
      saida(produtoId: string, dados: { quantidade: number; motivo: string; observacao?: string }) {
        return movimentoAMao(
          produtoId,
          "saida",
          dados.quantidade,
          (produto) => ({
            quantidade: -dados.quantidade,
            extra: {
              motivo: dados.motivo.trim().slice(0, 80),
              ...(dados.observacao?.trim()
                ? { observacao: dados.observacao.trim().slice(0, 140) }
                : {}),
            },
            produto,
          }),
          dados.motivo,
        )
      },

      /** Inventário: o que foi contado vira o saldo, e a diferença fica no histórico. */
      contagem(produtoId: string, dados: { contado: number; observacao?: string }) {
        return movimentoAMao(produtoId, "contagem", dados.contado, (produto) => ({
          quantidade: saldoDepois(dados.contado, -(produto.estoque?.quantidade ?? 0)),
          extra: dados.observacao?.trim()
            ? { observacao: dados.observacao.trim().slice(0, 140) }
            : {},
          produto,
        }))
      },

      /** Liga ou desliga o controle, o mínimo, o custo e o "esgotar ao zerar". */
      async configurar(
        produtoId: string,
        dados: { controlar: boolean; minimo: number; custo?: number; esgotarAoZerar: boolean },
      ) {
        if (!(Number.isFinite(dados.minimo) && dados.minimo >= 0)) {
          throw new Error("O estoque mínimo não pode ser negativo.")
        }
        if (dados.custo !== undefined && !(Number.isFinite(dados.custo) && dados.custo >= 0)) {
          throw new Error("O custo não pode ser negativo.")
        }
        return mudarProduto(produtoId, (produto) => ({
          ...produto,
          // O custo é do produto: o mesmo da margem e do cardápio.
          ...(dados.custo !== undefined ? { custo: Math.round(dados.custo * 100) / 100 } : {}),
          estoque: {
            ...produto.estoque,
            controlar: dados.controlar,
            quantidade: produto.estoque?.quantidade ?? 0,
            minimo: dados.minimo,
            esgotarAoZerar: dados.esgotarAoZerar,
          },
        }))
      },
    },

    motoboys: {
      async listar(): Promise<Motoboy[]> {
        const { motoboys } = await carregar()
        return responder(motoboys.toSorted((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      },

      /** Cria (sem id) ou atualiza. */
      async salvar(dados: Omit<Motoboy, "id"> & { id?: string }): Promise<Motoboy> {
        const nome = dados.nome.trim().slice(0, 60)
        if (!nome) throw new Error("Informe o nome do motoboy.")
        const telefone = dados.telefone.replace(/\D/g, "")
        if (!/^\d{10,13}$/.test(telefone)) throw new Error("WhatsApp com DDD, só números.")
        const base = await carregar()
        const motoboy: Motoboy = {
          id: dados.id ?? novoId("moto")(),
          nome,
          telefone,
          ativo: dados.ativo,
        }
        const existe = base.motoboys.some((item) => item.id === motoboy.id)
        await substituir({
          ...base,
          motoboys: existe
            ? base.motoboys.map((item) => (item.id === motoboy.id ? motoboy : item))
            : [...base.motoboys, motoboy],
        })
        return responder(motoboy)
      },

      async alternar(id: string): Promise<Motoboy> {
        const base = await carregar()
        const atual = base.motoboys.find((item) => item.id === id)
        if (!atual) throw new Error("Motoboy não encontrado")
        const novo = { ...atual, ativo: !atual.ativo }
        await substituir({
          ...base,
          motoboys: base.motoboys.map((item) => (item.id === id ? novo : item)),
        })
        return responder(novo)
      },

      /** Com entrega em andamento, o pedido ficaria apontando para ninguém: só desativar. */
      async excluir(id: string): Promise<void> {
        const base = await carregar()
        const motoboy = base.motoboys.find((item) => item.id === id)
        if (!motoboy) return
        const emAndamento = base.pedidos.some(
          (pedido) => pedido.motoboyId === id && EM_ANDAMENTO.includes(pedido.status),
        )
        if (emAndamento) {
          throw new Error(`${motoboy.nome} tem entrega em andamento. Desative em vez de excluir.`)
        }
        await substituir({ ...base, motoboys: base.motoboys.filter((item) => item.id !== id) })
      },
    },

    bairros: {
      /** Pela cidade e pelo nome. */
      async listar(): Promise<Bairro[]> {
        const { bairros } = await carregar()
        return responder(
          bairros.toSorted(
            (a, b) =>
              a.cidade.localeCompare(b.cidade, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"),
          ),
        )
      },

      /** Cria (sem id) ou atualiza; o mesmo bairro não se repete na mesma cidade. */
      async salvar(dados: Omit<Bairro, "id"> & { id?: string }): Promise<Bairro> {
        const nome = dados.nome.trim().slice(0, 60)
        const cidade = dados.cidade.trim().slice(0, 60)
        if (!nome || !cidade) throw new Error("Informe a cidade e o bairro.")
        if (!(dados.taxa >= 0 && dados.taxa <= 999)) {
          throw new Error("A taxa vai de R$ 0,00 a R$ 999,00.")
        }
        const base = await carregar()
        const repetido = base.bairros.find(
          (item) =>
            item.id !== dados.id &&
            normalizar(item.nome) === normalizar(nome) &&
            normalizar(item.cidade) === normalizar(cidade),
        )
        if (repetido) throw new Error(`Já existe o bairro ${repetido.nome} em ${repetido.cidade}.`)
        const bairro: Bairro = {
          id: dados.id ?? novoId("bairro")(),
          cidade,
          nome,
          taxa: reais(dados.taxa),
          ativo: dados.ativo,
        }
        const existe = base.bairros.some((item) => item.id === bairro.id)
        await substituir({
          ...base,
          bairros: existe
            ? base.bairros.map((item) => (item.id === bairro.id ? bairro : item))
            : [...base.bairros, bairro],
        })
        return responder(bairro)
      },

      /** Mesma taxa ou mesmo ativo para vários bairros de uma vez. */
      async mudarVarios(ids: string[], mudanca: { taxa?: number; ativo?: boolean }) {
        if (mudanca.taxa !== undefined && !(mudanca.taxa >= 0 && mudanca.taxa <= 999)) {
          throw new Error("A taxa vai de R$ 0,00 a R$ 999,00.")
        }
        const base = await carregar()
        const bairros = base.bairros.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                ...(mudanca.taxa !== undefined ? { taxa: reais(mudanca.taxa) } : {}),
                ...(mudanca.ativo !== undefined ? { ativo: mudanca.ativo } : {}),
              }
            : item,
        )
        await substituir({ ...base, bairros })
        return responder(bairros.filter((item) => ids.includes(item.id)))
      },

      /** Os pedidos antigos guardam o endereço e a taxa: nada se perde. */
      async excluir(id: string): Promise<void> {
        const base = await carregar()
        await substituir({ ...base, bairros: base.bairros.filter((item) => item.id !== id) })
      },
    },

    /**
     * Salva a configuração inteira, conferida pelo mesmo esquema do formulário. A conexão
     * da conta online não vem da tela: vale a guardada (só `conectarPagamentoOnline` muda).
     */
    async salvarLoja(dados: ConfigLoja): Promise<ConfigLoja> {
      const { loja } = await carregar()
      const resultado = esquemaLoja.safeParse({
        ...dados,
        pagamentoOnlineConectado: loja.pagamentoOnlineConectado,
      })
      if (!resultado.success) throw new Error(resultado.error.issues[0].message)
      return mudarLoja(resultado.data)
    },

    /** Demonstração: conecta ou desconecta a conta online. Sem ela, Pix e cartão online desligam. */
    async conectarPagamentoOnline(conectado: boolean): Promise<ConfigLoja> {
      const { loja } = await carregar()
      return mudarLoja({
        pagamentoOnlineConectado: conectado,
        ...(conectado
          ? {}
          : { pagamentos: { ...loja.pagamentos, pix: false, "cartao-online": false } }),
      })
    },

    /** Apaga as alterações e volta aos dados de demonstração. */
    async restaurar(): Promise<void> {
      await del(chave)
      await lembrar(doZero())
    },
  }
}

export type Servidor = ReturnType<typeof criarServidor>
