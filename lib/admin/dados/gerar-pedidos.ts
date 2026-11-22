import { addDays, addMinutes, format, isSameDay, isSameMonth, startOfDay } from "date-fns"
import { uniformInt } from "pure-rand/distribution/uniformInt"
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus"
import type { RandomGenerator } from "pure-rand/types/RandomGenerator"
import { horariosLivres } from "../regras/agenda"
import { comTotais, dividirIgualmente } from "../regras/conta"
import { calcularPesagem } from "../regras/pesagem"
import { proximoStatus } from "../regras/status"
import { SEGMENTOS_PAINEL, type SegmentoPainelId, temModulo, temRecurso } from "../segmentos-painel"
import type {
  CatalogoLoja,
  EtapaDoPedido,
  FormaPagamento,
  ItemPedido,
  Mesa,
  MotivoCancelamento,
  OrigemPedido,
  Pedido,
  Produto,
  SituacaoPagamento,
  StatusPedido,
  TipoPedido,
} from "./tipos"

export type OpcoesGeracao = {
  catalogo: CatalogoLoja
  segmento: SegmentoPainelId
  /** Primeiro dia gerado. */
  de: Date
  /** Momento atual: nada é criado depois dele, e hoje tem pedidos em andamento. */
  agora: Date
  /** Último pedido que já existe, para continuar a numeração. */
  ultimo?: { id: number; numero: number; criadoEm?: string }
  /** Salão: atendimentos já marcados, que ocupam a agenda. */
  agendamentos?: Pedido[]
  /** Mesas com comanda aberta de antes (a conta atravessou a virada do dia): ninguém senta nelas. */
  mesasOcupadas?: string[]
}

/** Salão: a duração soma todos os serviços (60 min quando o serviço não diz). */
function duracaoDos(itens: ItemPedido[], produtos: Produto[]) {
  return itens.reduce(
    (soma, item) =>
      soma +
      (produtos.find((produto) => produto.id === item.produtoId)?.duracaoMin ?? 60) *
        item.quantidade,
    0,
  )
}

/** Salão: os horários livres a partir de `dia`, procurando até `dias` dias à frente. */
function primeirosLivres(
  catalogo: CatalogoLoja,
  dia: Date,
  dias: number,
  duracaoMin: number,
  agendamentos: Pedido[],
  agora: Date,
) {
  for (let passo = 0; passo < dias; passo += 1) {
    const livres = horariosLivres({
      dia: addDays(dia, passo),
      duracaoMin,
      agendamentos,
      horarios: catalogo.loja.horarios,
      capacidade: catalogo.loja.capacidadeAtendimentos ?? 1,
      agora,
    })
    if (livres.length > 0) return livres
  }
  return []
}

const RUAS = [
  "Rua Coronel Domiciano",
  "Avenida Integração",
  "Rua Bernardino de Campos",
  "Rua Dr. Moreira",
  "Travessa São José",
  "Rua das Flores",
  "Avenida Pedro de Toledo",
  "Rua Treze de Maio",
]

/**
 * Movimento de agora: a demonstração sempre abre com pedidos em todas as etapas
 * (aguardando pagamento, novo, em preparo, pronto, a caminho e mesa aberta).
 * `idade` em minutos antes de agora.
 */
const AO_VIVO: readonly {
  idade: number
  tipo: TipoPedido
  pagamento: FormaPagamento
  /** Mesa que pediu a conta há tantos minutos. */
  contaPedidaHa?: number
  /** Mesa com o pedido pronto para servir há tantos minutos. */
  servirHa?: number
  /** No açougue, com carne no quilo, fica sempre para pagar depois de pesar. */
  pesar?: boolean
  /** Mesa que já pagou metade da conta em Pix, há 5 min. */
  pagouParte?: boolean
  /** Mesa que fechou a conta há tantos minutos, metade em Pix e o resto em dinheiro. */
  fechadaHa?: number
  /** Senta na primeira destas mesas e junta as outras, se estiverem todas livres. */
  juntas?: number[]
}[] = [
  { idade: 110, tipo: "mesa", pagamento: "dinheiro", fechadaHa: 20 },
  { idade: 95, tipo: "mesa", pagamento: "dinheiro", contaPedidaHa: 12 },
  { idade: 80, tipo: "mesa", pagamento: "dinheiro", pagouParte: true },
  { idade: 70, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 64, tipo: "entrega", pagamento: "pix" },
  { idade: 52, tipo: "entrega", pagamento: "cartao-na-entrega" },
  { idade: 48, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 36, tipo: "entrega", pagamento: "dinheiro" },
  { idade: 33, tipo: "mesa", pagamento: "dinheiro", servirHa: 4 },
  { idade: 31, tipo: "retirada", pagamento: "pix" },
  { idade: 21, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 14, tipo: "entrega", pagamento: "cartao-na-entrega" },
  { idade: 12, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 7, tipo: "mesa", pagamento: "dinheiro", juntas: [15, 16] },
  { idade: 5, tipo: "retirada", pagamento: "dinheiro", pesar: true },
  { idade: 2, tipo: "entrega", pagamento: "pix" },
]
const OBSERVACOES = [
  "Sem cebola, por favor",
  "Caprichar no molho",
  "Tocar o interfone",
  "Troco certinho",
]

const reais = (valor: number) => Math.round(valor * 100) / 100
const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

/** Sorteador do dia: o mesmo dia e segmento sempre dão a mesma sequência. */
function sorteador(dia: Date, segmento: SegmentoPainelId) {
  const indice = SEGMENTOS_PAINEL.findIndex((item) => item.id === segmento)
  return sorteadorDaSemente(Number(format(dia, "yyyyMMdd")) * 10 + indice)
}

export function sorteadorDaSemente(semente: number) {
  const rng: RandomGenerator = xoroshiro128plus(semente)
  const inteiro = (de: number, ate: number) => uniformInt(rng, de, ate)
  return {
    inteiro,
    /** Verdadeiro com a chance dada, de 0 a 100. */
    chance: (porcento: number) => inteiro(1, 100) <= porcento,
    um: <T>(lista: readonly T[]): T => lista[inteiro(0, lista.length - 1)],
  }
}
type Sorteador = ReturnType<typeof sorteador>

/**
 * Token do pedido de demonstração: 128 bits (4 inteiros de 32 bits, em hex), sem o
 * segmento nem o id. Sai de um sorteador próprio, semeado com um único sorteio do dia:
 * assim a sequência do dia (e os pedidos gerados depois deste) não muda.
 */
function tokenDoSorteio(sorte: Sorteador): string {
  const proprio = sorteadorDaSemente(sorte.inteiro(100_000, 999_999))
  return Array.from({ length: 4 }, () =>
    proprio.inteiro(0, 0xffff_ffff).toString(16).padStart(8, "0"),
  ).join("")
}

/** Monta um item: preço base (ou do quilo), opções obrigatórias e adicionais cobrados além do grátis. */
function montarItem(
  sorte: Sorteador,
  produto: Produto,
  id: string,
  segmento: SegmentoPainelId,
  balcao: boolean,
): ItemPedido {
  const opcoes: string[] = []
  const produtosDasOpcoes: string[] = []
  let adicionais = 0
  if (temRecurso(segmento, "adicionais")) {
    for (const grupo of produto.grupos.filter((g) => g.ativo).sort((a, b) => a.ordem - b.ordem)) {
      const disponiveis = grupo.itens.filter((item) => item.ativo)
      if (disponiveis.length === 0) continue
      const quantos = grupo.minimo > 0 ? grupo.minimo : sorte.chance(30) ? 1 : 0
      const restantes = [...disponiveis]
      const escolhidos: typeof disponiveis = []
      while (escolhidos.length < quantos && restantes.length > 0) {
        escolhidos.push(restantes.splice(sorte.inteiro(0, restantes.length - 1), 1)[0])
      }
      if (escolhidos.length === 0) continue
      escolhidos.forEach((item, posicao) => {
        if (posicao >= grupo.gratisAte) adicionais += item.precoAdicional
      })
      opcoes.push(`${grupo.nome}: ${escolhidos.map((item) => item.nome).join(", ")}`)
      // Combos: a opção que é um produto sai do estoque dele.
      for (const item of escolhidos) if (item.produtoId) produtosDasOpcoes.push(item.produtoId)
    }
  }

  const precoBase =
    balcao && temRecurso(segmento, "precoBalcao") && (produto.precoBalcao ?? 0) > 0
      ? (produto.precoBalcao as number)
      : produto.preco
  const porQuilo = produto.unidade === "kg"
  const pesoGramas = porQuilo ? sorte.inteiro(3, 20) * 100 : undefined
  const quantidade = porQuilo ? 1 : sorte.chance(70) ? 1 : 2
  const precoUnitario = reais(
    (porQuilo ? (precoBase * (pesoGramas as number)) / 1000 : precoBase) + adicionais,
  )

  return {
    id,
    produtoId: produto.id,
    nome: produto.nome,
    quantidade,
    precoUnitario,
    ...(produto.custo !== undefined ? { custoUnitario: produto.custo } : {}),
    opcoes,
    total: reais(precoUnitario * quantidade),
    ...(pesoGramas ? { pesoGramas, precoKg: precoBase } : {}),
    ...(produtosDasOpcoes.length > 0 ? { produtosDasOpcoes } : {}),
  }
}

/** Status de um pedido de comida pela idade, em minutos, quando ainda é de hoje. */
function statusPorIdade(tipo: TipoPedido, idade: number, online: boolean): StatusPedido {
  if (online && idade < 3) return "aguardando-pagamento"
  if (idade < 8) return "recebido"
  if (idade < 25) return "em-preparo"
  // A mesa fica aberta até fechar a conta.
  if (tipo === "mesa") return idade < 120 ? "pronto" : "concluido"
  if (idade < 40) return "pronto"
  if (tipo === "entrega" && idade < 75) return "saiu-para-entrega"
  return "concluido"
}

/** Minutos sorteados para sair de cada etapa (o que vem depois decide, na entrega e na mesa). */
const MINUTOS_PARA_SAIR: Record<string, [number, number]> = {
  "aguardando-pagamento": [1, 4],
  recebido: [1, 6],
  "em-preparo": [10, 30],
  "pronto:saiu-para-entrega": [2, 15],
  "pronto:concluido": [3, 20],
  "mesa:pronto": [30, 90],
  "saiu-para-entrega": [10, 30],
  cancelado: [2, 20],
}

/** Em andamento hoje, a etapa muda nas idades de `statusPorIdade`, em minutos. */
const IDADE_DA_ETAPA: Partial<Record<StatusPedido, number>> = {
  recebido: 3,
  "em-preparo": 8,
  pronto: 25,
  "saiu-para-entrega": 40,
}

/**
 * Histórico de status gerado: as etapas da fila, da criação até a atual. Encerrado, os
 * tempos sorteados se ajustam para terminar em `atualizado`; em andamento, cada etapa
 * começa na idade em que a fila a mostra. Usa um sorteador próprio, para não mudar os
 * outros sorteios do dia.
 */
function historicoGerado({
  id,
  tipo,
  status,
  online,
  criado,
  atualizado,
  agendamento,
}: {
  id: number
  tipo: TipoPedido
  status: StatusPedido
  online: boolean
  criado: Date
  atualizado: Date
  agendamento?: Pedido["agendamento"]
}): EtapaDoPedido[] {
  // Salão: o atendimento começa e termina na hora marcada; cancelado, nem começou.
  if (agendamento) {
    const inicio = new Date(agendamento.inicio)
    const etapas: [StatusPedido, Date][] =
      status === "cancelado"
        ? [
            ["recebido", criado],
            ["cancelado", atualizado],
          ]
        : ([
            ["recebido", criado],
            ["em-preparo", inicio],
            ["concluido", addMinutes(inicio, agendamento.duracaoMin)],
          ].slice(0, ["recebido", "em-preparo", "concluido"].indexOf(status) + 1) as [
            StatusPedido,
            Date,
          ][])
    return etapas.map(([etapa, em]) => ({ status: etapa, em: em.toISOString() }))
  }
  const sorte = sorteadorDaSemente((Math.floor(criado.getTime() / 1000) + id) | 0)
  const caminho: StatusPedido[] = online ? ["aguardando-pagamento", "recebido"] : ["recebido"]
  for (;;) {
    const ultimo = caminho.at(-1) as StatusPedido
    const proximo =
      proximoStatus(tipo, ultimo) ?? (tipo === "mesa" && ultimo === "pronto" ? "concluido" : null)
    if (!proximo) break
    caminho.push(proximo)
  }
  const ate =
    status === "cancelado"
      ? [...caminho.slice(0, sorte.inteiro(1, Math.min(3, caminho.length - 1))), status]
      : caminho.slice(0, caminho.indexOf(status) + 1)

  if (status !== "concluido" && status !== "cancelado") {
    return ate.map((etapa, indice) => ({
      status: etapa,
      em: addMinutes(criado, indice === 0 ? 0 : (IDADE_DA_ETAPA[etapa] ?? 0)).toISOString(),
    }))
  }
  const minutos = ate.slice(1).map((etapa, indice) => {
    const antes = ate[indice]
    const faixa =
      MINUTOS_PARA_SAIR[etapa === "cancelado" ? etapa : `${tipo}:${antes}`] ??
      MINUTOS_PARA_SAIR[`${antes}:${etapa}`] ??
      MINUTOS_PARA_SAIR[antes]
    return sorte.inteiro(...faixa)
  })
  const total = minutos.reduce((soma, valor) => soma + valor, 0)
  const escala = total > 0 ? (atualizado.getTime() - criado.getTime()) / total : 0
  let decorrido = 0
  return ate.map((etapa, indice) => {
    if (indice > 0) decorrido += minutos[indice - 1]
    const em =
      indice === ate.length - 1 ? atualizado : new Date(criado.getTime() + decorrido * escala)
    return { status: etapa, em: em.toISOString() }
  })
}

const comMotivo = (motivo: MotivoCancelamento | undefined) =>
  motivo ? { motivoCancelamento: motivo } : {}

/** Motivos sorteados para os cancelados, com o peso de cada um. */
const MOTIVOS_SORTEADOS: [MotivoCancelamento | undefined, number][] = [
  [undefined, 20],
  ["cliente-desistiu", 25],
  ["demora", 15],
  ["sem-estoque", 15],
  ["fora-da-area", 10],
  ["loja-fechou", 5],
  ["pagamento-nao-aprovado", 5],
  ["outro", 5],
]

/**
 * Motivo de um cancelado gerado. Quem cancelou antes de pagar online teve o pagamento
 * recusado; fora da área só vale para entrega. Uns ficam sem motivo, como na loja com pressa.
 */
function motivoGerado(id: number, tipo: TipoPedido, historico: EtapaDoPedido[]) {
  if (historico.at(-2)?.status === "aguardando-pagamento") return "pagamento-nao-aprovado"
  const sorte = sorteadorDaSemente((id * 7919) | 0)
  const validos = MOTIVOS_SORTEADOS.filter(
    ([motivo]) => motivo !== "fora-da-area" || tipo === "entrega",
  )
  let resto = sorte.inteiro(
    1,
    validos.reduce((soma, [, peso]) => soma + peso, 0),
  )
  for (const [motivo, peso] of validos) {
    resto -= peso
    if (resto <= 0) return motivo
  }
  return undefined
}

function formaDePagamento(
  sorte: Sorteador,
  origem: OrigemPedido,
  aceitas: Record<FormaPagamento, boolean>,
) {
  const pesos: [FormaPagamento, number][] =
    origem === "site"
      ? [
          ["pix", 40],
          ["cartao-online", 15],
          ["dinheiro", 25],
          ["cartao-na-entrega", 20],
        ]
      : [
          ["dinheiro", 40],
          ["pix", 30],
          ["cartao-na-entrega", 30],
        ]
  const validas = pesos.filter(([forma]) => aceitas[forma])
  const total = validas.reduce((soma, [, peso]) => soma + peso, 0)
  let sorteio = sorte.inteiro(1, Math.max(total, 1))
  for (const [forma, peso] of validas) {
    sorteio -= peso
    if (sorteio <= 0) return forma
  }
  return "dinheiro"
}

/** Troco: a menor nota redonda que cobre o total. */
function trocoPara(total: number) {
  return [20, 50, 100, 200].find((nota) => nota >= total) ?? Math.ceil(total / 50) * 50
}

/**
 * Gera os pedidos de demonstração de `de` até hoje, sempre iguais para o mesmo dia.
 * Os dias passados ficam encerrados; hoje vai só até `agora`, com pedidos em andamento.
 */
export function gerarPedidos({
  catalogo,
  segmento,
  de,
  agora,
  ultimo,
  agendamentos,
  mesasOcupadas,
}: OpcoesGeracao): Pedido[] {
  const { loja } = catalogo
  const produtos = catalogo.produtos.filter((produto) => produto.ativo && produto.disponivel)
  const bairros = catalogo.bairros.filter((bairro) => bairro.ativo)
  const motoboys = catalogo.motoboys.filter((motoboy) => motoboy.ativo)
  const salao = segmento === "salao"
  const temMesas = temModulo(segmento, "mesas") && catalogo.mesas.length > 0
  const temPdv = temModulo(segmento, "pdv")
  const entrega = loja.aceitaEntrega && bairros.length > 0
  const mensal = temRecurso(segmento, "numeroMensal")

  const pedidos: Pedido[] = []
  if (produtos.length === 0 || catalogo.clientes.length === 0) return pedidos

  let id = ultimo?.id ?? 0
  let numero = ultimo?.numero ?? 0
  let mesDoNumero = ultimo?.criadoEm ? new Date(ultimo.criadoEm) : undefined
  const mesasAbertas = new Set<string>(mesasOcupadas)
  // Mesa bloqueada não recebe comanda; o garçom vem dos ativos da loja.
  const mesasUsaveis = catalogo.mesas.filter((item) => !item.bloqueio)
  const garcons = catalogo.salao.garcons.filter((item) => item.ativo)
  // Salão: o que já ocupa a agenda, como "marcado", para respeitar a capacidade.
  let agenda: Pedido[] = (agendamentos ?? [])
    .filter((pedido) => pedido.agendamento && pedido.status !== "cancelado")
    .map((pedido) => ({ ...pedido, status: "recebido" }))
  const terminaEm = (pedido: Pedido) =>
    Date.parse(pedido.agendamento?.inicio ?? "") + (pedido.agendamento?.duracaoMin ?? 0) * 60_000

  for (let dia = startOfDay(de); dia <= agora; dia = addDays(dia, 1)) {
    // O que já terminou antes deste dia não disputa horário com o que vem: sai da conta.
    if (salao) agenda = agenda.filter((pedido) => terminaEm(pedido) > dia.getTime())
    const horario = loja.horarios.find((item) => item.dia === dia.getDay())
    if (!horario?.aberto) continue
    const abre = minutos(horario.abre)
    const fecha = Math.max(
      minutos(horario.fecha) > abre ? minutos(horario.fecha) : 24 * 60 - 1,
      abre + 60,
    )
    const hoje = isSameDay(dia, agora)
    const sorte = sorteador(dia, segmento)
    const fimDeSemana = [0, 5, 6].includes(dia.getDay())
    const quantidade = salao
      ? sorte.inteiro(3, 6)
      : sorte.inteiro(10, 18) + (fimDeSemana ? sorte.inteiro(6, 12) : 0)

    // Hoje, o sorteio vai até 90 min atrás; o movimento de agora vem do roteiro AO_VIVO.
    const limite = hoje && !salao ? addMinutes(agora, -90) : agora
    const momentos: { criado: Date; vivo?: (typeof AO_VIVO)[number] }[] = Array.from(
      { length: quantidade },
      () => ({ criado: addMinutes(dia, sorte.inteiro(abre, fecha - 1)) }),
    ).filter(({ criado }) => criado <= limite)
    if (hoje && !salao) {
      for (const vivo of AO_VIVO) momentos.push({ criado: addMinutes(agora, -vivo.idade), vivo })
    }
    momentos.sort((a, b) => a.criado.getTime() - b.criado.getTime())

    for (const { criado, vivo } of momentos) {
      id += 1
      if (mensal && mesDoNumero && !isSameMonth(mesDoNumero, criado)) numero = 0
      numero = mensal ? numero + 1 : id
      mesDoNumero = criado

      let tipo: TipoPedido = "atendimento"
      if (!salao) {
        const sorteio = sorte.inteiro(1, 100)
        tipo = vivo?.tipo ?? (sorteio <= 55 ? "entrega" : sorteio > 85 ? "mesa" : "retirada")
        if (tipo === "entrega" && !entrega) tipo = "retirada"
        // Sem mesa livre (ou sem salão), o cliente leva para viagem. Fora do roteiro ao vivo,
        // mesa com menos de 2 h ficaria aberta e tiraria o salão do roteiro: também vira retirada.
        if (
          tipo === "mesa" &&
          (!temMesas ||
            mesasUsaveis.every((item) => mesasAbertas.has(item.id)) ||
            (!vivo && agora.getTime() - criado.getTime() < 120 * 60_000))
        ) {
          tipo = "retirada"
        }
      }
      const origem: OrigemPedido =
        tipo === "mesa"
          ? "garcom"
          : !vivo && tipo !== "entrega" && temPdv && sorte.chance(35)
            ? "pdv"
            : "site"
      const cliente = sorte.um(catalogo.clientes)

      const itens = Array.from({ length: sorte.inteiro(1, salao ? 2 : 3) }, (_, indice) =>
        montarItem(sorte, sorte.um(produtos), `${id}-${indice + 1}`, segmento, origem !== "site"),
      )
      const subtotal = reais(itens.reduce((soma, item) => soma + item.total, 0))
      const bairro = tipo === "entrega" ? sorte.um(bairros) : undefined
      const taxaEntrega = bairro?.taxa ?? 0
      const desconto = origem === "pdv" && sorte.chance(15) ? reais(subtotal * 0.05) : 0
      const total = reais(subtotal - desconto + taxaEntrega)
      let pagamento =
        vivo && loja.pagamentos[vivo.pagamento]
          ? vivo.pagamento
          : formaDePagamento(sorte, origem, loja.pagamentos)
      // Açougue: parte dos pedidos do site com carne no quilo paga depois de pesar.
      const aposPesagem =
        temRecurso(segmento, "pagarAposPesagem") &&
        loja.pagamentos["pagar-apos-pesagem"] &&
        origem === "site" &&
        // No roteiro ao vivo, só quem não pagou online: assim há pedido aberto para pesar.
        (!vivo || (vivo.pagamento !== "pix" && vivo.pagamento !== "cartao-online")) &&
        itens.some((item) => item.pesoGramas) &&
        (vivo?.pesar || sorte.chance(35))
      if (aposPesagem) pagamento = "pagar-apos-pesagem"
      const online = origem === "site" && (pagamento === "pix" || pagamento === "cartao-online")

      // Status e momento do atendimento (salão) ou pela idade do pedido.
      let status: StatusPedido
      let agendamento: Pedido["agendamento"]
      if (salao) {
        const duracaoMin = duracaoDos(itens, produtos)
        // Um horário livre de um dia aberto, de hoje a uma semana, depois de quando foi pedido.
        const livres = primeirosLivres(
          catalogo,
          addDays(dia, sorte.inteiro(0, 6)),
          7,
          duracaoMin,
          agenda,
          criado,
        )
        if (livres.length === 0) {
          // Agenda cheia: o cliente desistiu. O número volta para o próximo.
          id -= 1
          numero = id
          continue
        }
        const inicio = sorte.um(livres)
        const fim = addMinutes(inicio, duracaoMin)
        agendamento = { inicio: inicio.toISOString(), duracaoMin }
        agenda.push({ id, status: "recebido", agendamento } as Pedido)
        if (fim <= agora) status = sorte.chance(8) ? "cancelado" : "concluido"
        else status = inicio <= agora ? "em-preparo" : "recebido"
      } else if (hoje) {
        const idade = (agora.getTime() - criado.getTime()) / 60_000
        status =
          origem === "pdv" || vivo?.fechadaHa ? "concluido" : statusPorIdade(tipo, idade, online)
        if (status === "concluido" && !vivo && sorte.chance(8)) status = "cancelado"
      } else {
        status = sorte.chance(8) ? "cancelado" : "concluido"
      }

      // Mesa: no máximo uma comanda aberta por mesa.
      let mesa: Pedido["mesa"]
      if (tipo === "mesa") {
        // O roteiro pode pedir mesas juntas: valem se estiverem todas livres.
        const pedidas = vivo?.juntas?.map((numero) =>
          mesasUsaveis.find((item) => item.numero === numero && !mesasAbertas.has(item.id)),
        )
        const juntas = pedidas?.every((item) => item !== undefined) ? (pedidas as Mesa[]) : []
        const livre = juntas[0] ?? (mesasUsaveis.find((item) => !mesasAbertas.has(item.id)) as Mesa)
        const outras = juntas.slice(1)
        if (status !== "concluido" && status !== "cancelado") {
          for (const item of [livre, ...outras]) mesasAbertas.add(item.id)
        }
        mesa = {
          id: livre.id,
          numero: livre.numero,
          ...(garcons.length > 0 ? { garcom: sorte.um(garcons).nome } : {}),
          pessoas: sorte.inteiro(1, livre.lugares),
          ...(outras.length > 0
            ? { juntadas: outras.map((item) => ({ id: item.id, numero: item.numero })) }
            : {}),
        }
      }

      const encerrado = status === "concluido" || status === "cancelado"
      let atualizado = encerrado
        ? new Date(Math.min(addMinutes(criado, sorte.inteiro(30, 70)).getTime(), agora.getTime()))
        : criado
      if (vivo?.fechadaHa) atualizado = addMinutes(agora, -vivo.fechadaHa)
      // A venda do PDV conclui na hora; o atendimento do salão, quando termina.
      const vendaNaHora = origem === "pdv" && status === "concluido" && !agendamento
      if (vendaNaHora) atualizado = criado
      if (agendamento && status === "concluido") {
        atualizado = addMinutes(new Date(agendamento.inicio), agendamento.duracaoMin)
      }
      const historico: EtapaDoPedido[] = vendaNaHora
        ? [{ status, em: criado.toISOString() }]
        : historicoGerado({ id, tipo, status, online, criado, atualizado, agendamento })
      let situacaoPagamento: SituacaoPagamento
      if (status === "cancelado") situacaoPagamento = "cancelado"
      else if (aposPesagem && status !== "concluido") situacaoPagamento = "pendente"
      else if (status === "aguardando-pagamento") situacaoPagamento = "pendente"
      else if (online || origem === "pdv" || status === "concluido") situacaoPagamento = "pago"
      else situacaoPagamento = "na-entrega"
      const pagoEm =
        situacaoPagamento === "pago"
          ? (online || origem === "pdv" ? criado : atualizado).toISOString()
          : undefined

      let novo: Pedido = {
        id,
        numero,
        token: tokenDoSorteio(sorte),
        origem,
        tipo,
        status,
        cliente,
        ...(bairro
          ? {
              endereco: {
                cep: "12630-000",
                logradouro: sorte.um(RUAS),
                numero: String(sorte.inteiro(10, 1999)),
                bairro: bairro.nome,
                cidade: bairro.cidade,
              },
            }
          : {}),
        ...(mesa ? { mesa } : {}),
        ...(mesa && vivo?.contaPedidaHa
          ? { contaPedidaEm: addMinutes(agora, -vivo.contaPedidaHa).toISOString() }
          : {}),
        ...(mesa && vivo?.servirHa
          ? { servirDesde: addMinutes(agora, -vivo.servirHa).toISOString() }
          : {}),
        itens,
        subtotal,
        desconto,
        taxaEntrega,
        total,
        pagamento,
        situacaoPagamento,
        ...(pagamento === "dinheiro" && sorte.chance(50) ? { trocoPara: trocoPara(total) } : {}),
        ...(pagoEm ? { pagoEm } : {}),
        ...(tipo === "entrega" &&
        motoboys.length > 0 &&
        (status === "saiu-para-entrega" || status === "concluido")
          ? { motoboyId: sorte.um(motoboys).id }
          : {}),
        ...(sorte.chance(15) ? { observacao: sorte.um(OBSERVACOES) } : {}),
        criadoEm: criado.toISOString(),
        atualizadoEm: atualizado.toISOString(),
        historico,
        ...(status === "cancelado" ? comMotivo(motivoGerado(id, tipo, historico)) : {}),
        ...(encerrado ? { impressoEm: addMinutes(criado, 1).toISOString() } : {}),
        enviarParaCozinha: true,
        ...(agendamento ? { agendamento } : {}),
      }
      // Comanda de hoje: taxa e couvert do salão congelados, e a conta paga em parte ou fechada.
      if (mesa && vivo) novo = contaAoVivo(novo, catalogo, vivo, agora)
      // Açougue: o cliente escolhe o dia de buscar, de hoje a dois dias depois.
      if (temRecurso(segmento, "dataRetirada") && tipo === "retirada") {
        novo = { ...novo, dataRetirada: format(addDays(criado, sorte.inteiro(0, 2)), "yyyy-MM-dd") }
      }
      // Pago depois de pesar: o concluído passou pela balança, com até 8% a mais ou a menos.
      if (aposPesagem && status === "concluido") {
        const pesos = Object.fromEntries(
          novo.itens
            .filter((item) => item.pesoGramas)
            .map((item) => [
              item.id,
              Math.round(
                ((item.pesoGramas as number) * item.quantidade * (100 + sorte.inteiro(-8, 8))) /
                  1000,
              ) * 10,
            ]),
        )
        const pesagem = calcularPesagem({ ...novo, situacaoPagamento: "pendente" }, pesos)
        novo = {
          ...novo,
          itens: pesagem.itens,
          subtotal: pesagem.subtotal,
          total: pesagem.novoTotal,
          pesagem: {
            totalEstimado: pesagem.totalEstimado,
            diferenca: pesagem.diferenca,
            pesadoEm: atualizado.toISOString(),
          },
        }
      }
      pedidos.push(novo)
    }
  }
  return pedidos
}

/**
 * A comanda do roteiro ao vivo com a taxa e o couvert do salão. A que pagou parte leva metade
 * em Pix, há 5 min; a fechada, metade em Pix e o resto em dinheiro, na hora do fechamento.
 */
function contaAoVivo(
  comanda: Pedido,
  { salao }: CatalogoLoja,
  { pagouParte, fechadaHa }: (typeof AO_VIVO)[number],
  agora: Date,
): Pedido {
  const comTaxa = comTotais({
    ...comanda,
    ...(salao.taxaServico.ativa
      ? { taxaServico: { percentual: salao.taxaServico.percentual } }
      : {}),
    ...(salao.couvert.ativo ? { couvert: { porPessoa: salao.couvert.porPessoa } } : {}),
  })
  const [metade, resto] = dividirIgualmente(comTaxa.total, 2)
  const pagamento = (id: string, forma: "pix" | "dinheiro", valor: number, em: Date) => ({
    id: `pag-${comanda.id}-${id}`,
    forma,
    valor,
    em: em.toISOString(),
    ...(comanda.mesa?.garcom ? { por: comanda.mesa.garcom } : {}),
  })
  if (pagouParte) {
    return { ...comTaxa, pagamentos: [pagamento("1", "pix", metade, addMinutes(agora, -5))] }
  }
  if (!fechadaHa) return comTaxa
  const pagoEm = addMinutes(agora, -fechadaHa)
  const { trocoPara: _troco, ...semTroco } = comTaxa
  return {
    ...semTroco,
    pagamento: resto > metade ? "dinheiro" : "pix",
    situacaoPagamento: "pago",
    pagoEm: pagoEm.toISOString(),
    pagamentos: [pagamento("1", "pix", metade, pagoEm), pagamento("2", "dinheiro", resto, pagoEm)],
  }
}

export type OpcoesPedidoAgora = Omit<OpcoesGeracao, "de"> & {
  /** Mesma semente, mesmo pedido: os testes conseguem prever o que chega. */
  semente: number
}

/**
 * Um pedido que acabou de chegar, para a demonstração da fila ao vivo: novo, pago online
 * ou a cobrar, e com o número seguinte (mensal na lanchonete). No salão, é um agendamento
 * para mais tarde hoje.
 */
export function gerarPedidoAgora({
  catalogo,
  segmento,
  agora,
  ultimo,
  semente,
  agendamentos,
}: OpcoesPedidoAgora): Pedido {
  const sorte = sorteadorDaSemente(semente)
  const { loja } = catalogo
  const produtos = catalogo.produtos.filter((produto) => produto.ativo && produto.disponivel)
  const bairros = catalogo.bairros.filter((bairro) => bairro.ativo)
  const salao = segmento === "salao"
  const id = (ultimo?.id ?? 0) + 1
  const mesmoMes = ultimo?.criadoEm ? isSameMonth(new Date(ultimo.criadoEm), agora) : true
  const numero = temRecurso(segmento, "numeroMensal")
    ? (mesmoMes ? (ultimo?.numero ?? 0) : 0) + 1
    : id

  const entrega = !salao && loja.aceitaEntrega && bairros.length > 0 && sorte.chance(60)
  const tipo: TipoPedido = salao ? "atendimento" : entrega ? "entrega" : "retirada"
  const itens = Array.from({ length: sorte.inteiro(1, salao ? 1 : 3) }, (_, indice) =>
    montarItem(sorte, sorte.um(produtos), `${id}-${indice + 1}`, segmento, false),
  )
  const subtotal = reais(itens.reduce((soma, item) => soma + item.total, 0))
  const bairro = entrega ? sorte.um(bairros) : undefined
  const total = reais(subtotal + (bairro?.taxa ?? 0))
  const pagamento = formaDePagamento(sorte, "site", loja.pagamentos)
  const online = pagamento === "pix" || pagamento === "cartao-online"

  let agendamento: Pedido["agendamento"]
  if (salao) {
    const duracaoMin = duracaoDos(itens, produtos)
    // Um dos próximos horários livres, a partir de uma hora daqui.
    const livres = primeirosLivres(
      catalogo,
      startOfDay(agora),
      14,
      duracaoMin,
      agendamentos ?? [],
      addMinutes(agora, 60),
    )
    const inicio = livres[sorte.inteiro(0, Math.min(3, livres.length - 1))] ?? addMinutes(agora, 60)
    agendamento = { inicio: inicio.toISOString(), duracaoMin }
  }

  return {
    id,
    numero,
    token: tokenDoSorteio(sorte),
    origem: "site",
    tipo,
    status: "recebido",
    cliente: sorte.um(catalogo.clientes),
    ...(bairro
      ? {
          endereco: {
            cep: "12630-000",
            logradouro: sorte.um(RUAS),
            numero: String(sorte.inteiro(10, 1999)),
            bairro: bairro.nome,
            cidade: bairro.cidade,
          },
        }
      : {}),
    itens,
    subtotal,
    desconto: 0,
    taxaEntrega: bairro?.taxa ?? 0,
    total,
    pagamento,
    situacaoPagamento: online ? "pago" : "na-entrega",
    ...(online ? { pagoEm: agora.toISOString() } : {}),
    ...(pagamento === "dinheiro" && sorte.chance(50) ? { trocoPara: trocoPara(total) } : {}),
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    historico: [{ status: "recebido", em: agora.toISOString() }],
    enviarParaCozinha: true,
    ...(agendamento ? { agendamento } : {}),
  }
}
