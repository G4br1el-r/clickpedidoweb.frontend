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
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

// Impressora: a fronteira com o navegador. O teste confere só que algo foi mandado imprimir.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

// Cada teste monta a tela de mesas inteira e passa por várias janelas.
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

/** O dinheiro do Intl vem com espaço não separável, que o nome acessível mantém. */
const nome = (texto: string) => texto.replace("R$ ", "R$ ")

/**
 * Mesa 70 da pizzaria (10% de taxa e R$ 8,00 de couvert), aberta para 2 pessoas com a Bia:
 * Pizza de R$ 40,00 e Água de R$ 4,00. Conta: 44 + 4,40 + 16 = R$ 64,40.
 */
async function mesaComConta() {
  const mesa = await api().mesas.criar({ numero: 70 })
  const comanda = await api().mesas.abrir(mesa.id, { pessoas: 2, garcom: "Bia" })
  await api().mesas.lancar({
    mesaId: mesa.id,
    enviarParaCozinha: false,
    itens: [
      { avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 },
      { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
    ],
  })
  return { mesa, comanda }
}

/** Abre a tela de mesas com a gaveta da mesa 70 já na aba Conta. */
async function abrirConta() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores endereco="?mesa=70">
      <PaginaMesas />
    </Provedores>,
  )
  const gaveta = within(
    await screen.findByRole("dialog", { name: /^Mesa 70\b/ }, { timeout: 8000 }),
  )
  await usuario.click(await gaveta.findByRole("tab", { name: "Conta" }))
  return { usuario, gaveta }
}

/** O valor ao lado de um rótulo do resumo da conta. */
const valorDe = (gaveta: ReturnType<typeof within>, rotulo: string | RegExp) =>
  within(gaveta.getByRole("region", { name: "Resumo da conta" })).getByText(rotulo)
    .nextElementSibling

const janelaReceber = () => within(screen.getByRole("dialog", { name: "Receber da mesa 70" }))

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  imprimir.mockClear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useGarcom.setState(useGarcom.getInitialState(), true)
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ComandaMesa: a aba Conta", () => {
  test("mostra os itens, a taxa, o couvert, o total e o saldo", async () => {
    await mesaComConta()
    const { gaveta } = await abrirConta()
    expect(valorDe(gaveta, "Itens")).toHaveTextContent("R$ 44,00")
    expect(valorDe(gaveta, "Taxa de serviço (10%)")).toHaveTextContent("R$ 4,40")
    expect(valorDe(gaveta, "Couvert (2 × R$ 8,00)")).toHaveTextContent("R$ 16,00")
    expect(valorDe(gaveta, "Total")).toHaveTextContent("R$ 64,40")
    expect(valorDe(gaveta, "Saldo")).toHaveTextContent("R$ 64,40")
  })

  test("Fechar conta recebe o saldo em Pix, fecha a conta e a mesa vai para a limpeza", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    expect(janelaReceber().getByRole("textbox", { name: "Valor" })).toHaveValue("R$ 64,40")
    await usuario.click(janelaReceber().getByRole("radio", { name: "Pix" }))
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 64,40") }))

    expect(await screen.findByText("Conta da mesa 70 fechada.")).toBeInTheDocument()
    expect(await cartao(70)).toHaveTextContent("Limpeza")
  })

  test("dinheiro: o valor recebido sugere as notas e mostra o troco", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    await usuario.click(janelaReceber().getByRole("radio", { name: "Dinheiro" }))
    const notas = within(janelaReceber().getByRole("group", { name: "Notas" }))
    expect(notas.getAllByRole("button").map((botao) => botao.textContent)).toEqual([
      nome("R$ 100,00"),
      nome("R$ 150,00"),
      nome("R$ 200,00"),
    ])
    await usuario.click(notas.getByRole("button", { name: nome("R$ 100,00") }))
    expect(janelaReceber().getByRole("textbox", { name: "Valor recebido" })).toHaveValue(
      "R$ 100,00",
    )
    expect(janelaReceber().getByText("Troco: R$ 35,60")).toBeInTheDocument()
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 64,40") }))
    expect(await screen.findByText("Conta da mesa 70 fechada.")).toBeInTheDocument()
    const [conta] = await api().pedidos.listar({ status: ["concluido"] })
    expect(conta.pagamentos).toMatchObject([{ forma: "dinheiro", recebido: 100, troco: 35.6 }])
  })

  test("cartão pede crédito ou débito antes de receber", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    await usuario.click(janelaReceber().getByRole("radio", { name: "Cartão" }))
    expect(janelaReceber().getByRole("button", { name: nome("Receber R$ 64,40") })).toBeDisabled()
    await usuario.click(janelaReceber().getByRole("radio", { name: "Débito" }))
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 64,40") }))
    expect(await screen.findByText("Conta da mesa 70 fechada.")).toBeInTheDocument()
    const [conta] = await api().pedidos.listar({ status: ["concluido"] })
    expect(conta.pagamentos).toMatchObject([{ forma: "cartao-na-entrega", cartao: "debito" }])
  })

  test("dividir igualmente em 3 e receber uma parte: o pagamento entra na lista e o saldo cai", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    const dividir = within(gaveta.getByRole("region", { name: "Dividir igualmente" }))
    const partes = dividir.getByRole("spinbutton", { name: "Partes" })
    // Começa nas pessoas da mesa.
    expect(partes).toHaveValue(2)
    await usuario.clear(partes)
    await usuario.type(partes, "3")
    expect(dividir.getAllByRole("button", { name: /^Receber/ }).map((b) => b.textContent)).toEqual([
      nome("Receber R$ 21,46"),
      nome("Receber R$ 21,46"),
      nome("Receber R$ 21,48"),
    ])
    await usuario.click(dividir.getAllByRole("button", { name: nome("Receber R$ 21,46") })[0])
    expect(janelaReceber().getByRole("textbox", { name: "Valor" })).toHaveValue("R$ 21,46")
    await usuario.click(janelaReceber().getByRole("radio", { name: "Pix" }))
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 21,46") }))

    const pagamentos = within(await gaveta.findByRole("list", { name: "Pagamentos" }))
    expect(pagamentos.getByRole("listitem")).toHaveTextContent("Pix")
    expect(pagamentos.getByRole("listitem")).toHaveTextContent("R$ 21,46")
    await waitFor(() => expect(valorDe(gaveta, "Saldo")).toHaveTextContent("R$ 42,94"))
    expect(valorDe(gaveta, "Pago")).toHaveTextContent("R$ 21,46")
  })

  test("por item: os itens marcados somam com a taxa deles", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    const porItem = within(gaveta.getByRole("region", { name: "Por item" }))
    expect(porItem.getByRole("button", { name: /^Receber/ })).toBeDisabled()
    await usuario.click(porItem.getByRole("checkbox", { name: /Pizza/ }))
    await usuario.click(porItem.getByRole("button", { name: nome("Receber R$ 44,00") }))
    expect(janelaReceber().getByRole("textbox", { name: "Valor" })).toHaveValue("R$ 44,00")
    expect(janelaReceber().getByRole("textbox", { name: "Valor" })).toBeDisabled()
    await usuario.click(janelaReceber().getByRole("radio", { name: "Pix" }))
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 44,00") }))
    await waitFor(() => expect(valorDe(gaveta, "Saldo")).toHaveTextContent("R$ 20,40"))
    // O item pago sai da lista para pagar por item.
    expect(porItem.queryByRole("checkbox", { name: /Pizza/ })).not.toBeInTheDocument()
  })
})
