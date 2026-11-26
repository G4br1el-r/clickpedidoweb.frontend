import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { PaginaSecao, VisaoGeral } from "./pagina-secao"
import { usePrevia } from "./previa/estado"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/configuracoes" }))

function renderizar(conteudo: React.ReactNode) {
  return render(
    <TooltipProvider>
      {conteudo}
      <Toaster />
    </TooltipProvider>,
  )
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

describe("PaginaSecao: entrada", () => {
  test("os blocos de campos chegam em sequência, do primeiro ao último", () => {
    renderizar(<PaginaSecao id="identidade" />)
    const nome = screen.getByRole("region", { name: "Nome e subtítulo" })
    const banner = screen.getByRole("region", { name: "Banner" })
    expect(nome).toHaveClass("entra-bloco")
    expect(banner).toHaveClass("entra-bloco")
    expect(nome.parentElement).toHaveClass("sequencia-admin")
  })

  test("o esqueleto das configurações avisa quem espera e some quando carrega", () => {
    useConfig.setState({ ...useConfig.getInitialState(), hidratada: false }, true)
    renderizar(<PaginaSecao id="identidade" />)
    expect(screen.getByRole("status", { name: "Carregando a seção" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Nome e subtítulo" })).not.toBeInTheDocument()
  })
})

describe("VisaoGeral: restaurar um grupo de uma vez", () => {
  test("sem mudanças no grupo, não oferece restaurar", () => {
    renderizar(<VisaoGeral />)
    expect(screen.queryByRole("button", { name: /^Restaurar/ })).not.toBeInTheDocument()
  })

  test("o botão só aparece no grupo que mudou, com a conta de quantas seções", () => {
    renderizar(<VisaoGeral />)
    act(() => {
      useConfig.getState().atualizar("cores", { cantos: 4 })
      useConfig.getState().atualizar("tipografia", { escala: 110 })
    })
    const aparencia = screen.getByRole("region", { name: "Aparência" })
    expect(
      within(aparencia).getByRole("button", { name: "Restaurar Aparência (2 seções)" }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Marca" })).queryByRole("button", {
        name: /Restaurar/,
      }),
    ).not.toBeInTheDocument()
  })

  test("pede confirmação e volta todas as seções do grupo ao padrão de uma vez", async () => {
    const usuario = userEvent.setup()
    renderizar(<VisaoGeral />)
    act(() => {
      useConfig.getState().atualizar("cores", { cantos: 4 })
      useConfig.getState().atualizar("tipografia", { escala: 110 })
    })
    await usuario.click(screen.getByRole("button", { name: "Restaurar Aparência (2 seções)" }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo).toHaveTextContent("Cores e botões e Tipografia voltam ao padrão")
    expect(useConfig.getState().config.cores.cantos).toBe(4)

    await usuario.click(within(dialogo).getByRole("button", { name: "Restaurar" }))

    expect(useConfig.getState().config.cores.cantos).not.toBe(4)
    expect(useConfig.getState().config.tipografia.escala).toBe(100)
    expect(screen.queryByRole("button", { name: /^Restaurar/ })).not.toBeInTheDocument()
  })

  test("cancelar não muda nada, e o aviso depois de restaurar permite desfazer", async () => {
    const usuario = userEvent.setup()
    renderizar(<VisaoGeral />)
    act(() => useConfig.getState().atualizar("cores", { cantos: 4 }))
    await usuario.click(screen.getByRole("button", { name: "Restaurar Aparência (1 seção)" }))
    await usuario.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
    )
    expect(useConfig.getState().config.cores.cantos).toBe(4)

    await usuario.click(screen.getByRole("button", { name: "Restaurar Aparência (1 seção)" }))
    await usuario.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    )
    expect(useConfig.getState().config.cores.cantos).not.toBe(4)

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    expect(useConfig.getState().config.cores.cantos).toBe(4)
  })
})
