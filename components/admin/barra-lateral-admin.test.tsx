import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
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
  localStorage.clear()
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
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

describe("barra lateral por perfil", () => {
  beforeEach(async () => {
    await clear()
    reiniciarServidores()
  })

  /** O menu da Marina (caixa) já carregou: tem PDV e não tem a visão geral. */
  const menuDoCaixa = () =>
    waitFor(
      () => {
        expect(screen.getByRole("link", { name: "PDV" })).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: "Visão geral" })).not.toBeInTheDocument()
      },
      { timeout: 5000 },
    )

  test("o caixa não vê os grupos de aparência", async () => {
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    pagina.caminho = "/admin/pdv"
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ShellAdmin>
            <h1>Página</h1>
          </ShellAdmin>
        </TooltipProvider>
      </QueryClientProvider>,
    )
    await menuDoCaixa()
    expect(screen.queryByRole("button", { name: "Personalizar loja" })).not.toBeInTheDocument()
  })

  test("recarregar mantém o operador", async () => {
    await servidorDo("pizzaria").caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    // Recarregar: a memória volta ao começo e o navegador guarda o que foi salvo.
    const salvo = localStorage.getItem("clickpedido-admin-usuario") ?? ""
    useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-usuario", salvo)
    reiniciarServidores()

    pagina.caminho = "/admin/pdv"
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ShellAdmin>
            <h1>Página</h1>
          </ShellAdmin>
        </TooltipProvider>
      </QueryClientProvider>,
    )
    await menuDoCaixa()
    expect(useUsuarioSalvo.getState().porSegmento.pizzaria).toBe("eq-marina")
  })
})
