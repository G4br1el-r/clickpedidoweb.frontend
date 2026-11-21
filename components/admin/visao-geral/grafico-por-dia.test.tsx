import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { DiaDaSerie } from "@/lib/admin/regras/dashboard/resumo"
import GraficoPorDia from "./grafico-por-dia"

// Navegação do Next: a fronteira. O teste confere para onde o clique leva.
const navegacao = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navegacao }))

/** Quarta a sexta (hoje); o pico é quinta, 12/11. */
const SERIE: DiaDaSerie[] = [
  { data: new Date(2026, 10, 11), faturamento: 120, pedidos: 3, hoje: false, pico: false },
  { data: new Date(2026, 10, 12), faturamento: 480, pedidos: 9, hoje: false, pico: true },
  { data: new Date(2026, 10, 13), faturamento: 200, pedidos: 5, hoje: true, pico: false },
]

/** O SVG do recharts não tem papéis acessíveis para as barras: busca pelas classes dele. */
const barras = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".recharts-bar-rectangle path"))
const valoresNoTopo = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".recharts-label-list text")).map((texto) =>
    texto.textContent?.replace(/\s/g, " "),
  )

beforeEach(() => {
  navegacao.push.mockClear()
  // jsdom não calcula layout: a área do gráfico mede 640 × 256, como no painel; o resto
  // (a medida dos textos dos eixos) fica com tamanho zero, sem esconder rótulos.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const grafico = this.classList.contains("recharts-responsive-container")
    return DOMRect.fromRect(grafico ? { width: 640, height: 256 } : { width: 0, height: 0 })
  })
  // Sem animação (reduzir movimento): as barras e o valor do pico aparecem de uma vez.
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("prefers-reduced-motion"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
})

describe("GraficoPorDia", () => {
  test("uma barra por dia, com o dia no eixo e hoje escrito como Hoje", async () => {
    const { container } = render(<GraficoPorDia serie={SERIE} medida="faturamento" />)
    await waitFor(() => expect(barras(container)).toHaveLength(3))
    for (const rotulo of ["11/11", "12/11", "Hoje"]) {
      expect(screen.getByText(rotulo)).toBeInTheDocument()
    }
  })

  test("só o pico ganha o valor escrito no topo, em reais ou em pedidos", () => {
    const { container, rerender } = render(<GraficoPorDia serie={SERIE} medida="faturamento" />)
    expect(valoresNoTopo(container)).toEqual(["R$ 480"])

    rerender(<GraficoPorDia serie={SERIE} medida="pedidos" />)
    expect(valoresNoTopo(container)).toEqual(["9"])
  })

  test("clicar na barra abre os pedidos daquele dia", () => {
    const { container } = render(<GraficoPorDia serie={SERIE} medida="pedidos" />)
    fireEvent.click(barras(container)[1])
    expect(navegacao.push).toHaveBeenCalledWith("/admin/pedidos?data=2026-11-12")
  })
})
