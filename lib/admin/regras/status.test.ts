import { describe, expect, test } from "vitest"
import {
  etapasDoCaminho,
  proximoStatus,
  rotuloAcao,
  rotuloStatus,
  rotuloStatusComum,
  tomDoStatus,
} from "./status"

describe("rotuloStatus", () => {
  test("o mesmo status muda de nome conforme o tipo do pedido", () => {
    expect(rotuloStatus("retirada", "pronto")).toBe("Pronto para retirada")
    expect(rotuloStatus("mesa", "pronto")).toBe("Pronto para servir")
    expect(rotuloStatus("entrega", "concluido")).toBe("Entregue")
    expect(rotuloStatus("retirada", "concluido")).toBe("Retirado")
    expect(rotuloStatus("mesa", "concluido")).toBe("Conta fechada")
  })

  test("no salão, o pedido é um agendamento", () => {
    expect(rotuloStatus("atendimento", "recebido")).toBe("Agendado")
    expect(rotuloStatus("atendimento", "em-preparo")).toBe("Em atendimento")
    expect(rotuloStatus("atendimento", "concluido")).toBe("Concluído")
  })

  test("status que valem para todos", () => {
    expect(rotuloStatus("entrega", "recebido")).toBe("Novo")
    expect(rotuloStatus("entrega", "aguardando-pagamento")).toBe("Aguardando pagamento")
    expect(rotuloStatus("entrega", "saiu-para-entrega")).toBe("Saiu para entrega")
    expect(rotuloStatus("mesa", "cancelado")).toBe("Cancelado")
  })
})

describe("rotuloStatusComum", () => {
  test("nome do status sem depender do tipo, para filtros", () => {
    expect(rotuloStatusComum("concluido")).toBe("Concluído")
    expect(rotuloStatusComum("recebido")).toBe("Novo")
  })
})

describe("rotuloAcao", () => {
  test("o botão diz o que vai acontecer", () => {
    expect(rotuloAcao("entrega", "recebido")).toBe("Iniciar preparo")
    expect(rotuloAcao("entrega", "em-preparo")).toBe("Marcar como pronto")
    expect(rotuloAcao("entrega", "pronto")).toBe("Saiu para entrega")
    expect(rotuloAcao("entrega", "saiu-para-entrega")).toBe("Confirmar entrega")
    expect(rotuloAcao("retirada", "pronto")).toBe("Cliente retirou")
    expect(rotuloAcao("atendimento", "recebido")).toBe("Iniciar atendimento")
    expect(rotuloAcao("atendimento", "em-preparo")).toBe("Concluir atendimento")
  })

  test("sem próxima etapa, não há botão", () => {
    expect(rotuloAcao("mesa", "pronto")).toBeNull()
    expect(rotuloAcao("entrega", "cancelado")).toBeNull()
  })
})

describe("proximoStatus", () => {
  test("entrega: preparo, pronto, saiu para entrega e concluído", () => {
    expect(proximoStatus("entrega", "recebido")).toBe("em-preparo")
    expect(proximoStatus("entrega", "em-preparo")).toBe("pronto")
    expect(proximoStatus("entrega", "pronto")).toBe("saiu-para-entrega")
    expect(proximoStatus("entrega", "saiu-para-entrega")).toBe("concluido")
  })

  test("retirada conclui quando o cliente busca o pronto", () => {
    expect(proximoStatus("retirada", "pronto")).toBe("concluido")
  })

  test("mesa pronta não avança: só conclui ao fechar a conta", () => {
    expect(proximoStatus("mesa", "em-preparo")).toBe("pronto")
    expect(proximoStatus("mesa", "pronto")).toBeNull()
  })

  test("atendimento do salão: agendado, em atendimento e concluído", () => {
    expect(proximoStatus("atendimento", "recebido")).toBe("em-preparo")
    expect(proximoStatus("atendimento", "em-preparo")).toBe("concluido")
  })

  test("aguardando pagamento, concluído e cancelado não têm próxima etapa", () => {
    for (const status of ["aguardando-pagamento", "concluido", "cancelado"] as const) {
      expect(proximoStatus("entrega", status)).toBeNull()
    }
  })
})

describe("tomDoStatus", () => {
  test("cada etapa do caminho tem o seu tom, na ordem em que o pedido anda", () => {
    expect(tomDoStatus("aguardando-pagamento")).toBe("espera")
    expect(tomDoStatus("recebido")).toBe("novo")
    expect(tomDoStatus("em-preparo")).toBe("preparo")
    expect(tomDoStatus("pronto")).toBe("pronto")
    expect(tomDoStatus("saiu-para-entrega")).toBe("caminho")
  })

  test("o que já saiu da operação fica apagado; cancelado é perigo", () => {
    expect(tomDoStatus("concluido")).toBe("fim")
    expect(tomDoStatus("cancelado")).toBe("cancelado")
  })
})

describe("etapasDoCaminho", () => {
  test("entrega passa por todas as etapas, até sair e ser entregue", () => {
    expect(etapasDoCaminho("entrega")).toEqual([
      "recebido",
      "em-preparo",
      "pronto",
      "saiu-para-entrega",
      "concluido",
    ])
  })

  test("retirada e mesa não saem para entrega; o salão não tem pronto", () => {
    expect(etapasDoCaminho("retirada")).toEqual(["recebido", "em-preparo", "pronto", "concluido"])
    expect(etapasDoCaminho("mesa")).toEqual(["recebido", "em-preparo", "pronto", "concluido"])
    expect(etapasDoCaminho("atendimento")).toEqual(["recebido", "em-preparo", "concluido"])
  })
})
