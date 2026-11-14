import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { MarcaLoja } from "./marca-loja"

function renderizar() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <MarcaLoja />
      </SidebarProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useConfig.setState(useConfig.getInitialState(), true)
})

describe("MarcaLoja", () => {
  test("mostra a loja do segmento escolhido, com a logo dela", () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    renderizar()

    expect(screen.getByText("Empório das Deusas")).toBeInTheDocument()
    expect(screen.getByText("Salão de beleza")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Logo de Empório das Deusas" })).toBeInTheDocument()
  })

  test("na pizzaria vale o nome editado na identidade da loja", () => {
    renderizar()
    expect(screen.getByText("Casa da Pizza")).toBeInTheDocument()
  })

  test("abre a loja em outra aba, sem dar à aba nova acesso a esta", () => {
    renderizar()
    const link = screen.getByRole("link", { name: /casa da pizza/i })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener")
  })
})
