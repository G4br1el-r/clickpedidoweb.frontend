import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { LayoutConfiguracoes } from "./layout-configuracoes"
import { usePrevia } from "./previa/estado"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/configuracoes/cores",
  useRouter: () => ({ push: vi.fn() }),
}))

function renderizar() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <LayoutConfiguracoes>
          <p>conteúdo da seção</p>
        </LayoutConfiguracoes>
      </SidebarProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
  usePrevia.setState(usePrevia.getInitialState(), true)
})

describe("LayoutConfiguracoes", () => {
  test("mostra a seção aberta e o caminho até ela", () => {
    renderizar()
    expect(screen.getByText("conteúdo da seção")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/admin/configuracoes",
    )
  })

  test("o botão Prévia tem 44 px de altura no celular e abre a prévia", async () => {
    renderizar()
    const botao = screen.getByRole("button", { name: "Prévia" })
    expect(botao).toHaveClass("max-md:min-h-11")
    await userEvent.click(botao)
    expect(usePrevia.getState().folhaAberta).toBe(true)
  })

  test("a página de ajustes não rola de lado: o conteúdo é uma coluna que encolhe", () => {
    renderizar()
    expect(screen.getByText("conteúdo da seção").parentElement).toHaveClass("min-w-0")
  })
})
