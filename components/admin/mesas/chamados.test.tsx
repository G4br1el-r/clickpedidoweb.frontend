import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear, get, set } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { BaseLoja } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

// Impressora: a fronteira com o navegador.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

let ultimoCliente: QueryClient

function Provedores({ children, endereco }: { children: ReactNode; endereco?: string }) {
  const [cliente] = useState(() => {
    ultimoCliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ultimoCliente
  })
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

const renderizar = (endereco?: string) =>
  render(
    <Provedores endereco={endereco}>
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
    expect(
      screen.getByRole("button", { name: "Chamados, 0 esperando", hidden: true }),
    ).toBeInTheDocument()
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

  test("o chamado de uma mesa que não existe mais não entra na lista nem no contador", async () => {
    await api().chamados.listar()
    // Outra aba excluiu a mesa sem passar por aqui: a base guardada tem o chamado órfão.
    const chave = "clickpedido-admin-dados:pizzaria"
    const guardado = (await get(chave)) as { base: BaseLoja }
    guardado.base.chamados.push({
      id: "chamado-orfao",
      mesaId: "mesa-que-sumiu",
      tipo: "garcom",
      criadoEm: new Date(2026, 10, 13, 20, 29).toISOString(),
    })
    await set(chave, guardado)
    reiniciarServidores()
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(await screen.findByRole("button", { name: "Chamados, 1 esperando" }))
    const lista = await screen.findByRole("dialog", { name: "Chamados" })
    expect(
      within(lista)
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Mesa 1"])
    expect(within(lista).queryByText(/undefined/)).not.toBeInTheDocument()
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

  test("com o QR desligado e nada esperando, fica só o QR na mesa com o cadeado Pro", async () => {
    const [chamado] = await api().chamados.listar()
    await api().chamados.atender(chamado.id)
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

  test("com o QR desligado, o que já chegou continua atendível, junto com o cadeado", async () => {
    await api().qr.pedir("mesa-11", [agua])
    const salao = await api().salao.config()
    await api().salao.salvar({ ...salao, funcoes: { ...salao.funcoes, qr: false } })
    const usuario = userEvent.setup()
    renderizar()

    expect(await screen.findByRole("button", { name: "QR na mesa Pro" })).toBeInTheDocument()
    const mesa1 = await screen.findByRole("button", { name: "Mesa 1" })
    expect(within(mesa1).getByText("Chamou o garçom")).toBeInTheDocument()
    await usuario.click(await screen.findByRole("button", { name: "Chamados, 2 esperando" }))
    const lista = await screen.findByRole("dialog", { name: "Chamados" })
    await usuario.click(within(lista).getByRole("button", { name: "Atender a mesa 1" }))
    await usuario.click(within(lista).getByRole("button", { name: "Recusar o pedido da mesa 11" }))

    expect(await within(lista).findByText("Nenhum chamado agora.")).toBeInTheDocument()
    expect(within(lista).queryByRole("button", { name: "Folha de QR" })).not.toBeInTheDocument()
  })
})

describe("Simular cliente na mesa", () => {
  test("a gaveta da mesa livre e a da aberta abrem a vitrine da mesa numa aba nova", async () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue(null)
    const usuario = userEvent.setup()
    renderizar("?mesa=11")
    await usuario.click(await screen.findByRole("button", { name: "Simular cliente na mesa" }))
    expect(abrir).toHaveBeenCalledWith(
      `${window.location.origin}/mesa?loja=pizzaria&mesa=mesa-11`,
      "_blank",
      "noopener",
    )
  })

  test("na comanda aberta também", async () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue(null)
    const usuario = userEvent.setup()
    renderizar("?mesa=1")
    await usuario.click(await screen.findByRole("button", { name: "Simular cliente na mesa" }))
    expect(abrir).toHaveBeenCalledWith(
      `${window.location.origin}/mesa?loja=pizzaria&mesa=mesa-1`,
      "_blank",
      "noopener",
    )
  })

  test("com o QR desligado, não aparece", async () => {
    const salao = await api().salao.config()
    await api().salao.salvar({ ...salao, funcoes: { ...salao.funcoes, qr: false } })
    renderizar("?mesa=11")
    expect(await screen.findByRole("heading", { name: "Mesa 11" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Simular cliente na mesa" }),
    ).not.toBeInTheDocument()
  })
})

describe("Folha de QR", () => {
  test("um QR por mesa sem bloqueio, com o número, o nome da loja e a URL, e Imprimir", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Chamados, 1 esperando" }))
    await usuario.click(await screen.findByRole("button", { name: "Folha de QR" }))

    const folha = await screen.findByRole("dialog", { name: "Folha de QR" })
    // 20 mesas na demonstração; a 20 está bloqueada.
    const qrs = within(folha).getAllByRole("figure")
    expect(qrs).toHaveLength(19)
    expect(within(qrs[0]).getByText("Mesa 1")).toBeInTheDocument()
    expect(within(qrs[0]).getByText("Casa da Pizza")).toBeInTheDocument()
    expect(
      within(qrs[0]).getByText(`${window.location.origin}/mesa?loja=pizzaria&mesa=mesa-1`),
    ).toBeInTheDocument()
    expect(within(qrs[0]).getByRole("img", { name: "QR da mesa 1" })).toBeInTheDocument()

    await usuario.click(within(folha).getByRole("button", { name: "Imprimir" }))
    expect(imprimir).toHaveBeenCalled()
  })
})
