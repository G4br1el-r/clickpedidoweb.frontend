import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { CampoCor, CampoImagem } from "./campos-midia"
import { usePrevia } from "./previa/estado"

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
  usePrevia.setState(usePrevia.getInitialState(), true)
})

afterEach(() => vi.unstubAllGlobals())

function renderizarImagem() {
  return render(
    <TooltipProvider>
      <CampoImagem
        campo="logo"
        titulo="Logo"
        descricao="Aparece no topo da loja."
        ladoMaximo={400}
        formato="quadrado"
      />
    </TooltipProvider>,
  )
}

const arquivo = () => new File(["x"], "logo.png", { type: "image/png" })

describe("CampoImagem", () => {
  test("enquanto a imagem é preparada, o botão mostra o carregamento e não aceita outro envio", async () => {
    let falhar: (erro: Error) => void = () => {}
    vi.stubGlobal(
      "createImageBitmap",
      () =>
        new Promise((_, rejeitar) => {
          falhar = rejeitar
        }),
    )
    const usuario = userEvent.setup()
    renderizarImagem()
    const botao = screen.getByRole("button", { name: "Enviar imagem" })

    await usuario.upload(screen.getByLabelText("Enviar logo"), arquivo())

    expect(botao).toHaveAttribute("aria-busy", "true")
    expect(botao).toBeDisabled()
    expect(screen.getByTestId("carregador-pontos")).toBeInTheDocument()

    act(() => falhar(new Error("não leu")))

    await waitFor(() => expect(botao).not.toHaveAttribute("aria-busy"))
    expect(botao).toBeEnabled()
  })

  test("com a imagem guardada, o botão vira Trocar e o Remover limpa", async () => {
    act(() => useConfig.getState().atualizar("identidade", { logo: "data:image/png;base64,AAAA" }))
    const usuario = userEvent.setup()
    renderizarImagem()
    expect(screen.getByRole("button", { name: "Trocar" })).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Remover" }))
    expect(useConfig.getState().config.identidade.logo).toBeNull()
  })

  test("os botões têm 44 px de altura no celular", () => {
    act(() => useConfig.getState().atualizar("identidade", { logo: "data:image/png;base64,AAAA" }))
    renderizarImagem()
    expect(screen.getByRole("button", { name: "Trocar" })).toHaveClass("max-md:min-h-11")
    expect(screen.getByRole("button", { name: "Remover" })).toHaveClass("max-md:min-h-11")
  })
})

describe("CampoCor", () => {
  test("digitar um hexadecimal completo troca a cor e marca a paleta como personalizada", async () => {
    const usuario = userEvent.setup()
    render(
      <TooltipProvider>
        <CampoCor campo="primaria" titulo="Cor principal" descricao="Botões e destaques." />
      </TooltipProvider>,
    )
    const campo = screen.getByLabelText("Cor principal")
    await usuario.clear(campo)
    await usuario.type(campo, "#112233")
    expect(useConfig.getState().config.cores.primaria).toBe("#112233")
    expect(useConfig.getState().config.cores.paleta).toBe("personalizada")
  })
})
