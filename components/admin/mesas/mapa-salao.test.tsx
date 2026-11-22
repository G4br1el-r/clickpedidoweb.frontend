import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

// Impressora: a fronteira com o navegador.
vi.mock("react-to-print", () => ({ useReactToPrint: () => vi.fn() }))

// Cada teste monta a tela inteira da demonstração.
vi.setConfig({ testTimeout: 20_000 })

/** O endereço depois da última mudança feita pela tela. */
let endereco = ""

function Provedores({ children, inicial }: { children: ReactNode; inicial?: string }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter
      hasMemory
      searchParams={inicial}
      onUrlUpdate={({ queryString }) => {
        endereco = queryString
      }}
    >
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

/** Tablet para cima (o padrão do setup é o celular). */
function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

async function abrir(inicial?: string) {
  const usuario = userEvent.setup()
  render(
    <Provedores inicial={inicial}>
      <PaginaMesas />
    </Provedores>,
  )
  await screen.findByRole("radiogroup", { name: "Vista" }, { timeout: 8000 })
  return usuario
}

const mapa = (area: string) => screen.findByRole("list", { name: `Mapa: ${area}` })
const numeros = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole("button", { name: /^Mesa \d+$/ })
    .map((botao) => Number(botao.textContent?.match(/\d+/)?.[0]))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  localStorage.clear()
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
  endereco = ""
  telaGrande()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("vista Mapa", () => {
  test("a grade é o padrão; Mapa grava ?vista=mapa e mostra as abas com o Salão escolhido", async () => {
    const usuario = await abrir()
    expect(screen.getByRole("radio", { name: "Grade" })).toBeChecked()

    await usuario.click(screen.getByRole("radio", { name: "Mapa" }))

    expect(endereco).toContain("vista=mapa")
    const abas = screen.getByRole("tablist", { name: "Áreas" })
    expect(
      within(abas)
        .getAllByRole("tab")
        .map((aba) => aba.textContent),
    ).toEqual(["Salão", "Varanda", "Balcão"])
    expect(within(abas).getByRole("tab", { name: "Salão" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(numeros(await mapa("Salão")).toSorted((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  test("?area= escolhe a aba, e trocar de aba grava a área", async () => {
    const usuario = await abrir("?vista=mapa&area=area-varanda")
    expect(numeros(await mapa("Varanda")).toSorted((a, b) => a - b)).toEqual([
      11, 12, 13, 14, 15, 16,
    ])

    await usuario.click(screen.getByRole("tab", { name: "Balcão" }))

    expect(endereco).toContain("area=area-balcao")
    expect(numeros(await mapa("Balcão")).toSorted((a, b) => a - b)).toEqual([17, 18, 19, 20])
  })

  test("no mapa a barra de filtros some", async () => {
    await abrir("?vista=mapa")
    await mapa("Salão")
    expect(screen.queryByRole("searchbox", { name: "Buscar mesa" })).not.toBeInTheDocument()
  })

  test("a mesa no mapa tem o mesmo nome e a mesma descrição falada do cartão", async () => {
    await abrir("?vista=mapa&area=area-varanda")
    const varanda = await mapa("Varanda")
    expect(within(varanda).getByRole("button", { name: "Mesa 16" })).toHaveAccessibleDescription(
      "Com a mesa 15, 6 lugares",
    )
  })

  test("a mesa bloqueada diz o motivo, como no cartão", async () => {
    await abrir("?vista=mapa&area=area-balcao")
    expect(
      within(await mapa("Balcão")).getByRole("button", { name: "Mesa 20" }),
    ).toHaveAccessibleDescription("Bloqueada, Em manutenção")
  })

  test("as mesas vêm na ordem de leitura do desenho: linha, depois coluna", async () => {
    await abrir("?vista=mapa")
    expect(numeros(await mapa("Salão"))).toEqual([1, 2, 3, 4, 9, 5, 6, 7, 8, 10])
  })

  test("tocar na 16 abre a gaveta da principal, a 15", async () => {
    const usuario = await abrir("?vista=mapa&area=area-varanda")
    await usuario.click(within(await mapa("Varanda")).getByRole("button", { name: "Mesa 16" }))
    expect(await screen.findByRole("dialog", { name: "Mesa 15" })).toBeInTheDocument()
  })

  test("o ⋯ da mesa no mapa tem as ações da grade: a 9 em limpeza oferece Marcar limpa", async () => {
    const usuario = await abrir("?vista=mapa")
    await usuario.click(
      within(await mapa("Salão")).getByRole("button", { name: "Ações da mesa 9" }),
    )
    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Marcar limpa" }),
    ).toBeInTheDocument()
  })

  test("a mesa com alerta fica marcada, como na grade", async () => {
    await abrir("?vista=mapa")
    // A comanda mais antiga da demonstração (mesa 1) pediu a conta há 12 min.
    expect(within(await mapa("Salão")).getByRole("button", { name: "Mesa 1" })).toHaveAttribute(
      "data-alerta",
      "conta-pedida",
    )
  })
})

describe("atalho M", () => {
  test("m fora de campo leva ao mapa, e M volta à grade", async () => {
    const usuario = await abrir()
    await usuario.keyboard("m")
    expect(await mapa("Salão")).toBeInTheDocument()
    expect(endereco).toContain("vista=mapa")

    await usuario.keyboard("M")
    expect(await screen.findByRole("list", { name: "Salão" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Grade" })).toBeChecked()
  })

  test("m na busca só escreve", async () => {
    const usuario = await abrir()
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar mesa" }), "m")
    expect(screen.getByRole("searchbox", { name: "Buscar mesa" })).toHaveValue("m")
    expect(screen.getByRole("radio", { name: "Grade" })).toBeChecked()
  })

  test("a folha de atalhos lista o M", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Atalhos do teclado" }))
    const folha = within(await screen.findByRole("dialog", { name: "Atalhos do teclado" }))
    expect(folha.getByText("Alternar entre grade e mapa")).toBeInTheDocument()
  })
})
