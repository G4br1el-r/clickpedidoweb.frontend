import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { ShellAdmin } from "./shell-admin"

const pagina = vi.hoisted(() => ({ caminho: "/admin" }))
vi.mock("next/navigation", () => ({ usePathname: () => pagina.caminho }))

function abrirEm(caminho: string) {
  pagina.caminho = caminho
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ShellAdmin>
          <h1>Página</h1>
        </ShellAdmin>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return screen.getByRole("button", { name: "Personalizar loja" })
}

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useConfig.setState(useConfig.getInitialState(), true)
})

describe("Personalizar loja na barra lateral", () => {
  test("fora das configurações, começa fechado como os outros grupos", () => {
    expect(abrirEm("/admin/fila")).toHaveAttribute("aria-expanded", "false")
  })

  test("na página inicial do painel, também começa fechado", () => {
    expect(abrirEm("/admin")).toHaveAttribute("aria-expanded", "false")
  })

  test("numa página de configuração, abre para mostrar onde você está", () => {
    expect(abrirEm("/admin/configuracoes/cores")).toHaveAttribute("aria-expanded", "true")
  })

  test("aberto e parado, o conteúdo não corta o contorno dos itens nem o foco da busca", () => {
    const titulo = abrirEm("/admin/configuracoes/cores")
    const conteudo = document.getElementById(titulo.getAttribute("aria-controls") ?? "")
    expect(conteudo?.style.overflow).toBe("visible")
  })

  test("fechado, o conteúdo fica recortado na altura zero", () => {
    const titulo = abrirEm("/admin/fila")
    const conteudo = document.getElementById(titulo.getAttribute("aria-controls") ?? "")
    expect(conteudo?.style.overflow).toBe("hidden")
  })

  test("abre e fecha ao tocar no título", async () => {
    const titulo = abrirEm("/admin/fila")
    const usuario = userEvent.setup()

    await usuario.click(titulo)
    expect(titulo).toHaveAttribute("aria-expanded", "true")

    await usuario.click(titulo)
    expect(titulo).toHaveAttribute("aria-expanded", "false")
  })
})
