import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { SecaoCores, SecaoTipografia } from "./marca-aparencia"

function renderizar(conteudo: React.ReactNode) {
  return render(<TooltipProvider>{conteudo}</TooltipProvider>)
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
})

describe("Cores e botões", () => {
  test("os cantos mostram uma amostra com o arredondamento escolhido", () => {
    renderizar(<SecaoCores />)
    const amostra = screen.getByTestId("amostra-cantos")
    expect(amostra).toHaveStyle({ borderTopLeftRadius: "12px" })
    act(() => useConfig.getState().atualizar("cores", { cantos: 0 }))
    expect(amostra).toHaveStyle({ borderTopLeftRadius: "0px" })
  })

  test("escolher uma paleta Pro troca as cores e põe a paleta na sacola", async () => {
    renderizar(<SecaoCores />)
    const paletas = screen.getByRole("radiogroup", { name: "Paleta" })
    await userEvent.click(within(paletas).getByRole("radio", { name: "Noite" }))
    expect(useConfig.getState().config.cores.paleta).toBe("noite")
    expect(useConfig.getState().config.cores.primaria).toBe("#1D1D24")
    expect(within(paletas).getByText("Na sacola")).toBeInTheDocument()
  })
})

describe("Tipografia", () => {
  test("as fontes Pro bloqueadas mostram o cadeado; liberadas, o selo dourado", () => {
    renderizar(<SecaoTipografia />)
    const titulos = screen.getByRole("radiogroup", { name: "Títulos" })
    expect(within(titulos).getAllByText("Pro")).toHaveLength(3)
    expect(titulos.querySelectorAll("[data-pro-liberada]")).toHaveLength(0)
    act(() => useConfig.getState().contratar("tudo"))
    // Cada fonte Pro liberada brilha: o cartão e o selo.
    expect(titulos.querySelectorAll(".opcao-pro")).toHaveLength(3)
    expect(titulos.querySelectorAll(".selo-pro[data-pro-liberada]")).toHaveLength(3)
  })
})
