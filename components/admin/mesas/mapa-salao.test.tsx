import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
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

/** Tela grande que pode mudar de tamanho no meio do teste (avisando quem ouve a consulta). */
function telaQueMuda() {
  let grande = true
  const ouvintes = new Set<() => void>()
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    get matches() {
      return consulta.includes("min-width") && grande
    },
    media: consulta,
    addEventListener: (_tipo: string, ouvinte: () => void) => ouvintes.add(ouvinte),
    removeEventListener: (_tipo: string, ouvinte: () => void) => ouvintes.delete(ouvinte),
  }))
  return {
    mudar(novo: boolean) {
      grande = novo
      for (const ouvinte of ouvintes) ouvinte()
    },
  }
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

const api = () => servidorDo("pizzaria")
const mapa = (area: string) => screen.findByRole("list", { name: `Mapa: ${area}` })
/** Os números das mesas da lista, na ordem da página, lidos do nome falado ("Mesa 3"). */
function numeros(lista: HTMLElement) {
  const lidos: number[] = []
  within(lista).getAllByRole("button", {
    name: (nome) => {
      const numero = /^Mesa (\d+)$/.exec(nome)?.[1]
      if (numero) lidos.push(Number(numero))
      return numero !== undefined
    },
  })
  return lidos
}

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

  test("a mesa reservada diz a hora, quem reservou e as pessoas, como no cartão (Fase 7)", async () => {
    await abrir("?vista=mapa&area=area-varanda")
    const varanda = await mapa("Varanda")
    const treze = within(varanda).getByRole("button", { name: "Mesa 13" })
    await waitFor(() =>
      expect(treze).toHaveAccessibleDescription("Reservada 20:50, Marina Costa · 2 pessoas"),
    )
    expect(within(varanda).getByText("Reservada 20:50")).toBeInTheDocument()
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

describe("editar o mapa", () => {
  test("Editar mapa trava abas e vista, esconde o ⋯ e dá a instrução do teclado", async () => {
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))

    expect(screen.getByRole("button", { name: "Salvar posições" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Varanda" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Grade" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: /^Ações da mesa/ })).not.toBeInTheDocument()
    expect(await mapa("Salão")).toHaveAccessibleDescription(
      "Use Tab para escolher a mesa e as setas para mover. Com Shift, anda 4 células.",
    )
  })

  test("na edição, o painel de reservas sai de cena e volta ao cancelar", async () => {
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    expect(
      await screen.findByRole("region", { name: "Reservas e espera" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))

    expect(screen.queryByRole("region", { name: "Reservas e espera" })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.getByRole("region", { name: "Reservas e espera" })).toBeInTheDocument()
  })

  test("no celular o mapa só é visto: não tem Editar mapa", async () => {
    vi.unstubAllGlobals()
    await abrir("?vista=mapa")
    await mapa("Salão")
    expect(screen.queryByRole("button", { name: "Editar mapa" })).not.toBeInTheDocument()
  })

  test("na edição o M não troca a vista", async () => {
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    await usuario.keyboard("m")
    expect(screen.getByRole("radio", { name: "Mapa" })).toBeChecked()
    expect(await mapa("Salão")).toBeInTheDocument()
  })

  test("na edição, a descrição continua com o estado da mesa e ganha a posição", async () => {
    const usuario = await abrir("?vista=mapa&area=area-balcao")
    const balcao = await mapa("Balcão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    expect(within(balcao).getByRole("button", { name: "Mesa 20" })).toHaveAccessibleDescription(
      "Bloqueada, Em manutenção, coluna 15, linha 8",
    )
  })

  test("na edição, número + Enter não abre a gaveta e o N não abre Nova mesa", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()

    await usuario.keyboard("3{Enter}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(endereco).not.toContain("mesa=")

    await usuario.keyboard("n")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar posições" })).toBeInTheDocument()
  })

  test("com o foco na mesa, as setas movem 1 célula e Shift+setas 4, e a região viva anuncia", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    const mesa1 = within(salao).getByRole("button", { name: "Mesa 1" })
    expect(mesa1).toHaveAccessibleDescription(/, coluna 2, linha 2$/)

    mesa1.focus()
    await usuario.keyboard("{ArrowRight}")
    expect(mesa1).toHaveAccessibleDescription(/, coluna 3, linha 2$/)
    expect(screen.getByText("Mesa 1: coluna 3, linha 2")).toBeInTheDocument()

    await usuario.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    expect(mesa1).toHaveAccessibleDescription(/, coluna 3, linha 10$/)
    expect(mesa1).toHaveFocus()
  })

  test.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("seta com %s fica para o navegador: não move a mesa", async (_tecla, modificador) => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    const mesa1 = within(salao).getByRole("button", { name: "Mesa 1" })
    mesa1.focus()

    // fireEvent devolve false quando a tela chamou preventDefault.
    expect(fireEvent.keyDown(mesa1, { key: "ArrowRight", ...modificador })).toBe(true)
    expect(mesa1).toHaveAccessibleDescription(/, coluna 2, linha 2$/)
  })

  test("fechar a aba com posição não salva pede confirmação do navegador", async () => {
    /** Dispara o fechamento da aba e diz se a tela pediu para confirmar. */
    const fecharAba = () => {
      const evento = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(evento)
      return evento.defaultPrevented
    }
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    expect(fecharAba()).toBe(false)

    const mesa1 = within(salao).getByRole("button", { name: "Mesa 1" })
    mesa1.focus()
    await usuario.keyboard("{ArrowRight}")
    expect(fecharAba()).toBe(true)

    // Voltar ao lugar salvo não é alteração.
    await usuario.keyboard("{ArrowLeft}")
    expect(fecharAba()).toBe(false)

    await usuario.keyboard("{ArrowRight}")
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(fecharAba()).toBe(false)
  })

  test("Salvar posições grava só a mesa que mudou, avisa e sai da edição", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{ArrowRight}{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    const posicionar = vi.spyOn(api().mesas, "posicionar")

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(await screen.findByText("Mapa salvo.")).toBeInTheDocument()
    expect(posicionar).toHaveBeenCalledWith([{ id: "mesa-1", posicao: { x: 2, y: 9 } }])
    expect((await api().mesas.listar()).find((mesa) => mesa.id === "mesa-1")?.posicao).toEqual({
      x: 2,
      y: 9,
    })
    expect(screen.getByRole("button", { name: "Editar mapa" })).toBeInTheDocument()
  })

  test("mesa por cima de outra fica marcada, e salvar recusa sem chamar o servidor", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    const mesa1 = within(salao).getByRole("button", { name: "Mesa 1" })
    mesa1.focus()
    // Em (2, 5) a mesa 1 fica por cima da 5, que está em (1, 4).
    await usuario.keyboard("{ArrowRight}{Shift>}{ArrowDown}{/Shift}")
    expect(mesa1).toHaveAccessibleDescription(/, coluna 3, linha 6, sobre outra mesa$/)
    expect(screen.getByText("Mesa 1: coluna 3, linha 6, sobre outra mesa")).toBeInTheDocument()
    const posicionar = vi.spyOn(api().mesas, "posicionar")

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(
      await screen.findByText("A mesa 1 está sobre outra mesa. Mova antes de salvar."),
    ).toBeInTheDocument()
    expect(posicionar).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Salvar posições" })).toBeInTheDocument()
  })

  test("só a mesa movida fica marcada por cima, e o aviso fala dela", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    const mesa5 = within(salao).getByRole("button", { name: "Mesa 5" })
    mesa5.focus()
    // A 5, em (1, 4), sobe até (1, 2), por cima da 1, que está em (1, 1) e não se mexeu.
    await usuario.keyboard("{ArrowUp}{ArrowUp}")
    expect(mesa5).toHaveAccessibleDescription(/, coluna 2, linha 3, sobre outra mesa$/)
    expect(within(salao).getByRole("button", { name: "Mesa 1" })).toHaveAccessibleDescription(
      /, coluna 2, linha 2$/,
    )

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(
      await screen.findByText("A mesa 5 está sobre outra mesa. Mova antes de salvar."),
    ).toBeInTheDocument()
  })

  test("com duas mesas movidas por cima de outras, o aviso fala da última", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    // A 1 vai de (1, 1) para (2, 5), por cima da 5; depois a 5 vai de (1, 4) para (2, 4).
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{ArrowRight}{Shift>}{ArrowDown}{/Shift}")
    const mesa5 = within(salao).getByRole("button", { name: "Mesa 5" })
    mesa5.focus()
    await usuario.keyboard("{ArrowRight}")
    expect(mesa5).toHaveAccessibleDescription(/, coluna 3, linha 5, sobre outra mesa$/)

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(
      await screen.findByText("A mesa 5 está sobre outra mesa. Mova antes de salvar."),
    ).toBeInTheDocument()
  })

  test("sem nada mudado, Salvar posições só sai da edição", async () => {
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    const posicionar = vi.spyOn(api().mesas, "posicionar")

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(await screen.findByRole("button", { name: "Editar mapa" })).toBeInTheDocument()
    expect(posicionar).not.toHaveBeenCalled()
  })

  test("mover e voltar ao lugar salvo não chama o servidor", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{ArrowRight}{ArrowLeft}")
    const posicionar = vi.spyOn(api().mesas, "posicionar")

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(await screen.findByRole("button", { name: "Editar mapa" })).toBeInTheDocument()
    expect(posicionar).not.toHaveBeenCalled()
  })

  test("o erro do servidor aparece no aviso e a edição continua", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    vi.spyOn(api().mesas, "posicionar").mockRejectedValue(new Error("A mesa 1 sai do mapa."))

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    expect(await screen.findByText("A mesa 1 sai do mapa.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar posições" })).toBeInTheDocument()
  })

  test("enquanto o salvar não volta, Cancelar fica travado", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    let soltar: () => void = () => {}
    const original = api().mesas.posicionar
    vi.spyOn(api().mesas, "posicionar").mockImplementation(async (lote) => {
      await new Promise<void>((pronto) => {
        soltar = pronto
      })
      return original(lote)
    })

    await usuario.click(screen.getByRole("button", { name: "Salvar posições" }))

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled())
    soltar()
    expect(await screen.findByText("Mapa salvo.")).toBeInTheDocument()
  })

  test("Cancelar volta a mesa para onde estava, sem gravar", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(salao).getByRole("button", { name: "Mesa 1" }).focus()
    await usuario.keyboard("{ArrowRight}")

    await usuario.click(screen.getByRole("button", { name: "Cancelar" }))
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))

    expect(within(salao).getByRole("button", { name: "Mesa 1" })).toHaveAccessibleDescription(
      /, coluna 2, linha 2$/,
    )
    expect((await api().mesas.listar()).find((mesa) => mesa.id === "mesa-1")?.posicao).toEqual({
      x: 1,
      y: 1,
    })
  })

  test("desligar o mapa em Configurar salão durante a edição solta o alternador e o M", async () => {
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    await usuario.click(screen.getByRole("button", { name: "Configurar salão" }))
    const painel = within(await screen.findByRole("dialog", { name: "Configurar salão" }))
    await usuario.click(painel.getByRole("switch", { name: /^Mapa do salão/ }))
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))
    await screen.findByText("Salão salvo.")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Configurar salão" })).not.toBeInTheDocument(),
    )

    expect(await screen.findByRole("radio", { name: "Mapa Pro" })).toBeEnabled()
    await usuario.keyboard("m")
    expect(await screen.findByRole("dialog", { name: "Mapa do salão é Pro" })).toBeInTheDocument()
  })

  test("a tela que cai abaixo de 768 px sai da edição e solta o alternador", async () => {
    const tela = telaQueMuda()
    const usuario = await abrir("?vista=mapa")
    await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    within(await mapa("Salão"))
      .getByRole("button", { name: "Mesa 1" })
      .focus()
    await usuario.keyboard("{ArrowRight}")

    act(() => tela.mudar(false))

    expect(screen.queryByRole("button", { name: "Salvar posições" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Grade" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Ações da mesa 1" })).toBeInTheDocument()
    // A planta volta a desenhar a mesa 1 onde ela está salva, na coluna 2.
    expect(
      within(await mapa("Salão"))
        .getByRole("button", { name: "Mesa 1" })
        .closest("li")?.style.gridColumn,
    ).toMatch(/^2 \//)

    // De volta à tela grande, a edição não volta sozinha, e o rascunho foi esquecido.
    act(() => tela.mudar(true))
    expect(screen.getByRole("button", { name: "Editar mapa" })).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))
    expect(
      within(await mapa("Salão")).getByRole("button", { name: "Mesa 1" }),
    ).toHaveAccessibleDescription(/coluna 2, linha 2$/)
  })

  test("tocar na mesa durante a edição não abre a gaveta", async () => {
    const usuario = await abrir("?vista=mapa")
    const salao = await mapa("Salão")
    await usuario.click(screen.getByRole("button", { name: "Editar mapa" }))

    await usuario.click(within(salao).getByRole("button", { name: "Mesa 1" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(endereco).not.toContain("mesa=")
  })
})

describe("cadeado Pro", () => {
  /** O plano sem o mapa do salão (a demonstração vem com tudo ligado). */
  async function semMapa() {
    const salao = await api().salao.config()
    await api().salao.salvar({ ...salao, funcoes: { ...salao.funcoes, mapa: false } })
  }

  test("com a função desligada, Mapa tem o cadeado e abre a explicação em vez de trocar a vista", async () => {
    await semMapa()
    const usuario = await abrir()
    const opcao = screen.getByRole("radio", { name: "Mapa Pro" })

    await usuario.click(opcao)

    const janela = within(await screen.findByRole("dialog", { name: "Mapa do salão é Pro" }))
    expect(janela.getByText(/R\$ 19,90 por mês/)).toBeInTheDocument()
    // A janela esconde o resto do leitor de tela; a vista continua na grade por trás dela.
    expect(screen.getByRole("radio", { name: "Grade", hidden: true })).toBeChecked()
    expect(endereco).not.toContain("vista=mapa")

    await usuario.click(janela.getByRole("button", { name: "Abrir Configurar salão" }))
    expect(await screen.findByRole("dialog", { name: "Configurar salão" })).toBeInTheDocument()
  })

  test("com a função desligada, ?vista=mapa mostra a grade", async () => {
    await semMapa()
    await abrir("?vista=mapa")
    expect(await screen.findByRole("list", { name: "Salão" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Mapa: Salão" })).not.toBeInTheDocument()
  })

  test("com a função desligada, o M abre a mesma explicação", async () => {
    await semMapa()
    const usuario = await abrir()
    await usuario.keyboard("m")
    expect(await screen.findByRole("dialog", { name: "Mapa do salão é Pro" })).toBeInTheDocument()
  })
})
