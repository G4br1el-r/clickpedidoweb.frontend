import { describe, expect, test } from "vitest"
import { proximoStatus, rotuloAcao, rotuloStatus, rotuloStatusComum } from "./status"

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
