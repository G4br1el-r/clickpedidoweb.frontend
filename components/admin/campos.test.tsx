import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { CampoSwitch } from "./campos"
import { usePrevia } from "./previa/estado"

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
  usePrevia.setState(usePrevia.getInitialState(), true)
})

describe("campos e a prévia", () => {
  test("mexer num campo diz à prévia a seção e o item que estão mudando", async () => {
    const usuario = userEvent.setup()
    render(
      <TooltipProvider>
        <CampoSwitch
          secao="inicio"
          campo="painelInfo"
          titulo="Painel de informações"
          descricao="Tempo de entrega e horário."
        />
      </TooltipProvider>,
    )
    await usuario.hover(screen.getByText("Painel de informações"))
    expect(usePrevia.getState().foco).toEqual({
      alvo: "inicio.painelInfo",
      secao: "Página inicial",
      rotulo: "Painel de informações",
    })

    usePrevia.setState({ foco: null })
    await usuario.click(screen.getByRole("switch"))
    expect(usePrevia.getState().foco?.alvo).toBe("inicio.painelInfo")
  })
})
