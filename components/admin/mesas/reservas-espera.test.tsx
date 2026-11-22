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

function Provedores({ children, endereco }: { children: ReactNode; endereco?: string }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={endereco}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const api = () => servidorDo("pizzaria")

async function abrir(endereco?: string) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={endereco}>
      <PaginaMesas />
    </Provedores>,
  )
  // Com ?mesa= a gaveta abre por cima e esconde a busca: vale ela.
  if (endereco?.includes("mesa=")) await screen.findByRole("dialog", {}, { timeout: 8000 })
  else await screen.findByRole("searchbox", { name: "Buscar mesa" }, { timeout: 8000 })
  return usuario
}

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  localStorage.clear()
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const painel = async () =>
  within(await screen.findByRole("region", { name: "Reservas e espera" }, { timeout: 8000 }))

/** As linhas da lista, pelo texto de cada uma. */
const linhas = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole("listitem")
    .map((item) => item.textContent)

async function novaReserva(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click((await painel()).getByRole("button", { name: "Nova reserva" }))
  return within(await screen.findByRole("dialog", { name: "Nova reserva" }))
}

describe("Mesas: painel das reservas do dia", () => {
  test("lista as reservas de hoje pelo horário, com as pessoas e a mesa", async () => {
    await abrir()
    const reservas = await (await painel()).findByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(within(reservas).getAllByRole("listitem")).toHaveLength(2))
    const [marina, roberto] = linhas(reservas)
    expect(marina).toMatch(/20:50.*Marina Costa.*2 pessoas.*Mesa 13/)
    expect(roberto).toMatch(/22:30.*Roberto Andrade.*6 pessoas.*Sem mesa/)
  })

  test("Nova reserva diz o que falta ao salvar", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(janela.getByText("Informe o nome.")).toBeInTheDocument()
    expect(janela.getByText("Informe o horário.")).toBeInTheDocument()
    expect(janela.getByText("Informe de 1 a 99 pessoas.")).toBeInTheDocument()
    expect(janela.getByRole("textbox", { name: "Nome" })).toHaveAttribute("aria-invalid", "true")
  })

  test("com 4 pessoas às 21:00, sugere a mesa 8; usar e salvar mostra a reserva na lista", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Ana Lima")
    fireEvent.change(janela.getByLabelText("Horário"), { target: { value: "21:00" } })
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "4")

    expect(janela.getByText("Sugestão: mesa 8, 4 lugares.")).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Usar a mesa 8" }))
    expect(janela.getByRole("combobox", { name: "Mesa" })).toHaveTextContent("Mesa 8")
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(await screen.findByText("Reserva de Ana Lima salva.")).toBeInTheDocument()
    const reservas = (await painel()).getByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(linhas(reservas)[1]).toMatch(/21:00.*Ana Lima.*4 pessoas.*Mesa 8/))
  })

  test("Editar, Não compareceu e Cancelar pelo ⋯ da reserva", async () => {
    const usuario = await abrir()
    const acoes = async (nome: string) => {
      await usuario.click(
        await (await painel()).findByRole("button", { name: `Mais ações da reserva de ${nome}` }),
      )
      return within(await screen.findByRole("menu"))
    }
    await usuario.click((await acoes("Marina Costa")).getByRole("menuitem", { name: "Editar" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar reserva" }))
    expect(janela.getByRole("textbox", { name: "Nome" })).toHaveValue("Marina Costa")
    await usuario.clear(janela.getByRole("spinbutton", { name: "Pessoas" }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "3")
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))
    expect(await screen.findByText("Reserva de Marina Costa salva.")).toBeInTheDocument()

    await usuario.click(
      (await acoes("Roberto Andrade")).getByRole("menuitem", { name: "Não compareceu" }),
    )
    await usuario.click(
      (await acoes("Marina Costa")).getByRole("menuitem", { name: "Cancelar reserva" }),
    )

    const reservas = (await painel()).getByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => {
      const [marina, roberto] = linhas(reservas)
      expect(marina).toMatch(/Marina Costa.*3 pessoas.*Cancelada/)
      expect(roberto).toMatch(/Roberto Andrade.*Não compareceu/)
    })
  })

  test("passada a tolerância, a reserva das 20:50 diz Não compareceu", async () => {
    // A demonstração nasce às 20:30 (com a Marina às 20:50); a tela abre às 21:06.
    await api().reservas.listar()
    vi.setSystemTime(new Date(2026, 10, 13, 21, 6))
    await abrir()
    const reservas = await (await painel()).findByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(linhas(reservas)[0]).toMatch(/Marina Costa.*Não compareceu/))
  })

  test("o erro do servidor aparece no aviso", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Ana Lima")
    fireEvent.change(janela.getByLabelText("Horário"), { target: { value: "21:00" } })
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(janela.getByRole("combobox", { name: "Mesa" }))
    await usuario.click(await screen.findByRole("option", { name: /^Mesa 13\b/ }))
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(await screen.findByText("A mesa 13 já tem reserva às 20:50.")).toBeInTheDocument()
  })
})

async function abaEspera(usuario: ReturnType<typeof userEvent.setup>) {
  const aqui = await painel()
  await usuario.click(aqui.getByRole("tab", { name: /^Espera/ }))
  return within(await aqui.findByRole("list", { name: "Lista de espera" }))
}

async function escolherGarcom(usuario: ReturnType<typeof userEvent.setup>, janela: typeof screen) {
  await usuario.click(janela.getByRole("combobox", { name: "Garçom" }))
  await usuario.click(await screen.findByRole("option", { name: "Rafa" }))
}

describe("Mesas: lista de espera", () => {
  test("a fila mostra quem espera, há quanto tempo, a chamada e a mesa sugerida", async () => {
    const usuario = await abrir()
    expect((await painel()).getByRole("tab", { name: "Espera 3" })).toBeInTheDocument()
    const fila = await abaEspera(usuario)
    const [carlos, juliana, pedro] = fila.getAllByRole("listitem").map((item) => item.textContent)

    expect(carlos).toMatch(/Carlos Mendes.*2 pessoas.*há 25 min.*chamado há 2 min.*Mesa 11 livre/)
    expect(juliana).toMatch(/Juliana Rocha.*4 pessoas.*há 12 min.*Mesa 8 livre/)
    expect(pedro).toMatch(/Pedro Alves.*5 pessoas.*há 5 min.*Mesa 10 livre/)
  })

  test("o tempo de espera corre sozinho", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
    const usuario = await abrir()
    const fila = await abaEspera(usuario)
    expect(fila.getAllByRole("listitem")[0]).toHaveTextContent("há 25 min")

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 13, 20, 31))
      vi.advanceTimersByTime(30_000)
    })

    expect(fila.getAllByRole("listitem")[0]).toHaveTextContent("há 26 min")
  })

  test("Chamar com telefone é um link para o WhatsApp, numa aba nova, e grava a chamada", async () => {
    const usuario = await abrir()
    const fila = await abaEspera(usuario)
    const chamar = fila.getByRole("link", { name: "Chamar Pedro Alves" })

    expect(chamar).toHaveAttribute(
      "href",
      "https://wa.me/5512996543210?text=Ol%C3%A1!%20Sua%20mesa%20na%20Casa%20da%20Pizza%20est%C3%A1%20pronta.%20Pode%20vir%2C%20estamos%20te%20esperando.",
    )
    expect(chamar).toHaveAttribute("target", "_blank")
    chamar.addEventListener("click", (evento) => evento.preventDefault())
    await usuario.click(chamar)

    await waitFor(async () => {
      const pedro = (await api().espera.listar()).find((entrada) => entrada.nome === "Pedro Alves")
      expect(pedro?.chamadaEm).toBe(new Date(2026, 10, 13, 20, 30).toISOString())
    })
  })

  test("Chamar sem telefone só grava a chamada", async () => {
    const usuario = await abrir()
    const fila = await abaEspera(usuario)
    await usuario.click(fila.getByRole("button", { name: "Chamar Juliana Rocha" }))

    await waitFor(() =>
      expect(fila.getAllByRole("listitem")[1]).toHaveTextContent("chamado há 0 min"),
    )
  })

  test("Entrar na espera diz o que falta e põe no fim da fila", async () => {
    const usuario = await abrir()
    await abaEspera(usuario)
    await usuario.click((await painel()).getByRole("button", { name: "Entrar na espera" }))
    const janela = within(await screen.findByRole("dialog", { name: "Entrar na espera" }))
    await usuario.click(janela.getByRole("button", { name: "Pôr na fila" }))
    expect(janela.getByText("Informe o nome.")).toBeInTheDocument()
    expect(janela.getByText("Informe de 1 a 99 pessoas.")).toBeInTheDocument()

    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Ana Lima")
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(janela.getByRole("button", { name: "Pôr na fila" }))

    expect(await screen.findByText("Ana Lima entrou na espera.")).toBeInTheDocument()
    const fila = await abaEspera(usuario)
    await waitFor(() => expect(fila.getAllByRole("listitem").at(-1)).toHaveTextContent("Ana Lima"))
  })

  test("Desistiu tira da fila", async () => {
    const usuario = await abrir()
    const fila = await abaEspera(usuario)
    await usuario.click(fila.getByRole("button", { name: "Mais ações de Juliana Rocha" }))
    await usuario.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Desistiu" }),
    )

    await waitFor(() => expect(fila.getAllByRole("listitem")).toHaveLength(2))
  })

  test("Sentar já vem com a mesa sugerida; senta e tira da fila", async () => {
    const usuario = await abrir()
    const fila = await abaEspera(usuario)
    await usuario.click(fila.getByRole("button", { name: "Sentar Juliana Rocha" }))
    const janela = within(await screen.findByRole("dialog", { name: "Sentar Juliana Rocha" }))
    expect(janela.getByRole("combobox", { name: "Mesa" })).toHaveTextContent("Mesa 8")
    await escolherGarcom(usuario, janela as unknown as typeof screen)
    await usuario.click(janela.getByRole("button", { name: "Sentar" }))

    expect(await screen.findByText("Juliana Rocha na mesa 8.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(8)).toHaveTextContent("Juliana Rocha"))
    await waitFor(() => expect(fila.getAllByRole("listitem")).toHaveLength(2))
  })

  test("Sentar a reserva abre a mesa dela", async () => {
    const usuario = await abrir()
    await usuario.click(
      await (await painel()).findByRole("button", { name: "Sentar Marina Costa" }),
    )
    const janela = within(await screen.findByRole("dialog", { name: "Sentar Marina Costa" }))
    expect(janela.getByRole("combobox", { name: "Mesa" })).toHaveTextContent("Mesa 13")
    await escolherGarcom(usuario, janela as unknown as typeof screen)
    await usuario.click(janela.getByRole("button", { name: "Sentar" }))

    expect(await screen.findByText("Marina Costa na mesa 13.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(13)).toHaveTextContent("Marina Costa"))
  })
})
