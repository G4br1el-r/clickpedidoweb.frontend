import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaCardapio } from "./pagina-cardapio"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar() {
  return render(
    <Provedores>
      <PaginaCardapio />
    </Provedores>,
  )
}

const linha = async (nome: string) =>
  within(await screen.findByRole("listitem", { name: nome }, { timeout: 8000 }))

const caixa = async (nome: string) =>
  (await linha(nome)).getByRole("checkbox", { name: `Selecionar ${nome}` })

const barra = () => screen.queryByRole("region", { name: "Ações em lote" })

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

describe("PaginaCardapio: carregamento", () => {
  test("enquanto busca, mostra o esqueleto da lista com o aviso do cardápio", async () => {
    renderizar()
    expect(screen.getByRole("status", { name: "Carregando o cardápio" })).toBeInTheDocument()
    await linha("Pastel de Carne")
    expect(screen.queryByRole("status", { name: "Carregando o cardápio" })).not.toBeInTheDocument()
  })
})

describe("PaginaCardapio: ações em lote", { timeout: 20_000 }, () => {
  test("o resumo da página avisa que dá para marcar vários", async () => {
    renderizar()
    await linha("Pastel de Carne")
    expect(screen.getByText(/Marque vários produtos para mudar de uma vez/)).toBeInTheDocument()
  })

  test("marcar um produto abre a barra e desmarcar fecha", async () => {
    const usuario = userEvent.setup()
    renderizar()
    expect(barra()).not.toBeInTheDocument()

    await usuario.click(await caixa("Pastel de Carne"))
    expect(await screen.findByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "1 produto selecionado",
    )

    await usuario.click(await caixa("Pastel de Carne"))
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
  })

  test("marcar todos os visíveis respeita a busca", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await linha("Pastel de Carne")
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar produto" }), "carne")
    const visiveis = screen.getAllByRole("listitem").length

    await usuario.click(screen.getByRole("checkbox", { name: "Marcar todos os visíveis" }))
    expect(await screen.findByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      `${visiveis} produtos selecionados`,
    )
    for (const caixaDaLinha of screen.getAllByRole("checkbox", { name: /^Selecionar / })) {
      expect(caixaDaLinha).toBeChecked()
    }

    await usuario.click(screen.getByRole("checkbox", { name: "Marcar todos os visíveis" }))
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
  })

  test("a marca geral fica parcial quando só alguns estão marcados", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await caixa("Pastel de Carne"))
    expect(screen.getByRole("checkbox", { name: "Marcar todos os visíveis" })).toHaveAttribute(
      "aria-checked",
      "mixed",
    )
  })

  test("o filtro novo tira da conta quem deixou de aparecer", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await caixa("Pastel de Carne"))
    await usuario.click(await caixa("Água Mineral"))
    expect(await screen.findByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "2 produtos selecionados",
    )

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar produto" }), "agua")
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
        "1 produto selecionado",
      ),
    )
  })

  test("Indisponível muda só quem estava disponível e limpa a seleção", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await caixa("Pastel de Carne"))
    // A Água Mineral já nasce esgotada: não entra na conta.
    await usuario.click(await caixa("Água Mineral"))
    await usuario.click(screen.getByRole("button", { name: "Indisponível" }))

    expect(await screen.findByText("1 produto ficou indisponível.")).toBeInTheDocument()
    expect(await (await linha("Pastel de Carne")).findByText("Esgotado")).toBeInTheDocument()
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
    expect(await caixa("Pastel de Carne")).not.toBeChecked()
  })

  test("Oculto esconde vários de uma vez", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await caixa("Pastel de Carne"))
    await usuario.click(await caixa("Água Mineral"))
    await usuario.click(screen.getByRole("button", { name: "Oculto" }))

    expect(await screen.findByText("2 produtos ficaram ocultos.")).toBeInTheDocument()
    expect(await (await linha("Pastel de Carne")).findByText("Oculto")).toBeInTheDocument()
    expect(await (await linha("Água Mineral")).findByText("Oculto")).toBeInTheDocument()
  })

  test("Excluir pede confirmação e tira todos os marcados", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await caixa("Pastel de Carne"))
    await usuario.click(await caixa("Água Mineral"))
    await usuario.click(screen.getByRole("button", { name: "Excluir" }))

    const dialogo = screen.getByRole("alertdialog", { name: "Excluir 2 produtos?" })
    await usuario.click(within(dialogo).getByRole("button", { name: "Sim, excluir" }))

    expect(await screen.findByText("2 produtos foram excluídos.")).toBeInTheDocument()
    expect(screen.queryByRole("listitem", { name: "Pastel de Carne" })).not.toBeInTheDocument()
    expect(screen.queryByRole("listitem", { name: "Água Mineral" })).not.toBeInTheDocument()
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
  })
})
