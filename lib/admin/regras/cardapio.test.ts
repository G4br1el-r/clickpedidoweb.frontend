import { describe, expect, test } from "vitest"
import type { Categoria, GrupoOpcao, Produto } from "../dados/tipos"
import {
  contarSituacoes,
  copiarProduto,
  filtrarProdutos,
  opcaoDoProduto,
  percentualOferta,
  reordenar,
  replicarOpcoes,
  sincronizarOpcoes,
  soltarOpcoesDe,
} from "./cardapio"

const borda: GrupoOpcao = {
  id: "grp-1",
  nome: "Borda",
  minimo: 1,
  maximo: 1,
  gratisAte: 0,
  ordem: 1,
  ativo: true,
  itens: [{ id: "opc-1", nome: "Catupiry", precoAdicional: 8, ordem: 1, ativo: true }],
}

function produto(id: string, mudancas: Partial<Produto> = {}): Produto {
  return {
    id,
    categoriaId: "cat-pizzas",
    nome: id,
    descricao: "",
    preco: 50,
    ativo: true,
    disponivel: true,
    destaque: false,
    oferta: false,
    ordem: 1,
    unidade: "un",
    grupos: [],
    ...mudancas,
  }
}

const PRODUTOS = [
  produto("Calabresa", {
    descricao: "Calabresa artesanal e cebola",
    destaque: true,
    grupos: [borda],
  }),
  produto("Muçarela", { disponivel: false }),
  produto("Portuguesa", { ativo: false }),
  produto("Frango", { oferta: true, preco: 40, precoOriginal: 50 }),
  produto("Coca-Cola", { categoriaId: "cat-bebidas", preco: 8 }),
]
const nomes = (lista: Produto[]) => lista.map((item) => item.nome)

/** Ids previsíveis para os testes: id-1, id-2… */
function ids() {
  let contador = 0
  return () => {
    contador += 1
    return `id-${contador}`
  }
}

describe("filtrarProdutos", () => {
  test("busca no nome e na descrição, sem acento", () => {
    expect(nomes(filtrarProdutos(PRODUTOS, { busca: "mucarela" }))).toEqual(["Muçarela"])
    expect(nomes(filtrarProdutos(PRODUTOS, { busca: "cebola" }))).toEqual(["Calabresa"])
  })

  test("filtra por categoria e por situação", () => {
    expect(nomes(filtrarProdutos(PRODUTOS, { categoriaId: "cat-bebidas" }))).toEqual(["Coca-Cola"])
    expect(nomes(filtrarProdutos(PRODUTOS, { situacao: "esgotados" }))).toEqual(["Muçarela"])
    expect(nomes(filtrarProdutos(PRODUTOS, { situacao: "ocultos" }))).toEqual(["Portuguesa"])
    expect(nomes(filtrarProdutos(PRODUTOS, { situacao: "ofertas" }))).toEqual(["Frango"])
    expect(nomes(filtrarProdutos(PRODUTOS, { situacao: "disponiveis" }))).toEqual([
      "Calabresa",
      "Frango",
      "Coca-Cola",
    ])
  })
})

describe("contarSituacoes", () => {
  test("quantos produtos há em cada situação", () => {
    expect(contarSituacoes(PRODUTOS)).toEqual({
      todos: 5,
      disponiveis: 3,
      esgotados: 1,
      ocultos: 1,
      destaques: 1,
      ofertas: 1,
    })
  })
})

describe("percentualOferta", () => {
  test("de R$ 50 por R$ 40 são 20% de desconto", () => {
    expect(percentualOferta(PRODUTOS[3])).toBe(20)
  })

  test("sem oferta ou com preço 'de' menor, não há desconto", () => {
    expect(percentualOferta(PRODUTOS[0])).toBeNull()
    expect(
      percentualOferta(produto("X", { oferta: true, preco: 60, precoOriginal: 50 })),
    ).toBeNull()
  })
})

describe("copiarProduto", () => {
  test("a cópia ganha nome com (Cópia) e ids novos, inclusive nas opções", () => {
    const copia = copiarProduto(PRODUTOS[0], ids())
    expect(copia.id).toBe("id-1")
    expect(copia.nome).toBe("Calabresa (Cópia)")
    expect(copia.grupos[0].id).toBe("id-2")
    expect(copia.grupos[0].itens[0].id).toBe("id-3")
    expect(copia.grupos[0].itens[0].nome).toBe("Catupiry")
  })

  test("o nome da cópia não passa de 80 caracteres", () => {
    expect(copiarProduto(produto("A".repeat(80)), ids()).nome).toHaveLength(80)
  })
})

describe("replicarOpcoes", () => {
  test("os outros produtos da mesma categoria ficam com as mesmas opções", () => {
    const resultado = replicarOpcoes(PRODUTOS, "Calabresa", ids())
    const muçarela = resultado.find((item) => item.id === "Muçarela")
    expect(muçarela?.grupos.map((grupo) => grupo.nome)).toEqual(["Borda"])
    expect(muçarela?.grupos[0].id).not.toBe("grp-1")
    // Outra categoria não muda.
    expect(resultado.find((item) => item.id === "Coca-Cola")?.grupos).toEqual([])
  })
})

describe("item que não existe", () => {
  test("replicar de um produto que não existe não muda nada", () => {
    expect(replicarOpcoes(PRODUTOS, "Não existe", ids())).toEqual(PRODUTOS)
  })

  test("reordenar com um id desconhecido mantém a ordem", () => {
    const itens = [
      { id: "a", ordem: 1 },
      { id: "b", ordem: 2 },
    ]
    expect(reordenar(itens, "z", "a")).toEqual(itens)
  })
})

describe("reordenar", () => {
  test("move o item e renumera a ordem a partir de 1", () => {
    const categorias: Categoria[] = ["a", "b", "c"].map((id, indice) => ({
      id,
      nome: id,
      ordem: indice + 1,
      ativa: true,
    }))
    expect(reordenar(categorias, "c", "a").map(({ id, ordem }) => [id, ordem])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ])
  })
})

describe("opções ligadas a produtos (combos)", () => {
  const gelos: GrupoOpcao = {
    id: "grp-gelo",
    nome: "Sabores do Gelo",
    minimo: 0,
    maximo: 2,
    gratisAte: 1,
    ordem: 1,
    ativo: true,
    itens: [
      {
        id: "o1",
        nome: "Gelo de Coco",
        precoAdicional: 3,
        ordem: 1,
        ativo: true,
        produtoId: "coco",
      },
      { id: "o2", nome: "Gelo Tradicional", precoAdicional: 0, ordem: 2, ativo: true },
    ],
  }
  const combo = produto("combo", { grupos: [gelos] })
  const coco = produto("coco", { nome: "Gelo de Coco", preco: 6, precoBalcao: 5 })

  test("esgotar o produto desliga a opção em todos os combos; voltar religa", () => {
    const esgotado = sincronizarOpcoes([combo, coco], { ...coco, disponivel: false }, coco)
    expect(esgotado[0].grupos[0].itens.map((item) => item.ativo)).toEqual([false, true])
    const voltou = sincronizarOpcoes(esgotado, coco, { ...coco, disponivel: false })
    expect(voltou[0].grupos[0].itens.map((item) => item.ativo)).toEqual([true, true])
  })

  // Escolha: o `ativo` da opção só acompanha o produto quando a disponibilidade dele muda
  // (comparando com o produto anterior). Salvar sem mudar a disponibilidade respeita o que
  // a loja desligou à mão no combo.
  test("opção desligada à mão no combo continua desligada ao salvar o produto", () => {
    const desligada = produto("combo", {
      grupos: [{ ...gelos, itens: gelos.itens.map((item) => ({ ...item, ativo: false })) }],
    })
    const salvo = sincronizarOpcoes([desligada, coco], { ...coco, preco: 7 }, coco)
    expect(salvo[0].grupos[0].itens.map((item) => item.ativo)).toEqual([false, false])
  })

  test("excluir o produto desliga a opção e tira a ligação; as outras não mudam", () => {
    const [semCoco] = soltarOpcoesDe([combo, coco], "coco")
    expect(semCoco.grupos[0].itens).toEqual([
      { id: "o1", nome: "Gelo de Coco", precoAdicional: 3, ordem: 1, ativo: false },
      { id: "o2", nome: "Gelo Tradicional", precoAdicional: 0, ordem: 2, ativo: true },
    ])
  })

  test("renomear o produto renomeia a opção ligada; as outras não mudam", () => {
    const renomeado = sincronizarOpcoes([combo, coco], { ...coco, nome: "Gelo Coco Zero" })
    expect(renomeado[0].grupos[0].itens.map((item) => item.nome)).toEqual([
      "Gelo Coco Zero",
      "Gelo Tradicional",
    ])
  })

  test("produto vira opção ligada, com o nome e o preço de balcão", () => {
    expect(opcaoDoProduto(coco, 3, () => "opc-novo")).toEqual({
      id: "opc-novo",
      nome: "Gelo de Coco",
      precoAdicional: 5,
      ordem: 3,
      ativo: true,
      produtoId: "coco",
    })
  })
})
