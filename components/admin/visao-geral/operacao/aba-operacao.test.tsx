import { render, screen, within } from "@testing-library/react"
import { addMinutes } from "date-fns"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Pedido, StatusPedido, TipoPedido } from "@/lib/admin/dados/tipos"
import {
  AGORA_DE_TESTE,
  PERIODO_DE_TESTE,
  pedidoDeTeste,
} from "@/lib/admin/regras/pedidos-de-teste"
import { AbaOperacao } from "./aba-operacao"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

const CRIADO = new Date(2026, 10, 13, 19)

/** Pedido com o histórico em minutos desde a criação; o status é o da última etapa. */
function comHistorico(
  id: number,
  tipo: TipoPedido,
  etapas: [StatusPedido, number][],
  mudancas: Partial<Pedido> = {},
): Pedido {
  const historico = etapas.map(([status, minutos]) => ({
    status,
    em: addMinutes(CRIADO, minutos).toISOString(),
  }))
  return pedidoDeTeste(id, CRIADO, 50, {
    tipo,
    status: etapas.at(-1)?.[0] ?? "recebido",
    historico,
    ...mudancas,
  })
}

const ENTREGA = (id: number, saiu: number, entregou: number) =>
  comHistorico(id, "entrega", [
    ["recebido", 0],
    ["em-preparo", 4],
    ["pronto", 24],
    ["saiu-para-entrega", saiu],
    ["concluido", entregou],
  ])

/** Dois entregues (35 e 45 min), um cancelado por demora e um sem motivo. */
const PEDIDOS: Pedido[] = [
  ENTREGA(1, 28, 35),
  ENTREGA(2, 30, 45),
  comHistorico(
    3,
    "entrega",
    [
      ["recebido", 0],
      ["cancelado", 10],
    ],
    { motivoCancelamento: "demora" },
  ),
  comHistorico(4, "retirada", [
    ["recebido", 0],
    ["cancelado", 5],
  ]),
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaOperacao>> = {}) {
  return render(
    <AbaOperacao
      pedidos={PEDIDOS}
      periodo={PERIODO_DE_TESTE}
      segmento="lanchonete"
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaOperacao", () => {
  test("a régua: no prazo, tempo total, cancelados e o online que não foi pago", () => {
    renderizar()
    const regua = regiao("Operação do período")
    expect(fato(regua, "No prazo")).toHaveTextContent("50%")
    expect(fato(regua, "No prazo")).toHaveTextContent("abaixo de 40 min")
    expect(fato(regua, "Tempo na loja")).toHaveTextContent("40 min")
    expect(fato(regua, "Tempo na loja")).toHaveTextContent("9 em 10 em até 45 min")
    expect(fato(regua, "Cancelados")).toHaveTextContent("50%")
    expect(fato(regua, "Cancelados")).toHaveTextContent("2 de 4 pedidos")
    expect(fato(regua, "Online não pago")).toHaveTextContent("0")
  })
})

describe("AbaOperacao: tempos e atrasos", () => {
  test("cada etapa com a média e o tempo em que 9 de cada 10 ficam", () => {
    renderizar()
    const tabela = screen.getByRole("table", { name: "Tempo por etapa" })
    expect(
      within(tabela)
        .getAllByRole("row")
        .slice(1)
        .map((linha) =>
          within(linha)
            .getAllByRole("cell")
            .map((celula) => celula.textContent),
        ),
    ).toEqual([
      ["Aceite", "4 min", "4 min"],
      ["Preparo", "20 min", "20 min"],
      ["Espera do motoboy", "5 min", "6 min"],
      ["Entrega", "11 min", "15 min"],
      ["Total na loja", "40 min", "45 min"],
    ])
  })

  test("sem entrega concluída, a espera do motoboy e a entrega não aparecem", () => {
    renderizar({
      pedidos: [
        comHistorico(1, "retirada", [
          ["recebido", 0],
          ["em-preparo", 3],
          ["pronto", 18],
          ["concluido", 30],
        ]),
      ],
    })
    const tabela = screen.getByRole("table", { name: "Tempo por etapa" })
    expect(within(tabela).queryByText("Espera do motoboy")).not.toBeInTheDocument()
    expect(within(tabela).getByText("Total na loja")).toBeInTheDocument()
  })

  test("os atrasos por hora do dia, com quantos atrasaram de quantos", () => {
    renderizar()
    const horas = regiao("Atrasos por hora")
    expect(horas.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "19h1 de 2 atrasou",
    ])
  })
})

describe("AbaOperacao: cancelamentos", () => {
  test("por motivo, cada um levando aos pedidos cancelados por ele; sem motivo é Não informado", () => {
    renderizar()
    const motivos = regiao("Cancelamentos por motivo")
    expect(motivos.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Demora",
      "Não informado",
    ])
    expect(motivos.getByRole("link", { name: "Demora" })).toHaveAttribute(
      "href",
      "/admin/pedidos?status=cancelado&motivo=demora&de=2026-11-12&ate=2026-11-13",
    )
    expect(motivos.getByRole("link", { name: "Não informado" })).toHaveAttribute(
      "href",
      "/admin/pedidos?status=cancelado&motivo=nao-informado&de=2026-11-12&ate=2026-11-13",
    )
  })

  test("por canal, a taxa de cada um, do que mais cancela ao que menos", () => {
    renderizar()
    expect(
      regiao("Cancelamentos por canal")
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Retirada no balcão1 de 1100%", "Entrega1 de 333%"])
  })
})

describe("AbaOperacao: mesas e salão", () => {
  test("onde há mesas: comandas, tempo de mesa, ticket e as vendas de cada garçom", () => {
    const mesa = (id: number, total: number, fechou: number, garcom: string) =>
      comHistorico(
        id,
        "mesa",
        [
          ["recebido", 0],
          ["em-preparo", 2],
          ["pronto", 20],
          ["concluido", fechou],
        ],
        { total, mesa: { id: `m${id}`, numero: id, garcom } },
      )
    renderizar({ pedidos: [mesa(1, 120, 60, "Lucas"), mesa(2, 80, 90, "Paula")] })
    const mesas = regiao("Mesas")
    expect(fato(mesas, "Comandas")).toHaveTextContent("2")
    expect(fato(mesas, "Tempo de mesa")).toHaveTextContent("75 min")
    expect(fato(mesas, "Ticket por mesa")).toHaveTextContent("R$ 100,00")
    expect(regiao("Vendas por garçom").getAllByRole("listitem")[0]).toHaveTextContent(
      "Lucas1 comandaR$ 120,0060%",
    )
  })

  test("sem mesas no segmento, a seção não aparece", () => {
    renderizar({ segmento: "farmacia" })
    expect(screen.queryByRole("region", { name: "Mesas" })).not.toBeInTheDocument()
  })

  test("no salão, a pontualidade toma o lugar dos tempos da fila", () => {
    const marcado = new Date(2026, 10, 13, 10)
    const atendimento = (id: number, comecou: number, terminou: number) =>
      pedidoDeTeste(id, new Date(2026, 10, 12, 10), 80, {
        tipo: "atendimento",
        status: "concluido",
        agendamento: { inicio: marcado.toISOString(), duracaoMin: 60 },
        historico: [
          { status: "recebido", em: new Date(2026, 10, 12, 10).toISOString() },
          { status: "em-preparo", em: addMinutes(marcado, comecou).toISOString() },
          { status: "concluido", em: addMinutes(marcado, terminou).toISOString() },
        ],
      })
    renderizar({ segmento: "salao", pedidos: [atendimento(1, 0, 60), atendimento(2, 20, 90)] })

    const pontualidade = regiao("Pontualidade")
    expect(fato(pontualidade, "Atraso para começar")).toHaveTextContent("10 min")
    expect(fato(pontualidade, "Começou na hora")).toHaveTextContent("50%")
    expect(fato(pontualidade, "Começou na hora")).toHaveTextContent("até 10 min depois")
    expect(fato(pontualidade, "Duração real")).toHaveTextContent("65 min")
    expect(fato(pontualidade, "Duração real")).toHaveTextContent("marcada: 60 min")
    expect(screen.queryByRole("table", { name: "Tempo por etapa" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Atrasos por hora" })).not.toBeInTheDocument()
  })
})
