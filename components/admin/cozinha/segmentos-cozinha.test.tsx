import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { PaginaCozinha } from "./pagina-cozinha"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
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

function noSegmento(segmento: SegmentoPainelId) {
  useSegmentoAtual.setState({ segmento })
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  render(
    <Provedores>
      <PaginaCozinha intervalo={60_000} />
    </Provedores>,
  )
}

/** Uma escolha de cada grupo obrigatório (o primeiro item ativo, quantas o mínimo pedir). */
const escolhasDe = (produto: Produto, pular: Record<string, number> = {}) =>
  Object.fromEntries(
    produto.grupos
      .filter((grupo) => grupo.minimo > 0)
      .map((grupo) => {
        const ativos = grupo.itens.filter((item) => item.ativo !== false)
        const inicio = pular[grupo.id] ?? 0
        return [grupo.id, ativos.slice(inicio, inicio + grupo.minimo).map((item) => item.id)]
      }),
  )

const ticket = (nome: string) =>
  screen.findByRole("article", { name: new RegExp(`^${nome} ·`) }, { timeout: 8000 })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
  useConfig.setState({ pro: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useConfig.setState({ pro: false, compradas: [] })
  toast.dismiss()
})

describe("a cozinha de cada segmento", () => {
  test("pizzaria: os sabores em frações e a borda em destaque", async () => {
    const api = servidorDo("pizzaria")
    const meio = (await api.produtos.listar()).find(
      (produto) => produto.nome === "Pizza meio a meio",
    ) as Produto
    const [sabor1, sabor2] = meio.grupos
    const mesa = await api.mesas.criar({ numero: 31 })
    const borda = meio.grupos[2].itens.find((item) => !/tradicional|sem/i.test(item.nome))
    await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        {
          produtoId: meio.id,
          quantidade: 1,
          escolhas: {
            [sabor1.id]: [sabor1.itens[0].id],
            [sabor2.id]: [sabor2.itens[1].id],
            [meio.grupos[2].id]: [borda?.id ?? ""],
          },
        },
      ],
    })
    noSegmento("pizzaria")
    const doTicket = within(await ticket("Mesa 31"))
    expect(doTicket.getByText(`½ ${sabor1.itens[0].nome}`)).toBeInTheDocument()
    expect(doTicket.getByText(`½ ${sabor2.itens[1].nome}`)).toBeInTheDocument()
    expect(doTicket.getByText(`Borda: ${borda?.nome}`)).toHaveAttribute("data-destaque")
    expect(doTicket.queryByText(/1º sabor/)).not.toBeInTheDocument()
  })

  test("adega: o combo abre em itens", async () => {
    const api = servidorDo("adega")
    const combo = (await api.produtos.listar()).find(
      (produto) => produto.id === "prod-master-black-combo-2-gelo",
    ) as Produto
    const mesa = await api.mesas.criar({ numero: 32 })
    await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ produtoId: combo.id, quantidade: 2, escolhas: escolhasDe(combo) }],
    })
    noSegmento("adega")
    const doTicket = within(await ticket("Mesa 32"))
    const energetico = combo.grupos[0].itens.filter((item) => item.ativo !== false)[0]
    expect(doTicket.getByText(`2× ${energetico.nome}`)).toBeInTheDocument()
  })

  test("açougue: o peso pedido aparece e o açougueiro pesa no próprio ticket", async () => {
    const api = servidorDo("acougue")
    const abertos = await api.pedidos.listar({ status: ["recebido", "em-preparo"] })
    const pedido = abertos.find((item) => item.pagamento === "pagar-apos-pesagem" && !item.pesagem)
    if (!pedido) throw new Error("A demo do açougue devia ter um pedido a pesar na cozinha")
    const usuario = userEvent.setup()
    noSegmento("acougue")
    const doTicket = within(await ticket(pedido.tipo === "entrega" ? "Entrega" : "Retirada"))
    expect(doTicket.getAllByText(/^Peso: [\d,]+ (g|kg)$/).length).toBeGreaterThan(0)

    const alvo = within(
      await screen.findByRole("article", { name: new RegExp(`· #${pedido.numero}$`) }),
    )
    await usuario.click(alvo.getByRole("button", { name: "Pesar" }))
    const janela = within(await screen.findByRole("dialog", { name: /^Pesar #/ }))
    for (const campo of janela.getAllByRole("textbox", { name: /^Peso de / })) {
      await usuario.clear(campo)
      await usuario.type(campo, "500")
    }
    await usuario.click(janela.getByRole("button", { name: "Registrar pesagem" }))
    await waitFor(async () => expect((await api.pedidos.buscar(pedido.id))?.pesagem).toBeDefined())
  })

  test("lanchonete: o número do pedido aparece grande, para chamar", async () => {
    const api = servidorDo("lanchonete")
    const mesa = await api.mesas.criar({ numero: 33 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 1 }],
    })
    noSegmento("lanchonete")
    const doTicket = within(await ticket("Mesa 33"))
    expect(doTicket.getByText(`#${comanda.numero}`)).toHaveAttribute("data-numero-grande")
  })
})
