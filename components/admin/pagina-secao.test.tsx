import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { PaginaSecao, VisaoGeral } from "./pagina-secao"
import { usePrevia } from "./previa/estado"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/configuracoes" }))

function renderizar(conteudo: React.ReactNode) {
  return render(<TooltipProvider>{conteudo}</TooltipProvider>)
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
  usePrevia.setState(usePrevia.getInitialState(), true)
})

describe("VisaoGeral (Todas as opções)", () => {
  test("lista as seções por grupo, cada uma com link", () => {
    renderizar(<VisaoGeral />)
    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument()
    const marca = screen.getByRole("region", { name: "Marca" })
    expect(within(marca).getByRole("link", { name: /Identidade/ })).toHaveAttribute(
      "href",
      "/admin/configuracoes/identidade",
    )
    expect(screen.getByRole("region", { name: "Telas" })).toBeInTheDocument()
  })

  test("marca a seção que tem mudanças ainda fora do site", () => {
    renderizar(<VisaoGeral />)
    const cores = screen.getByRole("link", { name: /Cores e botões/ })
    expect(within(cores).queryByText("Não aplicado")).not.toBeInTheDocument()
    act(() => useConfig.getState().atualizar("cores", { cantos: 4 }))
    expect(within(cores).getByText("Não aplicado")).toBeInTheDocument()
    const identidade = screen.getByRole("link", { name: /Identidade/ })
    expect(within(identidade).queryByText("Não aplicado")).not.toBeInTheDocument()
  })
})

describe("PaginaSecao", () => {
  test("título da seção e cada bloco como uma região plana com o próprio nome", () => {
    renderizar(<PaginaSecao id="identidade" />)
    expect(screen.getByRole("heading", { level: 1, name: "Identidade" })).toBeInTheDocument()
    const nome = screen.getByRole("region", { name: "Nome e subtítulo" })
    expect(within(nome).getByLabelText("Nome da loja")).toHaveValue("Casa da Pizza")
    expect(screen.getByRole("region", { name: "Banner" })).toBeInTheDocument()
  })

  test("restaurar volta só aquela seção ao padrão", async () => {
    renderizar(<PaginaSecao id="identidade" />)
    act(() => useConfig.getState().atualizar("identidade", { nome: "Bella Napoli" }))
    const nome = screen.getByRole("region", { name: "Nome e subtítulo" })
    await userEvent.click(within(nome).getByRole("button", { name: "Restaurar" }))
    expect(useConfig.getState().config.identidade.nome).toBe("Casa da Pizza")
  })

  test("ao entrar, a prévia vai para a tela da seção", () => {
    renderizar(<PaginaSecao id="sacola" />)
    expect(usePrevia.getState().tela).toBe("sacola")
  })
})
