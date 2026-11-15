import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { usePrevia } from "./previa/estado"
import { Wireframe } from "./wireframe"

function renderizar() {
  return render(
    <TooltipProvider>
      <Wireframe />
      <Toaster />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
  usePrevia.setState(usePrevia.getInitialState(), true)
})

describe("Wireframe e a prévia", () => {
  test("passar o mouse num bloco avisa a prévia do que está sendo editado", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.hover(screen.getByTestId("bloco-promocional"))
    expect(usePrevia.getState().foco).toEqual({
      alvo: "bloco:promocional",
      secao: "Página inicial",
      rotulo: "Banner promocional",
      // O banner promocional vem desligado de fábrica.
      desligado: true,
    })
  })

  test("ligar o bloco atualiza o aviso: agora ele aparece na prévia", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(screen.getByRole("switch", { name: "Mostrar Banner promocional" }))
    expect(usePrevia.getState().foco).toMatchObject({
      alvo: "bloco:promocional",
      desligado: false,
    })
  })

  test("o foco do teclado também conta, e sair do bloco solta o foco", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.hover(screen.getByTestId("bloco-ofertas"))
    expect(usePrevia.getState().foco?.rotulo).toBe("Ofertas do dia")
    await usuario.unhover(screen.getByTestId("bloco-ofertas"))
    await new Promise((resolver) => setTimeout(resolver, 500))
    expect(usePrevia.getState().foco).toBeNull()
  })
})
