import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaCardapio } from "./pagina-cardapio"

function Provedores({
  children,
  aoMudarUrl,
}: {
  children: ReactNode
  aoMudarUrl?: OnUrlUpdateFunction
}) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={aoMudarUrl}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          {/* No app, o Toaster vem dos provedores da raiz. */}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar(aoMudarUrl?: OnUrlUpdateFunction) {
  return render(
    <Provedores aoMudarUrl={aoMudarUrl}>
      <PaginaCardapio />
    </Provedores>,
  )
}

/** Linha de um produto pelo nome. */
const linha = async (nome: string) =>
  within(await screen.findByRole("listitem", { name: nome }, { timeout: 8000 }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "lanchonete" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PaginaCardapio", () => {
  test("agrupa por categoria e a busca reduz a lista", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await linha("Pastel de Carne")
    expect(screen.getByRole("heading", { level: 2, name: /Pastéis/ })).toBeInTheDocument()

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar produto" }), "carne")
    const nomes = screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))
    expect(nomes.length).toBeGreaterThan(0)
    for (const nome of nomes) expect(nome?.toLowerCase()).toContain("carne")
  })

  test("esgotar pela chave mostra o selo e entra no filtro de esgotados", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const pastel = await linha("Pastel de Carne")

    await usuario.click(pastel.getByRole("switch", { name: "Disponível" }))
    expect(await pastel.findByText("Esgotado")).toBeInTheDocument()

    await usuario.click(screen.getByRole("radio", { name: /Esgotados/ }))
    // A Água Mineral já nasce esgotada: a demonstração do estoque começa com ela zerada.
    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))).toEqual([
      "Pastel de Carne",
      "Água Mineral",
    ])
  })

  test("preço na linha: Enter salva e Esc desfaz", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const pastel = await linha("Pastel de Carne")
    const preco = pastel.getByRole("textbox", { name: "Preço" })

    await usuario.clear(preco)
    await usuario.type(preco, "12,50{Enter}")
    expect(await screen.findByText("Pastel de Carne: R$ 12,50")).toBeInTheDocument()

    await usuario.clear(preco)
    await usuario.type(preco, "99{Escape}")
    expect(preco).toHaveValue("R$ 12,50")
  })

  test("o preço salvo se confirma na própria linha", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const pastel = await linha("Pastel de Carne")
    const preco = pastel.getByRole("textbox", { name: "Preço" })

    await usuario.clear(preco)
    await usuario.type(preco, "13{Enter}")
    // O aviso já está na linha (vazio) para o leitor de tela anunciar quando muda.
    await waitFor(() => expect(pastel.getByRole("status")).toHaveTextContent("Salvo"))
  })

  test("o cabeçalho da categoria diz quantos produtos ela tem", async () => {
    renderizar()
    await linha("Pastel de Carne")
    const pasteis = screen.getByRole("region", { name: /^Pastéis/ })
    expect(pasteis).toHaveAccessibleName("Pastéis, 12 produtos")
    expect(within(pasteis).getAllByRole("listitem")).toHaveLength(12)
  })

  test("copiar e excluir pelo menu do produto, excluir com confirmação", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const pastel = await linha("Pastel de Carne")

    await usuario.click(pastel.getByRole("button", { name: "Mais ações" }))
    await usuario.click(screen.getByRole("menuitem", { name: "Copiar" }))
    const copia = await linha("Pastel de Carne (Cópia)")

    await usuario.click(copia.getByRole("button", { name: "Mais ações" }))
    await usuario.click(screen.getByRole("menuitem", { name: "Excluir" }))
    await usuario.click(
      within(
        screen.getByRole("alertdialog", { name: "Excluir Pastel de Carne (Cópia)?" }),
      ).getByRole("button", { name: "Sim, excluir" }),
    )
    expect(await screen.findByText("Produto excluído.")).toBeInTheDocument()
    expect(
      screen.queryByRole("listitem", { name: "Pastel de Carne (Cópia)" }),
    ).not.toBeInTheDocument()
  })

  test("editar abre o formulário pelo endereço", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    renderizar(aoMudar)
    const pastel = await linha("Pastel de Carne")
    await usuario.click(pastel.getByRole("button", { name: "Editar" }))
    expect(aoMudar.mock.lastCall?.[0].searchParams.get("produto")).toMatch(/^prod-/)
  })
})

describe("PaginaCardapio na farmácia", () => {
  test("se chama Produtos e cada medicamento mostra a tarja e o tipo", async () => {
    useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
    renderizar()
    const clonazepam = await linha("Clonazepam 2 mg")
    expect(screen.getByRole("heading", { level: 1, name: "Produtos" })).toBeInTheDocument()
    expect(clonazepam.getByText("Tarja preta")).toBeInTheDocument()
    expect(clonazepam.getByText("Genérico")).toBeInTheDocument()
    expect(clonazepam.getByText("B1")).toBeInTheDocument()

    const protetor = await linha("Protetor solar facial FPS 50")
    expect(protetor.queryByText(/Tarja|Venda livre/)).not.toBeInTheDocument()
  })
})
