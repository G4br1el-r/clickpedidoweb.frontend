import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Categoria, Pedido, Produto } from "@/lib/admin/dados/tipos"
import {
  AGORA_DE_TESTE,
  PEDIDOS_DE_TESTE,
  PERIODO_DE_TESTE,
  pedidoDeTeste,
} from "@/lib/admin/regras/pedidos-de-teste"
import { capturarCsv } from "../csv-de-teste"
import { ProvedorDaAba } from "../exportar"
import { AbaProdutos } from "./aba-produtos"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

/** O texto de cada linha da lista, com um espaço entre as partes visíveis. */
const linhas = (onde: ReturnType<typeof regiao>) =>
  onde.getAllByRole("listitem").map((item) =>
    [...item.querySelectorAll("span, a")]
      .filter((parte) => parte.children.length === 0 && parte.textContent)
      .map((parte) => parte.textContent?.replace(/\s/g, " "))
      .join(" "),
  )

const produto = (id: string, mudancas: Partial<Produto> = {}): Produto => ({
  id,
  categoriaId: "bebidas",
  nome: id,
  descricao: "",
  preco: 10,
  ativo: true,
  disponivel: true,
  destaque: false,
  oferta: false,
  ordem: 1,
  unidade: "un",
  grupos: [],
  ...mudancas,
})

const PRODUTOS = [
  produto("Calabresa", { categoriaId: "pizzas" }),
  produto("Coca"),
  produto("Guaraná"),
  produto("Suco"),
  produto("Água"),
]

const CATEGORIAS: Categoria[] = [
  { id: "pizzas", nome: "Pizzas", ordem: 1, ativa: true },
  { id: "bebidas", nome: "Bebidas", ordem: 2, ativa: true },
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaProdutos>> = {}) {
  return render(
    <AbaProdutos
      pedidos={PEDIDOS_DE_TESTE}
      periodo={PERIODO_DE_TESTE}
      segmento="pizzaria"
      produtos={PRODUTOS}
      categorias={CATEGORIAS}
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaProdutos", () => {
  test("a régua: produtos vendidos, unidades, margem e os que não venderam", () => {
    renderizar()
    const regua = regiao("Produtos do período")
    expect(fato(regua, "Produtos vendidos")).toHaveTextContent("3")
    expect(fato(regua, "Produtos vendidos")).toHaveTextContent("de 5 no cardápio")
    expect(fato(regua, "Unidades vendidas")).toHaveTextContent("7")
    expect(fato(regua, "Margem")).toHaveTextContent("Nenhum produto com custo")
    expect(fato(regua, "Sem venda")).toHaveTextContent("2")
  })

  test("com custo, a margem diz a % e quanto do faturamento tem custo", () => {
    const pedidos: Pedido[] = [
      pedidoDeTeste(1, new Date(2026, 10, 13, 19), 110, {
        itens: [
          {
            id: "1",
            produtoId: "Coca",
            nome: "Coca",
            quantidade: 2,
            precoUnitario: 15,
            total: 30,
            opcoes: [],
            custoUnitario: 6,
          },
          {
            id: "2",
            produtoId: "Suco",
            nome: "Suco",
            quantidade: 1,
            precoUnitario: 20,
            total: 20,
            opcoes: [],
          },
        ],
      }),
    ]
    renderizar({ pedidos })
    // Margem: (30 − 12) ÷ 30 = 60%; o custo cobre R$ 30 dos R$ 50.
    expect(fato(regiao("Produtos do período"), "Margem")).toHaveTextContent("60%")
    expect(fato(regiao("Produtos do período"), "Margem")).toHaveTextContent(
      "custo em 60% do faturamento",
    )
  })

  test("no açougue, a régua mostra os quilos vendidos e as unidades à parte", () => {
    const pedidos: Pedido[] = [
      pedidoDeTeste(1, new Date(2026, 10, 13, 19), 90, {
        itens: [
          {
            id: "1",
            produtoId: "Picanha",
            nome: "Picanha",
            quantidade: 2,
            precoUnitario: 30,
            total: 60,
            opcoes: [],
            pesoGramas: 600,
          },
          {
            id: "2",
            produtoId: "Carvão",
            nome: "Carvão",
            quantidade: 3,
            precoUnitario: 10,
            total: 30,
            opcoes: [],
          },
        ],
      }),
    ]
    renderizar({ pedidos, segmento: "acougue" })
    const regua = regiao("Produtos do período")
    expect(fato(regua, "Kg vendidos")).toHaveTextContent("1,2")
    expect(fato(regua, "Kg vendidos")).toHaveTextContent("e 3 unidades")
    expect(regua.queryByText("Unidades vendidas")).not.toBeInTheDocument()
  })

  test("o ranking ordena por faturamento ou por quantidade, e cada produto leva aos pedidos dele", () => {
    renderizar()
    const ranking = regiao("Mais vendidos")
    const nomes = () =>
      ranking.getAllByRole("listitem").map((item) => item.querySelector("a")?.textContent)
    expect(nomes()).toEqual(["Calabresa", "Coca", "Guaraná"])
    expect(ranking.getByRole("link", { name: "Calabresa" })).toHaveAttribute(
      "href",
      "/admin/pedidos?busca=Calabresa&de=2026-11-12&ate=2026-11-13",
    )

    // A barra se mede pelo primeiro colocado: a Coca (R$ 60) enche 75% da da Calabresa (R$ 80).
    const barras = ranking
      .getAllByRole("listitem")
      .map(
        (item) =>
          item.querySelector<HTMLElement>("[data-slot=progress-indicator]")?.style.transform,
      )
    expect(barras).toEqual(["translateX(0%)", "translateX(-25%)", "translateX(-75%)"])

    fireEvent.click(ranking.getByRole("radio", { name: "Qtd." }))
    expect(nomes()).toEqual(["Coca", "Calabresa", "Guaraná"])
    expect(ranking.getAllByRole("listitem")[0]).toHaveTextContent("4 un.")
  })

  test("por categoria, com as unidades e a parte de cada uma no faturamento", () => {
    renderizar()
    expect(linhas(regiao("Por categoria"))).toEqual([
      "Pizzas 2 un. R$ 80,00 50%",
      "Bebidas 5 un. R$ 80,00 50%",
    ])
  })

  test("a curva ABC diz quantos produtos fazem cada parte do faturamento", () => {
    renderizar()
    // Calabresa (50%) e Coca (37,5%) são A; o Guaraná, B; nenhum C.
    expect(linhas(regiao("Curva ABC"))).toEqual([
      "Classe A 2 produtos R$ 140,00 88%",
      "Classe B 1 produto R$ 20,00 13%",
    ])
  })
})

describe("AbaProdutos: margem por produto", () => {
  const comCusto: Pedido[] = [
    pedidoDeTeste(1, new Date(2026, 10, 13, 19), 50, {
      itens: [
        {
          id: "1",
          produtoId: "Coca",
          nome: "Coca",
          quantidade: 2,
          precoUnitario: 15,
          total: 30,
          opcoes: [],
          custoUnitario: 6,
        },
        {
          id: "2",
          produtoId: "Suco",
          nome: "Suco",
          quantidade: 1,
          precoUnitario: 20,
          total: 20,
          opcoes: [],
        },
      ],
    }),
  ]

  test("cada produto com custo mostra a margem em R$ e em %; quem não tem custo vira aviso", () => {
    renderizar({ pedidos: comCusto })
    const margem = regiao("Margem por produto")
    expect(linhas(margem)).toEqual(["Coca vendeu R$ 30,00 R$ 18,00 60%"])
    expect(
      margem.getByText(
        "1 produto sem custo fica fora (R$ 20,00 vendidos). Os adicionais entram na receita sem custo próprio.",
      ),
    ).toBeInTheDocument()
    expect(margem.getByRole("link", { name: "Informar o custo no cardápio" })).toHaveAttribute(
      "href",
      "/admin/cardapio",
    )
  })

  test("sem custo nenhum, a seção só convida a informar", () => {
    renderizar()
    const margem = regiao("Margem por produto")
    expect(margem.getByText("Nenhum produto com custo no período.")).toBeInTheDocument()
    expect(margem.getByRole("link", { name: "Informar o custo no cardápio" })).toBeInTheDocument()
  })
})

describe("AbaProdutos: opções, estoque e o que não vendeu", () => {
  test("as opções mais escolhidas, com o grupo; sem opção vendida, a seção não aparece", () => {
    const pedidos: Pedido[] = [
      pedidoDeTeste(1, new Date(2026, 10, 13, 19), 50, {
        itens: [
          {
            id: "1",
            produtoId: "Coca",
            nome: "Coca",
            quantidade: 2,
            precoUnitario: 15,
            total: 30,
            opcoes: ["Adicional: Gelo, Limão"],
          },
          {
            id: "2",
            produtoId: "Suco",
            nome: "Suco",
            quantidade: 1,
            precoUnitario: 20,
            total: 20,
            opcoes: ["Adicional: Gelo"],
          },
        ],
      }),
    ]
    const { unmount } = renderizar({ pedidos })
    expect(linhas(regiao("Adicionais e opções"))).toEqual([
      "Gelo Adicional 3 vezes",
      "Limão Adicional 2 vezes",
    ])
    unmount()

    renderizar()
    expect(screen.queryByRole("region", { name: "Adicionais e opções" })).not.toBeInTheDocument()
  })
})

describe("AbaProdutos: estoque", () => {
  const controle = (quantidade: number) => ({
    controlar: true,
    quantidade,
    minimo: 1,
    esgotarAoZerar: true,
  })

  test("o valor parado e em quantos dias cada controlado acaba; sem controle, a seção some", () => {
    const produtos = [
      produto("Calabresa", { categoriaId: "pizzas" }),
      produto("Coca", { custo: 2, estoque: controle(10) }),
      produto("Guaraná", { custo: 2, estoque: controle(3) }),
      produto("Água", { custo: 1, estoque: controle(4) }),
      produto("Suco", { custo: 3, estoque: controle(0) }),
    ]
    const { unmount } = renderizar({ produtos })
    const estoque = regiao("Estoque")
    // Parado: 10 × 2 + 3 × 2 + 4 × 1 = R$ 30.
    expect(estoque.getByText("Valor parado: R$ 30,00")).toBeInTheDocument()
    // Em 2 dias: 4 Cocas (2 por dia) e 1 Guaraná (0,5 por dia); a Água não vendeu.
    expect(linhas(estoque)).toEqual([
      "Coca 10 un Acaba em ~5 dias",
      "Guaraná 3 un Acaba em ~6 dias",
      "Água 4 un Sem venda no período",
      "Suco 0 un Zerado",
    ])
    expect(estoque.getByRole("link", { name: "Abrir o estoque" })).toHaveAttribute(
      "href",
      "/admin/estoque",
    )
    unmount()

    renderizar()
    expect(screen.queryByRole("region", { name: "Estoque" })).not.toBeInTheDocument()
  })
})

describe("AbaProdutos: o que não vendeu e a tabela", () => {
  test("os ativos que não venderam aparecem pelo nome", () => {
    renderizar()
    expect(regiao("Sem venda no período").getByText("Água, Suco")).toBeInTheDocument()
  })

  test("a tabela de todos os produtos começa fechada e traz classe, quantidade, faturamento e margem", () => {
    renderizar()
    expect(screen.queryByRole("table", { name: "Produtos do período" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Todos os produtos, em tabela" }))

    const tabela = screen.getByRole("table", { name: "Produtos do período" })
    expect(
      within(tabela)
        .getAllByRole("row")
        .map((linha) =>
          within(linha)
            .queryAllByRole("cell")
            .map((celula) => celula.textContent?.replace(/\s/g, " ")),
        ),
    ).toEqual([
      [],
      ["Calabresa", "A", "2 un.", "R$ 80,00", "—"],
      ["Coca", "A", "4 un.", "R$ 60,00", "—"],
      ["Guaraná", "B", "1 un.", "R$ 20,00", "—"],
    ])
  })
})

describe("AbaProdutos: CSV", () => {
  test("a tabela de todos os produtos sai em CSV, com a unidade e a margem em %", async () => {
    const csv = capturarCsv()
    render(
      <ProvedorDaAba loja="Casa da Pizza" aba="Produtos" periodo={PERIODO_DE_TESTE}>
        <AbaProdutos
          pedidos={PEDIDOS_DE_TESTE}
          periodo={PERIODO_DE_TESTE}
          segmento="pizzaria"
          produtos={PRODUTOS}
          categorias={CATEGORIAS}
        />
      </ProvedorDaAba>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Todos os produtos, em tabela" }))
    fireEvent.click(screen.getByRole("button", { name: "Baixar CSV: Produtos do período" }))
    expect(await csv.texto()).toBe(
      "﻿Produto;Classe;Quantidade;Unidade;Faturamento;Margem (%)\r\n" +
        "Calabresa;A;2;un;80,00;\r\n" +
        "Coca;A;4;un;60,00;\r\n" +
        "Guaraná;B;1;un;20,00;\r\n",
    )
    csv.soltar()
  })
})
