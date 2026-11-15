import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SeletorQuantidade } from "./seletor-quantidade"

function abrir(props: Partial<React.ComponentProps<typeof SeletorQuantidade>> = {}) {
  const aoMudar = vi.fn()
  const usuario = userEvent.setup()
  render(
    <TooltipProvider>
      <SeletorQuantidade valor={2} aoMudar={aoMudar} nome="Calzone" {...props} />
    </TooltipProvider>,
  )
  return { usuario, aoMudar }
}

describe("SeletorQuantidade", () => {
  test("mostra a quantidade no grupo com o nome do produto", () => {
    abrir()

    expect(screen.getByRole("group", { name: "Quantidade de Calzone" })).toHaveTextContent("2")
  })

  test("aumenta e diminui de um em um", async () => {
    const { usuario, aoMudar } = abrir()

    await usuario.click(screen.getByRole("button", { name: "Aumentar quantidade de Calzone" }))
    await usuario.click(screen.getByRole("button", { name: "Diminuir quantidade de Calzone" }))

    expect(aoMudar.mock.calls).toEqual([[3], [1]])
  })

  test("em 1, sem como remover, o menos fica travado", () => {
    abrir({ valor: 1 })

    expect(screen.getByRole("button", { name: "Diminuir quantidade de Calzone" })).toBeDisabled()
  })

  test("em 1, numa lista, o menos vira remover", async () => {
    const aoRemover = vi.fn()
    const { usuario, aoMudar } = abrir({ valor: 1, aoRemover, tamanho: "linha" })

    await usuario.click(screen.getByRole("button", { name: "Remover Calzone" }))

    expect(aoRemover).toHaveBeenCalledOnce()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  test("a quantidade nova é anunciada ao leitor de tela", () => {
    abrir()

    expect(screen.getByText("2").closest("[aria-live]")).toHaveAttribute("aria-live", "polite")
  })
})
