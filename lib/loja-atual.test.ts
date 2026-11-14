import { afterEach, beforeEach, describe, expect, test } from "vitest"
import {
  buscarCardapio,
  cssDasLojas,
  ehLojaId,
  LOJAS,
  lojaAtual,
  SCRIPT_LOJA,
  useLojaAtual,
} from "./loja-atual"

beforeEach(() => {
  localStorage.clear()
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
  delete document.documentElement.dataset.loja
})

afterEach(() => {
  window.history.pushState({}, "", "/")
})

describe("loja atual", () => {
  test("começa na Casa da Pizza e troca para a Drogaria Bem Estar", () => {
    expect(LOJAS.map(({ loja }) => [loja.nome, loja.segmento])).toEqual([
      ["Casa da Pizza", "pizzaria"],
      ["Drogaria Bem Estar", "farmacia"],
      ["Adega da Vila", "adega"],
      ["Açougue Sabor da Carne", "acougue"],
      ["Empório das Deusas", "salao"],
      ["Quiosque do Mineiro", "lanchonete"],
    ])
    expect(lojaAtual().nome).toBe("Casa da Pizza")
    useLojaAtual.getState().escolher("drogaria-bem-estar")
    expect(lojaAtual().nome).toBe("Drogaria Bem Estar")
    expect(lojaAtual().segmento).toBe("farmacia")
  })

  test("abre na loja guardada neste navegador; uma loja que não existe volta para a pizzaria", async () => {
    localStorage.setItem(
      "clickpedido-loja",
      JSON.stringify({ state: { id: "drogaria-bem-estar" }, version: 1 }),
    )
    await useLojaAtual.persist.rehydrate()
    expect(useLojaAtual.getState()).toMatchObject({ id: "drogaria-bem-estar", hidratada: true })

    localStorage.setItem("clickpedido-loja", JSON.stringify({ state: { id: "x" }, version: 1 }))
    await useLojaAtual.persist.rehydrate()
    expect(useLojaAtual.getState().id).toBe("casa-da-pizza")
    expect(ehLojaId("x")).toBe(false)
  })

  test("cada loja nova vem do catálogo do painel, com as cores dela", async () => {
    const quiosque = await buscarCardapio("quiosque-do-mineiro")
    expect(quiosque.flatMap((categoria) => categoria.produtos).map((p) => p.nome)).toContain(
      "Pastel de Carne",
    )
    const acougue = LOJAS.find(({ loja }) => loja.id === "acougue-sabor-da-carne")?.loja
    expect(acougue?.tema.primaria).toBe("#9F1D1D")
    expect(cssDasLojas()).toContain(':root[data-loja="emporio-das-deusas"]{')
  })

  test("o cardápio vem da loja pedida", async () => {
    const farmacia = await buscarCardapio("drogaria-bem-estar")
    expect(farmacia.map((categoria) => categoria.nome)).toContain("Antibióticos")
    const amoxicilina = farmacia
      .flatMap((categoria) => categoria.produtos)
      .find((produto) => produto.id === "amoxicilina-500")
    expect(amoxicilina?.medicamento).toMatchObject({ tarja: "vermelha-retencao" })
  })
})

describe("cores da loja", () => {
  test("a farmácia tem as cores dela, presas à marca na raiz, nos dois temas", () => {
    const css = cssDasLojas()
    expect(css).toContain(':root[data-loja="drogaria-bem-estar"]{--background:#F2F7F6;')
    expect(css).toContain("--primary:#0F766E;")
    expect(css).toContain(':root.dark[data-loja="drogaria-bem-estar"]{')
    // A pizzaria é a padrão: as cores dela já vêm do layout.
    expect(css).not.toContain('data-loja="casa-da-pizza"')
  })

  test("o script marca a loja salva antes da pintura, menos no painel", () => {
    localStorage.setItem(
      "clickpedido-loja",
      JSON.stringify({ state: { id: "drogaria-bem-estar" }, version: 1 }),
    )
    new Function(SCRIPT_LOJA)()
    expect(document.documentElement.dataset.loja).toBe("drogaria-bem-estar")

    delete document.documentElement.dataset.loja
    window.history.pushState({}, "", "/admin/pedidos")
    new Function(SCRIPT_LOJA)()
    expect(document.documentElement.dataset.loja).toBeUndefined()
  })
})
