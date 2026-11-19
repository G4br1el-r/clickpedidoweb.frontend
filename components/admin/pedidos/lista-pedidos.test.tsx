import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import type { ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { ListaPedidos } from "./lista-pedidos"

function Provedores({
  children,
  aoMudarUrl,
  endereco,
}: {
  children: ReactNode
  aoMudarUrl?: OnUrlUpdateFunction
  endereco?: string
}) {
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={aoMudarUrl} searchParams={endereco}>
      <TooltipProvider>{children}</TooltipProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar(pedidos: Pedido[], aoMudarUrl?: OnUrlUpdateFunction, endereco?: string) {
  return render(
    <Provedores aoMudarUrl={aoMudarUrl} endereco={endereco}>
      <ListaPedidos pedidos={pedidos} />
    </Provedores>,
  )
}

/** Números de pedido na ordem das linhas da tabela. */
const numeros = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((linha) => within(linha).getAllByRole("cell")[0].textContent)

describe("ListaPedidos", () => {
  test("mostra os pedidos do mais novo para o mais antigo, com o total da lista", () => {
    renderizar(PEDIDOS_DE_TESTE)
    expect(numeros()).toEqual(["#6", "#5", "#4", "#3", "#2", "#1", "#7", "#8"])
    expect(screen.getByText("8 pedidos · R$ 330,00 em vendas válidas")).toBeInTheDocument()
  })

  test("a busca reduz a lista", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "guarana")
    expect(numeros()).toEqual(["#5"])
    expect(screen.getByText("1 pedido · R$ 20,00 em vendas válidas")).toBeInTheDocument()
  })

  test("o filtro de status mostra a contagem e reduz a lista", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.click(screen.getByRole("button", { name: /status/i }))
    const cancelado = screen.getByRole("option", { name: /cancelado/i })
    expect(cancelado).toHaveTextContent("1")
    await usuario.click(cancelado)
    await usuario.keyboard("{Escape}")
    expect(numeros()).toEqual(["#3"])
  })

  test("ordena pelo total, do maior para o menor", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.click(screen.getByRole("button", { name: "Ordenar por total" }))
    expect(numeros().slice(0, 3)).toEqual(["#7", "#4", "#8"])
  })

  test("pagina de 20 em 20", async () => {
    const usuario = userEvent.setup()
    const muitos = Array.from({ length: 25 }, (_, indice) => ({
      ...PEDIDOS_DE_TESTE[2],
      id: indice + 1,
      numero: indice + 1,
      criadoEm: new Date(2026, 10, 1, 10, indice).toISOString(),
    }))
    renderizar(muitos)
    expect(numeros()).toHaveLength(20)
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Próxima página" }))
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(numeros()).toEqual(["#5", "#4", "#3", "#2", "#1"])
  })

  test("abrir um pedido guarda o número no endereço", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    renderizar(PEDIDOS_DE_TESTE, aoMudar)
    await usuario.click(screen.getByRole("button", { name: "Abrir o pedido #4" }))
    expect(aoMudar.mock.lastCall?.[0].searchParams.get("pedido")).toBe("4")
  })

  test("sem resultado, mostra um aviso e o botão de limpar", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "pizza de abacaxi")
    expect(screen.getByText("Nenhum pedido com esses filtros")).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(numeros()).toHaveLength(8)
  })

  test("a origem vem do endereço, aparece como etiqueta e sai ao tocar nela", async () => {
    const usuario = userEvent.setup()
    const doPdv = { ...PEDIDOS_DE_TESTE[0], id: 50, numero: 50, origem: "pdv" as const }
    renderizar([...PEDIDOS_DE_TESTE, doPdv], undefined, "?origem=pdv")
    expect(numeros()).toEqual(["#50"])
    await usuario.click(
      screen.getByRole("button", { name: "Tirar o filtro Origem: PDV do balcão" }),
    )
    expect(numeros()).toHaveLength(9)
  })
})
