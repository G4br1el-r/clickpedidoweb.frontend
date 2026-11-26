import { describe, expect, it } from "vitest"
import type { Produto } from "../dados/tipos"
import {
  alternarMarca,
  campoDaAcao,
  estadoDaMarcaGeral,
  marcadosVisiveis,
  marcarVarios,
  produtosQueMudam,
  textoDaConfirmacaoDeExclusao,
  textoDoLoteDeProdutos,
  textoDoResultado,
} from "./lote-cardapio"

function produto(id: string, extras: Partial<Produto> = {}) {
  return { id, nome: `Produto ${id}`, disponivel: true, ativo: true, ...extras } as Produto
}

const normal = produto("a")
const esgotado = produto("b", { disponivel: false })
const oculto = produto("c", { ativo: false })
const esgotadoEOculto = produto("d", { disponivel: false, ativo: false })
const todos = [normal, esgotado, oculto, esgotadoEOculto]

const ids = (lista: Produto[]) => lista.map((item) => item.id)

describe("produtosQueMudam", () => {
  it("disponível: só mexe em quem está esgotado", () => {
    expect(ids(produtosQueMudam(todos, "disponivel"))).toEqual(["b", "d"])
  })

  it("indisponível: só mexe em quem está disponível", () => {
    expect(ids(produtosQueMudam(todos, "indisponivel"))).toEqual(["a", "c"])
  })

  it("visível: só mexe em quem está oculto", () => {
    expect(ids(produtosQueMudam(todos, "visivel"))).toEqual(["c", "d"])
  })

  it("oculto: só mexe em quem está visível", () => {
    expect(ids(produtosQueMudam(todos, "oculto"))).toEqual(["a", "b"])
  })

  it("excluir: todos os marcados saem", () => {
    expect(ids(produtosQueMudam(todos, "excluir"))).toEqual(["a", "b", "c", "d"])
  })

  it("sem produtos marcados, nada muda", () => {
    expect(produtosQueMudam([], "disponivel")).toEqual([])
  })
})

describe("campoDaAcao", () => {
  it("disponível e indisponível mexem no campo disponivel", () => {
    expect(campoDaAcao("disponivel")).toBe("disponivel")
    expect(campoDaAcao("indisponivel")).toBe("disponivel")
  })

  it("visível e oculto mexem no campo ativo", () => {
    expect(campoDaAcao("visivel")).toBe("ativo")
    expect(campoDaAcao("oculto")).toBe("ativo")
  })

  it("excluir não é troca de campo", () => {
    expect(campoDaAcao("excluir")).toBeNull()
  })
})

describe("textoDoLoteDeProdutos", () => {
  it("um produto", () => {
    expect(textoDoLoteDeProdutos(1)).toBe("1 produto selecionado")
  })

  it("vários produtos", () => {
    expect(textoDoLoteDeProdutos(12)).toBe("12 produtos selecionados")
  })
})

describe("alternarMarca", () => {
  it("marca o que não estava marcado", () => {
    expect([...alternarMarca(new Set(["a"]), "b")]).toEqual(["a", "b"])
  })

  it("desmarca o que estava marcado", () => {
    expect([...alternarMarca(new Set(["a", "b"]), "a")]).toEqual(["b"])
  })

  it("não altera o conjunto de origem", () => {
    const origem = new Set(["a"])
    alternarMarca(origem, "b")
    expect([...origem]).toEqual(["a"])
  })
})

describe("marcarVarios", () => {
  it("marca todos os ids dados e mantém os que já estavam", () => {
    expect([...marcarVarios(new Set(["z"]), ["a", "b"], true)].toSorted()).toEqual(["a", "b", "z"])
  })

  it("desmarca só os ids dados", () => {
    expect([...marcarVarios(new Set(["a", "b", "z"]), ["a", "b"], false)]).toEqual(["z"])
  })

  it("não altera o conjunto de origem", () => {
    const origem = new Set(["a"])
    marcarVarios(origem, ["b"], true)
    expect([...origem]).toEqual(["a"])
  })
})

describe("estadoDaMarcaGeral", () => {
  it("nenhum dos visíveis marcado: desmarcada", () => {
    expect(estadoDaMarcaGeral(new Set(["z"]), ["a", "b"])).toBe(false)
  })

  it("alguns marcados: parcial", () => {
    expect(estadoDaMarcaGeral(new Set(["a"]), ["a", "b"])).toBe("indeterminate")
  })

  it("todos marcados: marcada", () => {
    expect(estadoDaMarcaGeral(new Set(["a", "b", "z"]), ["a", "b"])).toBe(true)
  })

  it("sem produtos visíveis, nada a marcar", () => {
    expect(estadoDaMarcaGeral(new Set(["a"]), [])).toBe(false)
  })
})

describe("marcadosVisiveis", () => {
  it("devolve só quem está marcado e ainda aparece na lista, na ordem da lista", () => {
    const marcados = new Set(["d", "a", "fora"])
    expect(ids(marcadosVisiveis(marcados, todos))).toEqual(["a", "d"])
  })
})

describe("textoDoResultado", () => {
  it("um produto no singular", () => {
    expect(textoDoResultado("disponivel", 1, 0)).toEqual({ sucesso: "1 produto ficou disponível." })
  })

  it("vários produtos no plural", () => {
    expect(textoDoResultado("indisponivel", 3, 0)).toEqual({
      sucesso: "3 produtos ficaram indisponíveis.",
    })
    expect(textoDoResultado("visivel", 2, 0)).toEqual({ sucesso: "2 produtos ficaram visíveis." })
    expect(textoDoResultado("oculto", 2, 0)).toEqual({ sucesso: "2 produtos ficaram ocultos." })
    expect(textoDoResultado("excluir", 2, 0)).toEqual({ sucesso: "2 produtos foram excluídos." })
    expect(textoDoResultado("excluir", 1, 0)).toEqual({ sucesso: "1 produto foi excluído." })
  })

  it("conta o que deu errado à parte", () => {
    expect(textoDoResultado("oculto", 2, 1)).toEqual({
      sucesso: "2 produtos ficaram ocultos.",
      erro: "1 produto não mudou. Confira e tente de novo.",
    })
    expect(textoDoResultado("excluir", 0, 2)).toEqual({
      erro: "2 produtos não foram excluídos. Confira e tente de novo.",
    })
  })
})

describe("textoDaConfirmacaoDeExclusao", () => {
  it("um produto leva o nome dele", () => {
    expect(textoDaConfirmacaoDeExclusao([produto("a", { nome: "Pastel de Carne" })])).toEqual({
      titulo: "Excluir Pastel de Carne?",
      descricao: "Ele sai do cardápio. Os pedidos antigos continuam com o nome do item.",
    })
  })

  it("vários produtos levam a quantidade", () => {
    expect(textoDaConfirmacaoDeExclusao([normal, esgotado, oculto])).toEqual({
      titulo: "Excluir 3 produtos?",
      descricao: "Eles saem do cardápio. Os pedidos antigos continuam com o nome dos itens.",
    })
  })
})
