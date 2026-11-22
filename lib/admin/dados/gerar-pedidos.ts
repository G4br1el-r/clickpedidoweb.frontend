import {
  addDays,
  addMinutes,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfHour,
} from "date-fns"
import { uniformInt } from "pure-rand/distribution/uniformInt"
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus"
import type { RandomGenerator } from "pure-rand/types/RandomGenerator"
import { horariosLivres } from "../regras/agenda"
import { calcularPesagem } from "../regras/pesagem"
import { SEGMENTOS_PAINEL, type SegmentoPainelId, temModulo, temRecurso } from "../segmentos-painel"
import type {
  CatalogoLoja,
  FormaPagamento,
  ItemPedido,
  Mesa,
  MotivoRefazer,
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
const GARCONS = ["Lucas", "Paula", "Rafa", "Bia"]

/**
 * Movimento de agora: a demonstração sempre abre com pedidos em todas as etapas
 * (aguardando pagamento, novo, em preparo, pronto, a caminho e mesa aberta).
 * `idade` em minutos antes de agora. `agendado`: o cliente pediu para mais tarde, tantos
 * minutos depois de agora (na meia hora cheia).
 */
const AO_VIVO: readonly {
  idade: number
  tipo: TipoPedido
  pagamento: FormaPagamento
  agendado?: number
}[] = [
  { idade: 80, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 64, tipo: "entrega", pagamento: "pix" },
  { idade: 52, tipo: "entrega", pagamento: "cartao-na-entrega" },
  { idade: 36, tipo: "entrega", pagamento: "dinheiro" },
  { idade: 31, tipo: "retirada", pagamento: "pix" },
  { idade: 21, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 14, tipo: "entrega", pagamento: "cartao-na-entrega" },
  { idade: 7, tipo: "mesa", pagamento: "dinheiro" },
  { idade: 5, tipo: "retirada", pagamento: "dinheiro" },
  { idade: 2, tipo: "entrega", pagamento: "pix" },
  // Por último: os agendados não mudam o sorteio dos pedidos de antes.
  { idade: 1, tipo: "entrega", pagamento: "dinheiro", agendado: 90 },
  { idade: 0.5, tipo: "retirada", pagamento: "dinheiro", agendado: 60 },
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
  const mesasAbertas = new Set<string>()
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
        // Sem mesa livre (ou sem salão), o cliente leva para viagem.
        if (
          tipo === "mesa" &&
          (!temMesas || catalogo.mesas.every((item) => mesasAbertas.has(item.id)))
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
        sorte.chance(35)
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
        status = vivo?.agendado
          ? "recebido"
          : origem === "pdv"
            ? "concluido"
            : statusPorIdade(tipo, idade, online)
        if (status === "concluido" && !vivo && sorte.chance(8)) status = "cancelado"
      } else {
        status = sorte.chance(8) ? "cancelado" : "concluido"
      }

      // Mesa: no máximo uma comanda aberta por mesa.
      let mesa: Pedido["mesa"]
      if (tipo === "mesa") {
        const livre = catalogo.mesas.find((item) => !mesasAbertas.has(item.id)) as Mesa
        if (status !== "concluido" && status !== "cancelado") mesasAbertas.add(livre.id)
        mesa = { id: livre.id, numero: livre.numero, garcom: sorte.um(GARCONS) }
      }

      const encerrado = status === "concluido" || status === "cancelado"
      const atualizado = encerrado
        ? new Date(Math.min(addMinutes(criado, sorte.inteiro(30, 70)).getTime(), agora.getTime()))
        : criado
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
        ...(encerrado ? { impressoEm: addMinutes(criado, 1).toISOString() } : {}),
        enviarParaCozinha: true,
        ...(agendamento ? { agendamento } : {}),
      }
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
      const agendadoPara = vivo?.agendado ? meiaHoraDepois(agora, vivo.agendado) : undefined
      if (agendadoPara) {
        novo = { ...novo, itens: novo.itens.map((item) => ({ ...item, agendadoPara })) }
      }
      pedidos.push(comHorarios(novo, atualizado, agora))
    }
  }
  return pedidos
}

const CAMINHO_DA_COZINHA: StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
  "concluido",
]

/**
 * A hora de cada etapa do pedido gerado. Não sorteia de novo, para não mudar os outros
 * pedidos: o preparo começa 2 a 5 min depois da chegada, fica pronto 8 a 15 min depois e
 * a entrega sai 3 a 8 min depois de pronta, tudo antes dos 25 min em que o status muda.
 * Concluído e cancelado fecham na última atualização; a venda do balcão não passa pela
 * cozinha. Na mesa, o garçom serve 3 a 6 min depois de pronto, se já deu tempo.
 */
/** A primeira meia hora cheia tantos minutos depois de agora, se ainda for hoje. */
function meiaHoraDepois(agora: Date, minutos: number): string | undefined {
  const depois = addMinutes(agora, minutos)
  const para = addMinutes(startOfHour(depois), Math.ceil(depois.getMinutes() / 30) * 30)
  return isSameDay(para, agora) ? para.toISOString() : undefined
}

function comHorarios(pedido: Pedido, atualizado: Date, agora: Date): Pedido {
  const criado = new Date(pedido.criadoEm)
  const hora = (data: Date) => data.toISOString()
  if (pedido.status === "aguardando-pagamento") {
    return { ...pedido, etapas: { "aguardando-pagamento": hora(criado) } }
  }
  const etapas: Partial<Record<StatusPedido, string>> = { recebido: hora(criado) }
  if (pedido.status === "cancelado") return canceladoComHorarios(pedido, etapas, atualizado)

  if (pedido.agendamento) {
    const inicio = new Date(pedido.agendamento.inicio)
    if (pedido.status !== "recebido") etapas["em-preparo"] = hora(inicio)
    if (pedido.status === "concluido") {
      etapas.concluido = hora(addMinutes(inicio, pedido.agendamento.duracaoMin))
    }
    return { ...pedido, etapas }
  }
  if (pedido.origem === "pdv")
    return { ...pedido, etapas: { ...etapas, concluido: hora(atualizado) } }

  const ate = CAMINHO_DA_COZINHA.indexOf(pedido.status)
  const iniciou = addMinutes(criado, 2 + (pedido.id % 4))
  const pronto = addMinutes(iniciou, 8 + (pedido.id % 8))
  if (ate >= 1) etapas["em-preparo"] = hora(iniciou)
  if (ate >= 2) etapas.pronto = hora(pronto)
  if (ate >= 3 && pedido.tipo === "entrega") {
    etapas["saiu-para-entrega"] = hora(addMinutes(pronto, 3 + (pedido.id % 6)))
  }
  if (ate === 4) etapas.concluido = hora(atualizado)

  const servido = addMinutes(pronto, 3 + (pedido.id % 4))
  const limite = ate === 4 ? atualizado : agora
  const serviu = pedido.tipo === "mesa" && ate >= 2 && servido <= limite
  const itens = pedido.itens.map((item) => {
    if (ate < 1 || !(item.vaiParaCozinha ?? pedido.enviarParaCozinha)) return item
    return {
      ...item,
      iniciadoEm: hora(iniciou),
      ...(ate >= 2 ? { feitoEm: hora(pronto) } : {}),
      ...(serviu ? { servidoEm: hora(servido) } : {}),
    }
  })
  const comItens = { ...pedido, itens, etapas }
  return ate >= 3 ? comRefazer(comItens, pronto, ate === 4 ? atualizado : agora) : comItens
}

const MOTIVOS_DA_DEMO: MotivoRefazer[] = ["errado", "caiu", "reclamacao", "outro"]

/**
 * Um em cada três cancelados da cozinha foi cancelado depois de começar: os itens já
 * tinham sido iniciados (2 a 5 min depois da chegada), antes do cancelamento.
 */
function canceladoComHorarios(
  pedido: Pedido,
  etapas: Partial<Record<StatusPedido, string>>,
  atualizado: Date,
): Pedido {
  const comCancelado = { ...pedido, etapas: { ...etapas, cancelado: atualizado.toISOString() } }
  const iniciou = addMinutes(new Date(pedido.criadoEm), 2 + (pedido.id % 4))
  if (pedido.origem === "pdv" || pedido.id % 3 !== 0 || iniciou >= atualizado) return comCancelado
  return {
    ...comCancelado,
    etapas: { ...comCancelado.etapas, "em-preparo": iniciou.toISOString() },
    itens: pedido.itens.map((item) =>
      (item.vaiParaCozinha ?? pedido.enviarParaCozinha)
        ? { ...item, iniciadoEm: iniciou.toISOString() }
        : item,
    ),
  }
}

/**
 * Um pedido em 23 que já saiu teve um item refeito: 4 a 8 min depois de pronto, com o
 * preparo e a saída do refazer até o limite (o encerramento ou agora). Sem sortear.
 */
function comRefazer(pedido: Pedido, pronto: Date, limite: Date): Pedido {
  const [primeiro] = pedido.itens.filter((item) => item.vaiParaCozinha ?? pedido.enviarParaCozinha)
  if (!primeiro || pedido.id % 23 !== 0) return pedido
  const em = addMinutes(pronto, 4 + (pedido.id % 5))
  const iniciou = addMinutes(em, 2)
  const feito = addMinutes(iniciou, 6 + (pedido.id % 4))
  const saiu = addMinutes(feito, 3)
  if (saiu > limite) return pedido
  const {
    lancadoEm: _lancado,
    iniciadoEm: _iniciado,
    feitoEm: _feito,
    servidoEm: _servido,
    ...dados
  } = primeiro
  const naMesa = pedido.tipo === "mesa"
  return {
    ...pedido,
    refacoes: [
      {
        numero: 1,
        rodada: primeiro.rodada ?? 1,
        motivo: MOTIVOS_DA_DEMO[pedido.id % MOTIVOS_DA_DEMO.length],
        em: em.toISOString(),
        itens: [
          {
            ...dados,
            id: `${primeiro.id}~r1`,
            quantidade: 1,
            total: primeiro.precoUnitario,
            iniciadoEm: iniciou.toISOString(),
            feitoEm: feito.toISOString(),
            ...(naMesa ? { servidoEm: saiu.toISOString() } : {}),
          },
        ],
        ...(naMesa ? {} : { entregueEm: saiu.toISOString() }),
      },
    ],
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
    enviarParaCozinha: true,
    ...(agendamento ? { agendamento } : {}),
  }
}
