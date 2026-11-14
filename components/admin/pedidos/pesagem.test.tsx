import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { DetalhesPedido } from "./detalhes-pedido"

vi.mock("react-to-print", () => ({ useReactToPrint: () => () => {} }))

function Provedores({ children, pedido }: { children: ReactNode; pedido: number }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter searchParams={{ pedido: String(pedido) }} hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const api = () => servidorDo("acougue")

/** Pedido do açougue, a pagar depois da pesagem, ainda não pesado. */
async function paraPesar(): Promise<Pedido> {
  const abertos = await api().pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
  const pedido = abertos.find((item) => item.pagamento === "pagar-apos-pesagem" && !item.pesagem)
  if (!pedido) throw new Error("A demonstração do açougue devia ter um pedido a pesar")
  return pedido
}

async function abrir(pedido: Pedido) {
  const usuario = userEvent.setup()
  render(
    <Provedores pedido={pedido.id}>
      <DetalhesPedido />
    </Provedores>,
  )
  const detalhes = within(
    await screen.findByRole("dialog", { name: `Pedido #${pedido.numero}` }, { timeout: 8000 }),
  )
  // Depois de pesado, o título ganha a hora: "Pesagem Pesado às 20:30".
  const regiao = detalhes.getByRole("region", { name: /^Pesagem/ })
  return { usuario, detalhes, pesagem: within(regiao) }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "acougue" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Pesagem nos detalhes do pedido", () => {
  test("digita o peso da balança, vê a diferença e registra; depois manda o link", async () => {
    const pedido = await paraPesar()
    const porQuilo = pedido.itens.filter((item) => item.pesoGramas)
    const { usuario, detalhes, pesagem } = await abrir(pedido)

    // Todos com o peso pedido, menos o primeiro, com 1 kg a mais: a diferença é o preço do quilo.
    for (const [posicao, item] of porQuilo.entries()) {
      const pedidoGramas = (item.pesoGramas as number) * item.quantidade
      const campo = pesagem.getByRole("textbox", { name: `Peso de ${item.nome}` })
      await usuario.type(campo, String(pedidoGramas + (posicao === 0 ? 1000 : 0)))
    }
    const quilo = (porQuilo[0].precoKg as number).toFixed(2).replace(".", ",")
    expect(pesagem.getByText(new RegExp(`Diferença: \\+ R\\$\\s${quilo}`))).toBeInTheDocument()

    await usuario.click(pesagem.getByRole("button", { name: "Registrar pesagem" }))
    expect(await pesagem.findByText("Pesado às 20:30")).toBeInTheDocument()
    await waitFor(async () =>
      expect((await api().pedidos.buscar(pedido.id))?.pesagem).toBeDefined(),
    )

    const link = detalhes.getByRole("link", { name: "Enviar link de pagamento" })
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/55"))
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      `/checkout/${pedido.token}`,
    )
  })

  test("antes de pesar, não dá para marcar como pago: a tela diz o motivo", async () => {
    const pedido = await paraPesar()
    const { detalhes } = await abrir(pedido)
    expect(detalhes.queryByRole("button", { name: "Marcar como pago" })).not.toBeInTheDocument()
    expect(detalhes.getByText("Pese o pedido antes de receber.")).toBeInTheDocument()
  })

  test("pedido pago não muda de valor: a balança fica bloqueada", async () => {
    const pedido = await paraPesar()
    // Só recebe depois de pesado: pesa com o peso pedido e marca como pago.
    const pesos = Object.fromEntries(
      pedido.itens
        .filter((item) => item.pesoGramas)
        .map((item) => [item.id, (item.pesoGramas as number) * item.quantidade]),
    )
    await api().pedidos.registrarPesagem(pedido.id, pesos)
    await api().pedidos.marcarPago(pedido.id)
    const { pesagem } = await abrir(pedido)
    expect(pesagem.getByText("Pedido pago: a pesagem não muda o valor.")).toBeInTheDocument()
    for (const campo of pesagem.getAllByRole("textbox")) expect(campo).toBeDisabled()
    expect(pesagem.queryByRole("button", { name: "Registrar pesagem" })).not.toBeInTheDocument()
  })
})
