import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { BlocoConfig, CampoSegmentado, CampoSwitch, CampoTexto, SeloPro } from "./campos"
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

describe("SeloPro", () => {
  test.each([
    ["bloqueada", { liberada: false }],
    ["na sacola", { liberada: false, naSacola: true }],
    ["liberada", { liberada: true }],
  ])("o selo %s tem letra de 12 px, nunca menor", (_, props) => {
    render(<SeloPro {...props} />)
    const selo = screen.getByText(/Pro|Na sacola/)
    expect(selo.closest("[data-slot=badge]")).toHaveClass("text-xs")
  })
})

describe("BlocoConfig: restaurar", () => {
  function bloco() {
    return render(
      <TooltipProvider>
        <BlocoConfig titulo="Fundo" restaurar="cores">
          <p>campos</p>
        </BlocoConfig>
        <Toaster />
      </TooltipProvider>,
    )
  }

  test("o botão tem 44 px de altura no celular", () => {
    bloco()
    expect(screen.getByRole("button", { name: "Restaurar" })).toHaveClass("max-md:min-h-11")
  })

  test("restaura a seção e o aviso deixa desfazer", async () => {
    const usuario = userEvent.setup()
    bloco()
    act(() => useConfig.getState().atualizar("cores", { cantos: 4 }))

    await usuario.click(within(screen.getByRole("region", { name: "Fundo" })).getByRole("button"))
    expect(useConfig.getState().config.cores.cantos).not.toBe(4)

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    expect(useConfig.getState().config.cores.cantos).toBe(4)
  })
})

describe("campos: toque no celular", () => {
  test("as opções do campo segmentado e o campo de texto têm 44 px de altura", () => {
    render(
      <TooltipProvider>
        <CampoSegmentado<"cards", number>
          secao="cards"
          campo="colunasCelular"
          titulo="Colunas"
          opcoes={[
            { valor: 1, rotulo: "1", nome: "1 coluna" },
            { valor: 2, rotulo: "2", nome: "2 colunas" },
          ]}
        />
        <CampoTexto secao="identidade" campo="nome" titulo="Nome da loja" limite={40} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("radio", { name: "1 coluna" })).toHaveClass("max-md:min-h-11")
    expect(screen.getByRole("textbox", { name: "Nome da loja" })).toHaveClass("max-md:h-11")
  })
})
