import { describe, expect, test } from "vitest"
import {
  buscarModulo,
  buscarSegmento,
  ehSegmentoPainel,
  menuDo,
  SEGMENTOS_PAINEL,
  temModulo,
  temRecurso,
  tituloDoModulo,
} from "./segmentos-painel"

describe("menuDo", () => {
  test("o salão mostra só os grupos que têm módulos, na ordem do menu", () => {
    const menu = menuDo("salao").map(({ grupo, itens }) => ({
      grupo,
      itens: itens.map((item) => item.titulo),
    }))
    expect(menu).toEqual([
      { grupo: "Operação", itens: ["Visão geral", "Agendamentos", "Fila de pedidos", "PDV"] },
      { grupo: "Gestão", itens: ["Pedidos", "Cardápio", "Categorias", "Estoque"] },
      { grupo: "Loja", itens: ["Configurações da loja", "Equipe"] },
    ])
  })

  test("Equipe aparece em todos os segmentos, no grupo Loja", () => {
    for (const segmento of SEGMENTOS_PAINEL) {
      const loja = menuDo(segmento.id).find((grupo) => grupo.grupo === "Loja")
      expect(loja?.itens.find((item) => item.id === "equipe")).toMatchObject({
        titulo: "Equipe",
        href: "/admin/equipe",
      })
    }
  })

  test("a pizzaria tem o grupo de entrega", () => {
    const entrega = menuDo("pizzaria").find((grupo) => grupo.grupo === "Entrega")
    expect(entrega?.itens.map((item) => item.titulo)).toEqual(["Motoboys", "Bairros e taxas"])
  })
})

describe("buscarModulo", () => {
  test("acha o módulo pelo endereço", () => {
    expect(buscarModulo("mesas")?.titulo).toBe("Mesas")
    expect(buscarModulo("mesas")?.href).toBe("/admin/mesas")
    expect(buscarModulo("visao-geral")?.href).toBe("/admin")
  })

  test("endereço desconhecido não é módulo", () => {
    expect(buscarModulo("clientes")).toBeUndefined()
  })
})

describe("temRecurso", () => {
  test("o cardápio do salão não tem adicionais; o da lanchonete tem", () => {
    expect(temRecurso("salao", "adicionais")).toBe(false)
    expect(temRecurso("lanchonete", "adicionais")).toBe(true)
  })

  test("só o açougue vende por quilo, paga após a pesagem e marca data de retirada", () => {
    for (const recurso of ["vendaPorPeso", "pagarAposPesagem", "dataRetirada"] as const) {
      expect(temRecurso("acougue", recurso)).toBe(true)
      expect(temRecurso("pizzaria", recurso)).toBe(false)
      expect(temRecurso("adega", recurso)).toBe(false)
    }
  })

  test("recursos próprios de cada loja de referência", () => {
    expect(temRecurso("salao", "video")).toBe(true)
    expect(temRecurso("lanchonete", "numeroMensal")).toBe(true)
    expect(temRecurso("adega", "numeroMensal")).toBe(false)
    expect(temRecurso("acougue", "vitrines")).toBe(true)
    expect(temRecurso("adega", "combosAutomaticos")).toBe(true)
  })

  test("a lanchonete não tem preço de balcão, porque não tem PDV", () => {
    expect(temRecurso("lanchonete", "precoBalcao")).toBe(false)
    expect(temRecurso("salao", "precoBalcao")).toBe(true)
  })
})

describe("temModulo", () => {
  test("todo segmento tem o estoque", () => {
    const todos = ["adega", "acougue", "pizzaria", "salao", "lanchonete", "farmacia"] as const
    for (const segmento of todos) expect(temModulo(segmento, "estoque")).toBe(true)
    expect(buscarModulo("estoque")?.href).toBe("/admin/estoque")
  })

  test("o salão agenda, mas não tem mesas, garçom, cozinha nem entrega", () => {
    expect(temModulo("salao", "agendamentos")).toBe(true)
    expect(temModulo("salao", "mesas")).toBe(false)
    expect(temModulo("salao", "garcom")).toBe(false)
    expect(temModulo("salao", "cozinha")).toBe(false)
    expect(temModulo("salao", "motoboys")).toBe(false)
    expect(temModulo("salao", "bairros")).toBe(false)
  })

  test("a lanchonete não tem PDV, mas tem mesas", () => {
    expect(temModulo("lanchonete", "pdv")).toBe(false)
    expect(temModulo("lanchonete", "mesas")).toBe(true)
  })

  test("a adega tem PDV e mesas, mas não agenda", () => {
    expect(temModulo("adega", "pdv")).toBe(true)
    expect(temModulo("adega", "mesas")).toBe(true)
    expect(temModulo("adega", "agendamentos")).toBe(false)
  })
})

describe("farmácia", () => {
  test("é um segmento do painel, com a loja de referência", () => {
    expect(ehSegmentoPainel("farmacia")).toBe(true)
    expect(buscarSegmento("farmacia")).toMatchObject({
      nome: "Farmácia",
      loja: "Drogaria Bem Estar",
    })
  })

  test("tem o grupo Farmácia (receitas, controlados, lotes e validade) e chama o cardápio de Produtos", () => {
    const menu = menuDo("farmacia").map(({ grupo, itens }) => ({
      grupo,
      itens: itens.map((item) => item.titulo),
    }))
    expect(menu).toEqual([
      { grupo: "Operação", itens: ["Visão geral", "Fila de pedidos", "PDV"] },
      {
        grupo: "Farmácia",
        itens: ["Receitas", "Controlados", "Lotes e validade"],
      },
      { grupo: "Gestão", itens: ["Pedidos", "Produtos", "Categorias", "Estoque"] },
      { grupo: "Entrega", itens: ["Motoboys", "Bairros e taxas"] },
      { grupo: "Loja", itens: ["Configurações da loja", "Equipe"] },
    ])
  })

  test("não tem cozinha, mesas, garçom nem agenda", () => {
    for (const modulo of ["cozinha", "mesas", "garcom", "agendamentos"] as const) {
      expect(temModulo("farmacia", modulo)).toBe(false)
    }
  })

  test("os módulos da farmácia não aparecem na pizzaria", () => {
    for (const modulo of ["receitas", "controlados", "validade"] as const) {
      expect(temModulo("pizzaria", modulo)).toBe(false)
    }
    expect(buscarModulo("receitas")?.href).toBe("/admin/receitas")
    expect(buscarModulo("validade")?.href).toBe("/admin/validade")
  })

  test("o título do módulo muda com o segmento", () => {
    expect(tituloDoModulo("cardapio", "farmacia")).toBe("Produtos")
    expect(tituloDoModulo("cardapio", "pizzaria")).toBe("Cardápio")
    expect(tituloDoModulo("receitas", "farmacia")).toBe("Receitas")
  })

  test("só a farmácia tem os dados de medicamento no produto", () => {
    expect(temRecurso("farmacia", "medicamentos")).toBe(true)
    expect(temRecurso("farmacia", "precoBalcao")).toBe(true)
    expect(temRecurso("pizzaria", "medicamentos")).toBe(false)
  })
})
