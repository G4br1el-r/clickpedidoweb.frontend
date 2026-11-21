import { addDays, addMinutes, endOfDay, format, isSameDay, startOfDay, subDays } from "date-fns"
import { del, get, set } from "idb-keyval"
import { plural } from "../../formato"
import { expediente, horariosLivres, INTERVALO_MIN } from "../regras/agenda"
import {
  copiarProduto,
  reordenar,
  replicarOpcoes,
  sincronizarOpcoes,
  soltarOpcoesDe,
} from "../regras/cardapio"
import { esquemaLoja } from "../regras/esquema-loja"
import { esquemaProduto } from "../regras/esquema-produto"
import { esquemaSalao } from "../regras/esquema-salao"
import { consumoDoPedido, errosDoMovimento, saldoDepois } from "../regras/estoque"
import { normalizar } from "../regras/filtro-pedidos"
import { comEtapa, comEvento, itensEmTexto } from "../regras/historico"
import { estadoDaMesa, nomePadraoDaMesa } from "../regras/mesas"
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
  type CatalogoLoja,
  type Categoria,
  type ConfigLoja,
  type ConfigSalao,
  FORMAS_MESA,
  type FormaMesa,
  type ItemPedido,
  type Mesa,
  type MotivoCancelamento,
  type Motoboy,
  type MovimentoEstoque,
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
  garcom?: string
  clienteNome?: string
  /** Quem lançou, para o histórico: o nome guardado no aparelho. */
  por?: string
}

/** Abertura da mesa pela tela de Mesas. `por`: quem está no aparelho, para o histórico. */
export type AberturaMesa = {
  pessoas: number
  garcom?: string
  clienteNome?: string
  /** A mesa está reservada: abrir mesmo assim. */
  confirmarReserva?: boolean
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
  return {
    ...base,
    mesas: base.mesas.map(({ pedidoAtivoId: _pedidoAtivoId, clienteNome, ocupadaEm, ...mesa }) => {
      const comanda = abertas.get(mesa.id)
      // Mesa ocupada deixa de estar em limpeza.
      const { limpezaDesde: _limpezaDesde, ...semLimpeza } = mesa
      return comanda
        ? {
            ...semLimpeza,
            status: "ocupada",
            pedidoAtivoId: comanda.id,
            clienteNome: comanda.cliente.nome,
            ocupadaEm: comanda.criadoEm,
          }
        : { ...mesa, status: "livre" }
    }),
  }
}

const reais = (valor: number) => Math.round(valor * 100) / 100

/** Comanda aberta da mesa, se houver. */
const comandaDa = (base: BaseLoja, mesaId: string) =>
  base.pedidos.find(
    (pedido) =>
      pedido.tipo === "mesa" && pedido.mesa?.id === mesaId && EM_ANDAMENTO.includes(pedido.status),
  )

/** O `por` do evento: o nome aparado e limitado, ou nada. */
function autor(por: string | undefined): { por?: string } {
  const nome = por?.trim().slice(0, 80)
  return nome ? { por: nome } : {}
}

const semContaPedida = ({ contaPedidaEm: _contaPedidaEm, ...comanda }: Pedido): Pedido => comanda

/** Subtotal e total da comanda refeitos a partir dos itens. */
function recalcular(pedido: Pedido): Pedido {
  const subtotal = reais(pedido.itens.reduce((soma, item) => soma + item.total, 0))
  return { ...pedido, subtotal, total: reais(subtotal - pedido.desconto) }
}

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

/** Pedido de um dia que já passou não fica aberto: entrega e comanda viram concluídas. */
function encerrar(pedido: Pedido, momento: string): Pedido {
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
    const ultimo = anteriores.at(-1)
    const novos = gerarPedidos({
      catalogo: base,
      segmento,
      de: addDays(startOfDay(new Date(geradoEm)), 1),
      agora,
      ...(ultimo ? { ultimo } : {}),
      agendamentos: anteriores,
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
  ): Promise<Pedido> {
    const base = await carregar()
    const indice = base.pedidos.findIndex((pedido) => pedido.id === id)
    if (indice < 0) throw new Error("Pedido não encontrado")
    const antes = base.pedidos[indice]
    const agora = new Date().toISOString()
    // Mudou de etapa: o histórico anota para onde foi e quando.
    const novo = comEtapa({ ...mudar(antes, base), atualizadoEm: agora }, agora)
    // O estoque acompanha o que o pedido passou a consumir (ou a devolver).
    const comEstoque = aplicarEstoque(base, antes, novo, estoque)
    const pedidos = comEstoque.pedidos.with(indice, novo)
    const atualizada = abrirMesas({ ...comEstoque, pedidos })
    // A conta da mesa foi paga agora (e não por um dia que virou): a mesa espera a limpeza.
    const contaFechada = novo.tipo === "mesa" && !antes.pagoEm && novo.pagoEm
    await substituir(
      contaFechada && atualizada.salao.limpeza
        ? {
            ...atualizada,
            mesas: atualizada.mesas.map((mesa) =>
              mesa.id === novo.mesa?.id ? { ...mesa, limpezaDesde: novo.pagoEm } : mesa,
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
  function alterarComanda(id: number, mudar: (comanda: Pedido) => Pedido) {
    return alterar(
      id,
      (pedido) => {
        if (pedido.tipo !== "mesa" || !EM_ANDAMENTO.includes(pedido.status)) {
          throw new Error("Só a comanda aberta de uma mesa pode mudar.")
        }
        return recalcular(mudar(pedido))
      },
      // O garçom não lança mais do que há.
      { conferir: true },
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
      ultimo: base.pedidos.at(-1),
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
          return {
            ...pedido,
            status: proximo,
            ...(pagoAgora
              ? { situacaoPagamento: "pago" as const, pagoEm: new Date().toISOString() }
              : {}),
          }
        })
      },

      /** `motivo` é opcional: quem está com pressa cancela sem escolher. */
      cancelar(id: number, de: StatusPedido, motivo?: MotivoCancelamento) {
        return alterar(id, (pedido) => {
          conferirEtapa(pedido, de)
          if (pedido.status === "concluido")
            throw new Error("Pedido concluído não pode ser cancelado")
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
        const ultimo = base.pedidos.at(-1)
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
        const ultimo = base.pedidos.at(-1)
        const id = (ultimo?.id ?? 0) + 1
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
        const id = (base.pedidos.at(-1)?.id ?? 0) + 1
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

      marcarLimpa(id: string) {
        return mudarMesa(id, ({ limpezaDesde: _limpezaDesde, ...mesa }) => mesa)
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
        { pessoas, garcom: garcomPedido, clienteNome, confirmarReserva }: AberturaMesa,
      ): Promise<Pedido> {
        const base = await carregar()
        const mesa = base.mesas.find((item) => item.id === mesaId)
        if (!mesa) throw new Error("Mesa não encontrada")
        if (mesa.bloqueio) throw new Error(`A mesa ${mesa.numero} está bloqueada.`)
        if (comandaDa(base, mesa.id)) throw new Error(`A mesa ${mesa.numero} já está aberta.`)
        if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 99) {
          throw new Error("Informe de 1 a 99 pessoas.")
        }
        const agoraData = new Date()
        const { antecedenciaMin, toleranciaMin } = base.salao.reservas
        // A próxima reserva marcada da mesa, ainda dentro da tolerância.
        const reserva = base.reservas
          .filter(
            (item) =>
              item.mesaId === mesa.id &&
              item.status === "marcada" &&
              Date.parse(item.inicio) >= agoraData.getTime() - toleranciaMin * 60_000,
          )
          .toSorted((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0]
        const reservada =
          reserva &&
          estadoDaMesa(mesa, undefined, { reserva, agora: agoraData, antecedenciaMin }).estado ===
            "reservada"
        if (reservada && !confirmarReserva) {
          throw new Error(
            `A mesa ${mesa.numero} está reservada às ${format(new Date(reserva.inicio), "HH:mm")}. Confirme para abrir.`,
          )
        }
        const ativos = base.salao.garcons.filter((item) => item.ativo)
        const pedido = garcomPedido?.trim() ?? ""
        let garcom: string | undefined
        if (ativos.length > 0) {
          if (!pedido) throw new Error("Escolha o garçom.")
          garcom = ativos.find((item) => normalizar(item.nome) === normalizar(pedido))?.nome
          if (!garcom) throw new Error("Esse garçom não está na lista do salão.")
        }
        const agora = new Date().toISOString()
        const id = (base.pedidos.at(-1)?.id ?? 0) + 1
        const comanda = comEvento(
          comEtapa(
            comandaNova(base, mesa, {
              id,
              agora,
              cliente: clienteNome?.trim().slice(0, 80),
              garcom,
              pessoas,
              itens: [],
              enviarParaCozinha: false,
            }),
            agora,
          ),
          {
            tipo: "aberta",
            em: agora,
            ...(garcom ? { por: garcom } : {}),
            texto: `Mesa aberta para ${plural(pessoas, "pessoa", "pessoas")}`,
          },
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
        const rodada = Math.max(0, ...(aberta?.itens.map((item) => item.rodada ?? 1) ?? [])) + 1
        const id = aberta?.id ?? (base.pedidos.at(-1)?.id ?? 0) + 1
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
            ...(observacao ? { observacao } : {}),
            total: reais(precoUnitario * quantidade),
            rodada,
            vaiParaCozinha,
            lancadoEm: agora,
          }
        })

        const garcom = lancamento.garcom?.trim().slice(0, 80)
        const cliente = lancamento.clienteNome?.trim().slice(0, 80)
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
                    ...(cliente ? { cliente: { ...aberta.cliente, nome: cliente } } : {}),
                    atualizadoEm: agora,
                    estoqueBaixado: true,
                  }
                : comandaNova(base, mesa, {
                    id,
                    agora,
                    cliente,
                    garcom,
                    itens: novos,
                    enviarParaCozinha: vaiParaCozinha,
                  }),
            ),
            agora,
          ),
          {
            tipo: "rodada",
            em: agora,
            ...autor(lancamento.por),
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

      alterarQuantidade(pedidoId: number, itemId: string, quantidade: number) {
        return alterarComanda(pedidoId, (comanda) => {
          if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
            throw new Error("Informe uma quantidade válida.")
          }
          conferirItem(comanda, itemId)
          return {
            ...comanda,
            itens: comanda.itens.map((item) =>
              item.id === itemId
                ? { ...item, quantidade, total: reais(item.precoUnitario * quantidade) }
                : item,
            ),
          }
        })
      },

      removerItem(pedidoId: number, itemId: string) {
        return alterarComanda(pedidoId, (comanda) => {
          conferirItem(comanda, itemId)
          return { ...comanda, itens: comanda.itens.filter((item) => item.id !== itemId) }
        })
      },

      /** A mesa pediu a conta: fica a hora do primeiro pedido. */
      pedirConta(pedidoId: number, por?: string) {
        return alterarComanda(pedidoId, (comanda) => {
          if (comanda.contaPedidaEm) return comanda
          const agora = new Date().toISOString()
          return comEvento(
            { ...comanda, contaPedidaEm: agora },
            { tipo: "conta-pedida", em: agora, ...autor(por), texto: "Pediu a conta" },
          )
        })
      },

      /** Recebe a conta: conclui a comanda, marca como paga e a mesa fica livre. */
      fecharConta(pedidoId: number, pagamento: PagamentoMesa) {
        return alterarComanda(pedidoId, (comanda) => {
          conferirPagamento(pagamento)
          if (comanda.itens.length === 0) throw new Error("A comanda está vazia.")
          return {
            ...comanda,
            status: "concluido",
            pagamento,
            situacaoPagamento: "pago",
            pagoEm: new Date().toISOString(),
          }
        })
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
