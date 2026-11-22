import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { PontoDeVendas } from "@/lib/admin/regras/dashboard/vendas"
import GraficoDeVendas from "./grafico-vendas"

// Navegação do Next: a fronteira. O teste confere para onde o clique leva.
const navegacao = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navegacao }))

const DIAS: PontoDeVendas[] = [
  {
    inicio: new Date(2026, 10, 12),
    fim: new Date(2026, 10, 12),
    faturamento: 80,
    pedidos: 2,
    anterior: { inicio: new Date(2026, 10, 10), faturamento: 60, pedidos: 1 },
  },
  {
    inicio: new Date(2026, 10, 13),
    fim: new Date(2026, 10, 13),
    faturamento: 90,
    pedidos: 2,
    anterior: { inicio: new Date(2026, 10, 11), faturamento: 100, pedidos: 1 },
  },
]
const SEMANA: PontoDeVendas[] = [
  { ...DIAS[0], inicio: new Date(2026, 10, 1), fim: new Date(2026, 10, 7) },
]

/** O SVG do recharts não tem papéis acessíveis para as barras: busca pelas classes dele. */
const barrasDe = (container: HTMLElement, serie: "atual" | "anterior") =>
  Array.from(container.querySelectorAll(`.barras-${serie} .recharts-bar-rectangle path`))

beforeEach(() => {
  navegacao.push.mockClear()
  // jsdom não calcula layout: a área do gráfico mede 640 × 256, como no painel.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const grafico = this.classList.contains("recharts-responsive-container")
    return DOMRect.fromRect(grafico ? { width: 640, height: 256 } : { width: 0, height: 0 })
  })
  // Sem animação (reduzir movimento): as barras aparecem de uma vez.
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("prefers-reduced-motion"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
})

describe("GraficoDeVendas", () => {
  test("cada ponto tem a barra do período e, atrás, a do período anterior", async () => {
    const { container } = render(<GraficoDeVendas serie={DIAS} medida="faturamento" />)
    await waitFor(() => expect(barrasDe(container, "atual")).toHaveLength(2))
    expect(barrasDe(container, "anterior")).toHaveLength(2)
    expect(screen.getByText("12/11")).toBeInTheDocument()
  })

  test("clicar no dia abre os pedidos dele; na semana, os pedidos da semana", () => {
    const { container, rerender } = render(<GraficoDeVendas serie={DIAS} medida="pedidos" />)
    fireEvent.click(barrasDe(container, "atual")[1])
    expect(navegacao.push).toHaveBeenCalledWith("/admin/pedidos?data=2026-11-13")

    rerender(<GraficoDeVendas serie={SEMANA} medida="pedidos" />)
    fireEvent.click(barrasDe(container, "atual")[0])
    expect(navegacao.push).toHaveBeenLastCalledWith("/admin/pedidos?de=2026-11-01&ate=2026-11-07")
  })
})
