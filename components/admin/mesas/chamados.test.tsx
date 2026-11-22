import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

vi.mock("react-to-print", () => ({ useReactToPrint: () => vi.fn() }))

let ultimoCliente: QueryClient

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(() => {
    ultimoCliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ultimoCliente
  })
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const renderizar = () =>
  render(
    <Provedores>
      <PaginaMesas />
    </Provedores>,
  )

const api = () => servidorDo("pizzaria")
const agua = { produtoId: "prod-agua", escolhas: {}, quantidade: 1 }

/** O AudioContext do navegador (fronteira): conta as notas tocadas. */
function somFalso() {
  const tocadas = vi.fn()
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      destination = {}
      state = "running"
      createOscillator() {
        tocadas()
        return {
          type: "sine",
          frequency: { setValueAtTime: () => {} },
          connect: (no: unknown) => no,
          start: () => {},
          stop: () => {},
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: (no: unknown) => no,
        }
      }
    },
  )
  return tocadas
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
  useGarcom.setState({ ...useGarcom.getInitialState(), nome: "Rafa" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Chamados", () => {
  test("o contador da demonstração e a lista: Atender tira o chamado", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Chamados, 1 esperando" }))

    const lista = await screen.findByRole("dialog", { name: "Chamados" })
    const chamado = within(lista).getByRole("listitem", { name: "Mesa 1" })
    expect(within(chamado).getByText("Chamou o garçom · há 3 min")).toBeInTheDocument()

    await usuario.click(within(chamado).getByRole("button", { name: "Atender a mesa 1" }))

    expect(await within(lista).findByText("Nenhum chamado agora.")).toBeInTheDocument()
    expect((await api().chamados.listar())[0].atendidoEm).toBe(
      new Date(2026, 10, 13, 20, 30).toISOString(),
    )
  })

  test("o pedido pelo QR: Aceitar abre a mesa com a rodada; Recusar tira da lista", async () => {
    await api().qr.pedir("mesa-11", [{ ...agua, quantidade: 2 }])
    await api().qr.pedir("mesa-12", [agua])
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Chamados, 3 esperando" }))
    const lista = await screen.findByRole("dialog", { name: "Chamados" })
    const pedido = within(lista).getByRole("listitem", { name: "Mesa 11" })
    expect(within(pedido).getByText("Pedido pelo QR · há 0 min")).toBeInTheDocument()
    expect(within(pedido).getByText("2× Água sem gás")).toBeInTheDocument()
    expect(within(pedido).getByText("R$ 10,00")).toBeInTheDocument()

    await usuario.click(within(pedido).getByRole("button", { name: "Aceitar o pedido da mesa 11" }))
    await usuario.click(within(lista).getByRole("button", { name: "Recusar o pedido da mesa 12" }))

    await waitFor(() =>
      expect(within(lista).queryByRole("listitem", { name: "Mesa 12" })).not.toBeInTheDocument(),
    )
    expect(within(lista).queryByRole("listitem", { name: "Mesa 11" })).not.toBeInTheDocument()
    const mesa11 = (await api().mesas.listar()).find((mesa) => mesa.numero === 11)
    const comanda = await api().pedidos.buscar(mesa11?.pedidoAtivoId ?? 0)
    expect(comanda?.mesa?.garcom).toBe("Rafa")
    expect(comanda?.itens.map((item) => item.nome)).toEqual(["Água sem gás"])
  })

  test("o cartão mostra o selo do chamado e do pedido, também para o leitor de tela", async () => {
    await api().qr.pedir("mesa-11", [agua])
    renderizar()
    const mesa1 = await screen.findByRole("button", { name: "Mesa 1" })
    expect(within(mesa1).getByText("Chamou o garçom")).toBeInTheDocument()
    expect(mesa1).toHaveAccessibleDescription(/Chamou o garçom/)
    const mesa11 = screen.getByRole("button", { name: "Mesa 11" })
    expect(within(mesa11).getByText("Pedido pelo QR")).toBeInTheDocument()
  })

  test("o som toca quando chega um chamado novo, e não com o som desligado", async () => {
    const tocadas = somFalso()
    usePreferenciasFila.setState({ somLigado: true })
    renderizar()
    await screen.findByRole("button", { name: "Chamados, 1 esperando" })
    expect(tocadas).not.toHaveBeenCalled()

    await api().qr.chamar("mesa-2", "garcom")
    await act(() => ultimoCliente.invalidateQueries())
    await screen.findByRole("button", { name: "Chamados, 2 esperando" })
    expect(tocadas).toHaveBeenCalled()

    tocadas.mockClear()
    usePreferenciasFila.setState({ somLigado: false })
    await api().qr.chamar("mesa-3", "garcom")
    await act(() => ultimoCliente.invalidateQueries())
    await screen.findByRole("button", { name: "Chamados, 3 esperando" })
    expect(tocadas).not.toHaveBeenCalled()
  })

  test("com o QR desligado, fica o QR na mesa com o cadeado Pro", async () => {
    const salao = await api().salao.config()
    await api().salao.salvar({ ...salao, funcoes: { ...salao.funcoes, qr: false } })
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(await screen.findByRole("button", { name: "QR na mesa Pro" }))

    const explicacao = await screen.findByRole("dialog", { name: "QR na mesa é Pro" })
    expect(within(explicacao).getByText(/R\$ 39,90 por mês/)).toBeInTheDocument()
    await usuario.click(within(explicacao).getByRole("button", { name: "Abrir Configurar salão" }))
    expect(await screen.findByRole("dialog", { name: "Configurar salão" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Chamados/ })).not.toBeInTheDocument()
  })
})
