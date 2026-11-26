import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { situacaoEstoque } from "@/lib/admin/regras/estoque"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaEstoque } from "./pagina-estoque"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={cliente}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

const api = () => servidorDo("adega")

/** Um produto da adega controlado, com saldo folgado (para entrada e saída). */
async function produtoOk(): Promise<Produto> {
  const produtos = await api().produtos.listar()
  return produtos.find(
    (produto) => produto.estoque?.controlar && situacaoEstoque(produto.estoque) === "ok",
  ) as Produto
}

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaEstoque />
    </Provedores>,
  )
  await screen.findByRole("table", { name: "Estoque" }, { timeout: 8000 })
  return usuario
}

const linha = (nome: string) => within(screen.getByRole("row", { name: nome }))
const saldoNoServidor = async (id: string) =>
  (await api().produtos.listar()).find((produto) => produto.id === id)?.estoque?.quantidade

async function acao(usuario: ReturnType<typeof userEvent.setup>, produto: Produto, nome: string) {
  const busca = screen.getByRole("searchbox", { name: "Buscar produto" })
  await usuario.clear(busca)
  await usuario.paste(produto.nome)
  await usuario.click(linha(produto.nome).getByRole("button", { name: `Ações de ${produto.nome}` }))
  await usuario.click(await screen.findByRole("menuitem", { name: nome }))
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "adega" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

// A adega inteira na tabela, com um menu por linha: tela pesada quando a suíte roda em paralelo.
describe("PaginaEstoque", { timeout: 15_000 }, () => {
  test("o resumo e a tabela; o filtro mostra só os baixos", async () => {
    const usuario = await abrir()
    const resumo = within(screen.getByRole("region", { name: "Resumo do estoque" }))
    for (const nome of ["Controlados", "Abaixo do mínimo", "Zerados", "Valor em estoque"]) {
      expect(resumo.getByText(nome)).toBeInTheDocument()
    }

    // A adega controla os 120 produtos: 12 no mínimo ou abaixo, 5 zerados.
    expect(resumo.getByText("120")).toBeInTheDocument()
    // Saldo × custo do produto (dados v3: o custo vem do cardápio, de 31% a 59% do preço).
    expect(resumo.getByText("R$ 102.622,39")).toBeInTheDocument()

    const situacao = screen.getByRole("radiogroup", { name: "Situação" })
    expect(within(situacao).getByRole("radio", { name: "Controlados 120" })).toBeChecked()
    expect(within(situacao).getByRole("radio", { name: "OK 103" })).toBeInTheDocument()
    expect(within(situacao).getByRole("radio", { name: "Zerado 5" })).toBeInTheDocument()
    await usuario.click(within(situacao).getByRole("radio", { name: "Baixo 12" }))
    // Os produtos filtrados saem com um fade curto: a tabela fecha em 12 linhas logo depois.
    const tabela = within(screen.getByRole("table", { name: "Estoque" }))
    await waitFor(() => expect(tabela.getAllByRole("row").slice(1)).toHaveLength(12))
    for (const item of tabela.getAllByRole("row").slice(1)) expect(item).toHaveTextContent("Baixo")
  })

  test("entrada com custo atualiza o saldo", async () => {
    const produto = await produtoOk()
    const usuario = await abrir()
    await acao(usuario, produto, "Entrada")
    const janela = within(screen.getByRole("dialog", { name: `Entrada de ${produto.nome}` }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Quantidade" }), "10")
    // A Skol tem 68 no estoque da demonstração.
    expect(janela.getByText("Saldo depois: 78 un")).toBeInTheDocument()
    await usuario.type(janela.getByRole("textbox", { name: "Custo unitário" }), "4,5")
    await usuario.click(janela.getByRole("button", { name: "Registrar entrada" }))

    expect(await screen.findByText("Entrada registrada.")).toBeInTheDocument()
    await waitFor(async () =>
      expect(await saldoNoServidor(produto.id)).toBe((produto.estoque?.quantidade ?? 0) + 10),
    )
    // O custo da compra vira o custo do produto, que a coluna Custo mostra.
    expect(await linha(produto.nome).findByText("R$ 4,50")).toBeInTheDocument()
  })

  test("saída só registra com o motivo", async () => {
    const produto = await produtoOk()
    const usuario = await abrir()
    await acao(usuario, produto, "Saída")
    const janela = within(screen.getByRole("dialog", { name: `Saída de ${produto.nome}` }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Quantidade" }), "1")
    expect(janela.getByText("Saldo depois: 67 un")).toBeInTheDocument()
    const registrar = janela.getByRole("button", { name: "Registrar saída" })
    expect(registrar).toBeDisabled()

    await usuario.click(janela.getByRole("radio", { name: "Quebra" }))
    await usuario.click(registrar)
    await waitFor(async () =>
      expect(await saldoNoServidor(produto.id)).toBe((produto.estoque?.quantidade ?? 0) - 1),
    )
    expect((await api().estoque.movimentos(produto.id))[0]).toMatchObject({ motivo: "Quebra" })
  })

  test("a contagem mostra a diferença antes de registrar", async () => {
    const produto = await produtoOk()
    const saldo = produto.estoque?.quantidade as number
    const usuario = await abrir()
    await acao(usuario, produto, "Contagem")
    const janela = within(screen.getByRole("dialog", { name: `Contagem de ${produto.nome}` }))
    await usuario.type(
      janela.getByRole("spinbutton", { name: "Quantidade contada" }),
      String(saldo - 2),
    )
    expect(janela.getByText("Diferença: −2")).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Registrar contagem" }))
    await waitFor(async () => expect(await saldoNoServidor(produto.id)).toBe(saldo - 2))
  })

  test("o histórico lista os movimentos do produto", async () => {
    const produto = await produtoOk()
    const usuario = await abrir()
    await acao(usuario, produto, "Histórico")
    const historico = within(
      await screen.findByRole("dialog", { name: `Histórico de ${produto.nome}` }),
    )
    expect(historico.getByText("Estoque inicial")).toBeInTheDocument()
    expect(historico.getAllByRole("listitem").length).toBeGreaterThan(0)
  })

  test("configurar muda o mínimo e desliga o controle; o produto sai da lista dos controlados", async () => {
    const produto = await produtoOk()
    const usuario = await abrir()
    await acao(usuario, produto, "Configurar")
    const janela = within(screen.getByRole("dialog", { name: `Estoque de ${produto.nome}` }))
    const minimo = janela.getByRole("spinbutton", { name: "Estoque mínimo" })
    await usuario.clear(minimo)
    await usuario.type(minimo, "20")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))
    await waitFor(async () =>
      expect(
        (await api().produtos.listar()).find((p) => p.id === produto.id)?.estoque?.minimo,
      ).toBe(20),
    )

    await acao(usuario, produto, "Configurar")
    const outra = within(screen.getByRole("dialog", { name: `Estoque de ${produto.nome}` }))
    await usuario.click(outra.getByRole("switch", { name: "Controlar o estoque" }))
    await usuario.click(outra.getByRole("button", { name: "Salvar" }))
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: produto.nome })).not.toBeInTheDocument(),
    )
  })
})

describe("PaginaEstoque: carregamento e lote", { timeout: 15_000 }, () => {
  test("enquanto carrega, mostra o esqueleto com a forma da página", async () => {
    render(
      <Provedores>
        <PaginaEstoque />
      </Provedores>,
    )
    const aviso = screen.getByRole("status", { name: "Carregando o estoque" })
    expect(aviso).toHaveAttribute("aria-busy", "true")
    expect(within(aviso).getAllByTestId("esqueleto-indicador")).toHaveLength(4)
    expect(within(aviso).getAllByTestId("esqueleto-linha").length).toBeGreaterThan(0)
    await screen.findByRole("table", { name: "Estoque" }, { timeout: 8000 })
    expect(screen.queryByRole("status", { name: "Carregando o estoque" })).not.toBeInTheDocument()
  })

  test("marcar produtos mostra a barra de lote, e limpar a esconde", async () => {
    const usuario = await abrir()
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument()
    const caixas = screen.getAllByRole("checkbox", { name: /^Selecionar o produto / })
    await usuario.click(caixas[0])
    await usuario.click(caixas[1])
    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    expect(barra).toHaveTextContent("2 produtos selecionados")
    await usuario.click(within(barra).getByRole("button", { name: "Limpar seleção" }))
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument(),
    )
  })

  test("o marcador do cabeçalho seleciona todos os produtos da lista filtrada", async () => {
    const usuario = await abrir()
    await usuario.click(
      within(screen.getByRole("radiogroup", { name: "Situação" })).getByRole("radio", {
        name: "Baixo 12",
      }),
    )
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(13))
    await usuario.click(
      screen.getByRole("checkbox", { name: "Selecionar todos os produtos da lista" }),
    )
    expect(await screen.findByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "12 produtos selecionados",
    )
  })

  test("define o mesmo mínimo em vários produtos de uma vez", async () => {
    const usuario = await abrir()
    const caixas = screen.getAllByRole("checkbox", { name: /^Selecionar o produto / })
    const nomes = caixas
      .slice(0, 2)
      .map((caixa) => (caixa.getAttribute("aria-label") ?? "").replace("Selecionar o produto ", ""))
    await usuario.click(caixas[0])
    await usuario.click(caixas[1])
    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    await usuario.click(within(barra).getByRole("button", { name: "Definir mínimo" }))

    const janela = within(
      await screen.findByRole("dialog", { name: "Definir mínimo de 2 produtos" }),
    )
    const aplicar = janela.getByRole("button", { name: "Aplicar mínimo" })
    expect(aplicar).toBeDisabled()
    await usuario.type(janela.getByRole("spinbutton", { name: "Estoque mínimo" }), "37")
    expect(janela.getByText("Muda o mínimo de 2 produtos.")).toBeInTheDocument()
    await usuario.click(aplicar)

    expect(await screen.findByText("Mínimo de 2 produtos atualizado.")).toBeInTheDocument()
    const produtos = await api().produtos.listar()
    for (const nome of nomes) {
      expect(produtos.find((produto) => produto.nome === nome)?.estoque?.minimo).toBe(37)
    }
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument(),
    )
  })
})
