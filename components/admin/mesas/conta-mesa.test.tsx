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
import type { Mesa } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { Comprovante, PreConta } from "./impressao-conta"
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

  test("sem saldo (tudo em cortesia, sem couvert), Fechar conta fecha direto", async () => {
    const { comanda } = await mesaComConta()
    for (const item of (await api().pedidos.buscar(comanda.id))?.itens ?? []) {
      await api().mesas.darCortesia(comanda.id, item.id, { motivo: "Aniversário" })
    }
    await api().mesas.tirarCouvert(comanda.id, { motivo: "Sem música" })
    const { usuario, gaveta } = await abrirConta()
    expect(valorDe(gaveta, "Saldo")).toHaveTextContent("R$ 0,00")
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    expect(screen.queryByRole("dialog", { name: "Receber da mesa 70" })).not.toBeInTheDocument()
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

  test("dinheiro acima do saldo: a tela mostra o mesmo troco que o servidor grava", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    await usuario.click(janelaReceber().getByRole("radio", { name: "Dinheiro" }))
    const valor = janelaReceber().getByRole("textbox", { name: "Valor" })
    await usuario.clear(valor)
    await usuario.type(valor, "70")
    await usuario.type(janelaReceber().getByRole("textbox", { name: "Valor recebido" }), "100")
    // Abate só o saldo de R$ 64,40: o troco é 100 − 64,40.
    expect(janelaReceber().getByText("Troco: R$ 35,60")).toBeInTheDocument()
    await usuario.click(janelaReceber().getByRole("button", { name: nome("Receber R$ 70,00") }))
    expect(await screen.findByText("Conta da mesa 70 fechada.")).toBeInTheDocument()
    const [conta] = await api().pedidos.listar({ status: ["concluido"] })
    expect(conta.pagamentos).toMatchObject([{ valor: 64.4, recebido: 100, troco: 35.6 }])
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

describe("ComandaMesa: avisos ao receber e dividir", () => {
  test("dinheiro: recebido menor que a parte avisa no campo e não deixa receber", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    await usuario.click(janelaReceber().getByRole("radio", { name: "Dinheiro" }))
    await usuario.type(janelaReceber().getByRole("textbox", { name: "Valor recebido" }), "50")
    expect(
      janelaReceber().getByText("O valor recebido é menor que o da parte."),
    ).toBeInTheDocument()
    expect(janelaReceber().getByRole("button", { name: nome("Receber R$ 64,40") })).toBeDisabled()
  })

  test("Pix acima do saldo avisa no campo e não deixa receber", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Fechar conta" }))
    await usuario.click(janelaReceber().getByRole("radio", { name: "Pix" }))
    const valor = janelaReceber().getByRole("textbox", { name: "Valor" })
    await usuario.clear(valor)
    await usuario.type(valor, "70")
    expect(janelaReceber().getByText("O valor passa do saldo de R$ 64,40.")).toBeInTheDocument()
    expect(janelaReceber().getByRole("button", { name: nome("Receber R$ 70,00") })).toBeDisabled()
  })

  test("partes fora de 2 a 20 avisam", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    const dividir = within(gaveta.getByRole("region", { name: "Dividir igualmente" }))
    const partes = dividir.getByRole("spinbutton", { name: "Partes" })
    await usuario.clear(partes)
    await usuario.type(partes, "25")
    expect(dividir.getByText("Divida de 2 a 20 partes.")).toBeInTheDocument()
    expect(dividir.queryByRole("button", { name: /^Receber/ })).not.toBeInTheDocument()
  })

  test("Por item não perde a seleção se a janela Receber for fechada sem receber", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    const porItem = within(gaveta.getByRole("region", { name: "Por item" }))
    await usuario.click(porItem.getByRole("checkbox", { name: /Pizza/ }))
    await usuario.click(porItem.getByRole("button", { name: nome("Receber R$ 44,00") }))
    await usuario.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Receber da mesa 70" })).not.toBeInTheDocument(),
    )
    expect(porItem.getByRole("checkbox", { name: /Pizza/ })).toBeChecked()
  })

  test("as partes já recebidas aparecem como recebidas", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.pagar(comanda.id, { forma: "pix", valor: 32.2 })
    const { gaveta } = await abrirConta()
    const dividir = within(gaveta.getByRole("region", { name: "Dividir igualmente" }))
    // R$ 64,40 em 2: uma parte de R$ 32,20 já entrou.
    expect(dividir.getByRole("button", { name: nome("Recebida R$ 32,20") })).toBeDisabled()
    expect(dividir.getByRole("button", { name: nome("Receber R$ 32,20") })).toBeEnabled()
  })
})

describe("ComandaMesa: por item com desconto", () => {
  test("com desconto na conta, Por item avisa e não deixa marcar", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.descontar(comanda.id, { modo: "reais", valor: 4, motivo: "Demora" })
    const { gaveta } = await abrirConta()
    const porItem = within(gaveta.getByRole("region", { name: "Por item" }))
    expect(
      porItem.getByText("Com desconto na conta, divida igualmente ou receba um valor."),
    ).toBeInTheDocument()
    expect(porItem.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(porItem.queryByRole("button", { name: /^Receber/ })).not.toBeInTheDocument()
  })
})

describe("ComandaMesa: desconto, cortesia, taxa, couvert e estorno", () => {
  const pergunta = (nome: string) => within(screen.getByRole("alertdialog", { name: nome }))

  test("Desconto em reais com motivo muda o total; acima dos itens, o erro do servidor aparece", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Desconto" }))
    const janela = pergunta("Desconto na conta da mesa 70")
    await usuario.type(janela.getByRole("textbox", { name: "Valor do desconto" }), "50")
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Demora")
    await usuario.click(janela.getByRole("button", { name: "Aplicar desconto" }))
    expect(await screen.findByText("O desconto passa do valor dos itens.")).toBeInTheDocument()

    await usuario.clear(janela.getByRole("textbox", { name: "Valor do desconto" }))
    await usuario.type(janela.getByRole("textbox", { name: "Valor do desconto" }), "4")
    await usuario.click(janela.getByRole("button", { name: "Aplicar desconto" }))
    // 44 − 4 = 40, mais 4,00 de taxa e 16 de couvert.
    await waitFor(() => expect(valorDe(gaveta, "Total")).toHaveTextContent("R$ 60,00"))
    expect(valorDe(gaveta, "Desconto")).toHaveTextContent("− R$ 4,00")
  })

  test("Tirar desconto pede motivo e devolve o total", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.descontar(comanda.id, { modo: "reais", valor: 4, motivo: "Demora" })
    const { usuario, gaveta } = await abrirConta()
    expect(valorDe(gaveta, "Total")).toHaveTextContent("R$ 60,00")
    await usuario.click(gaveta.getByRole("button", { name: "Tirar desconto" }))
    const janela = pergunta("Tirar o desconto?")
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Lançado errado")
    await usuario.click(janela.getByRole("button", { name: "Tirar desconto" }))
    await waitFor(() => expect(valorDe(gaveta, "Total")).toHaveTextContent("R$ 64,40"))
    expect(gaveta.queryByText("Desconto", { selector: "dt" })).not.toBeInTheDocument()
  })

  test("o desconto que zera o saldo de uma conta paga em parte fecha a conta", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.pagar(comanda.id, { forma: "pix", valor: 60 })
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Desconto" }))
    const janela = pergunta("Desconto na conta da mesa 70")
    await usuario.type(janela.getByRole("textbox", { name: "Valor do desconto" }), "4")
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Demora")
    await usuario.click(janela.getByRole("button", { name: "Aplicar desconto" }))
    expect(await screen.findByText("Conta da mesa 70 fechada.")).toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await cartao(70)).toHaveTextContent("Limpeza")
  })

  test("Cortesia no item, com motivo: o item mostra Cortesia e a conta desconta", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("tab", { name: "Itens" }))
    const agua = within(gaveta.getByRole("listitem", { name: "Água" }))
    await usuario.click(agua.getByRole("button", { name: "Cortesia" }))
    const janela = pergunta("Cortesia: Água")
    expect(janela.getByRole("button", { name: "Dar cortesia" })).toBeDisabled()
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Brinde da casa")
    await usuario.click(janela.getByRole("button", { name: "Dar cortesia" }))
    await waitFor(() =>
      expect(gaveta.getByRole("listitem", { name: "Água" })).toHaveTextContent("Cortesia"),
    )
    await usuario.click(gaveta.getByRole("tab", { name: "Conta" }))
    expect(valorDe(gaveta, "Cortesias")).toHaveTextContent("− R$ 4,00")
  })

  test("o item em cortesia ou já pago por item não tem Mais um", async () => {
    const { comanda } = await mesaComConta()
    const [pizza, agua] = (await api().pedidos.buscar(comanda.id))?.itens ?? []
    await api().mesas.darCortesia(comanda.id, agua.id, { motivo: "Brinde" })
    await api().mesas.pagar(comanda.id, { forma: "pix", itens: [pizza.id] })
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("tab", { name: "Itens" }))
    for (const nome of ["Pizza", "Água"]) {
      const item = within(gaveta.getByRole("listitem", { name: nome }))
      expect(item.queryByRole("button", { name: "Mais um" })).not.toBeInTheDocument()
      expect(item.getByRole("button", { name: "Menos um" })).toBeInTheDocument()
    }
  })

  test("Tirar taxa e Tirar couvert pedem motivo e saem do resumo", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Tirar taxa" }))
    const taxa = pergunta("Tirar a taxa de serviço?")
    await usuario.type(taxa.getByRole("textbox", { name: "Motivo" }), "Cliente reclamou")
    await usuario.click(taxa.getByRole("button", { name: "Tirar taxa" }))
    await waitFor(() => expect(gaveta.queryByText("Taxa de serviço (10%)")).not.toBeInTheDocument())

    await usuario.click(gaveta.getByRole("button", { name: "Tirar couvert" }))
    const couvert = pergunta("Tirar o couvert?")
    await usuario.type(couvert.getByRole("textbox", { name: "Motivo" }), "Sem música")
    await usuario.click(couvert.getByRole("button", { name: "Tirar couvert" }))
    await waitFor(() => expect(valorDe(gaveta, "Total")).toHaveTextContent("R$ 44,00"))
  })

  test("Estornar um pagamento pede motivo e devolve o saldo", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.pagar(comanda.id, { forma: "pix", valor: 10 })
    const { usuario, gaveta } = await abrirConta()
    const pagamento = within(await gaveta.findByRole("listitem", { name: /^Pix/ }))
    await usuario.click(pagamento.getByRole("button", { name: "Estornar" }))
    const janela = pergunta(nome("Estornar Pix de R$ 10,00?"))
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Não caiu")
    await usuario.click(janela.getByRole("button", { name: "Estornar" }))
    await waitFor(() => expect(valorDe(gaveta, "Saldo")).toHaveTextContent("R$ 64,40"))
    expect(gaveta.queryByRole("list", { name: "Pagamentos" })).not.toBeInTheDocument()
  })
})

describe("pré-conta e comprovante", () => {
  const agora = new Date(2026, 10, 13, 20, 30)
  const item = (id: string, nome: string, total: number, extra = {}) => ({
    id,
    produtoId: null,
    nome,
    quantidade: 1,
    precoUnitario: total,
    opcoes: [],
    total,
    ...extra,
  })
  /** Pizza R$ 40 e Água R$ 4 (cortesia), desconto R$ 4, 10% e couvert de R$ 8 para 2; R$ 20 em Pix. */
  const conta = pedidoDeTeste(9, agora, 0, {
    tipo: "mesa",
    cliente: { nome: "Júlia", telefone: "" },
    mesa: { id: "mesa-70", numero: 70, pessoas: 2 },
    itens: [item("i1", "Pizza", 40), item("i2", "Água", 4, { cortesia: { motivo: "Brinde" } })],
    descontoConta: { modo: "reais", valor: 4, motivo: "Demora" },
    taxaServico: { percentual: 10 },
    couvert: { porPessoa: 8 },
    pagamentos: [{ id: "p1", forma: "pix", valor: 20, em: agora.toISOString() }],
  })
  const mesa = { id: "mesa-70", numero: 70 } as Mesa

  test("a pré-conta tem itens, cortesia, desconto, taxa, couvert, total, pagamentos, saldo e por pessoa", () => {
    render(<PreConta pedido={conta} mesa={mesa} loja="Pizzaria Teste" agora={agora} />)
    const texto = document.body.textContent?.replace(/\u00a0/g, " ") ?? ""
    for (const trecho of [
      "Pizzaria Teste",
      "Mesa 70 · Júlia",
      "Pré-conta · 13/11/2026 20:30",
      "1× PizzaR$ 40,00",
      "1× Água (cortesia)R$ 0,00",
      "ItensR$ 44,00",
      "Cortesias− R$ 4,00",
      "Desconto− R$ 4,00",
      "Taxa de serviço (10%)R$ 3,60",
      "Couvert (2 × R$ 8,00)R$ 16,00",
      "TOTALR$ 55,60",
      "Pix 20:30R$ 20,00",
      "SaldoR$ 35,60",
      "Por pessoa (2)R$ 27,80",
      "Não é documento fiscal.",
    ]) {
      expect(texto).toContain(trecho)
    }
  })

  test("o comprovante tem a forma, o valor, o recebido, o troco e o saldo que ficou", () => {
    const comTroco = {
      ...conta,
      pagamentos: [
        ...(conta.pagamentos ?? []),
        {
          id: "p2",
          forma: "dinheiro" as const,
          valor: 10,
          recebido: 50,
          troco: 40,
          em: agora.toISOString(),
        },
      ],
    }
    render(
      <Comprovante
        pedido={comTroco}
        mesa={mesa}
        loja="Pizzaria Teste"
        pagamento={comTroco.pagamentos[1]}
      />,
    )
    const texto = document.body.textContent?.replace(/\u00a0/g, " ") ?? ""
    for (const trecho of [
      "Comprovante de pagamento",
      "Mesa 70",
      "13/11/2026 20:30",
      "DinheiroR$ 10,00",
      "RecebidoR$ 50,00",
      "TrocoR$ 40,00",
      "Saldo da contaR$ 25,60",
    ]) {
      expect(texto).toContain(trecho)
    }
  })

  test("o comprovante de um pagamento antigo mostra o saldo que ficou depois dele", () => {
    const comOutro = {
      ...conta,
      pagamentos: [
        ...(conta.pagamentos ?? []),
        { id: "p2", forma: "pix" as const, valor: 10, em: agora.toISOString() },
      ],
    }
    render(
      <Comprovante
        pedido={comOutro}
        mesa={mesa}
        loja="Pizzaria Teste"
        pagamento={comOutro.pagamentos[0]}
      />,
    )
    const texto = document.body.textContent?.replace(/ /g, " ") ?? ""
    // 55,60 − 20 (e não − 30, o saldo de agora).
    expect(texto).toContain("Saldo da contaR$ 35,60")
  })
})

describe("ComandaMesa: imprimir e reabrir", () => {
  test("Imprimir pré-conta imprime e a mesa fica em Pediu a conta", async () => {
    await mesaComConta()
    const { usuario, gaveta } = await abrirConta()
    await usuario.click(gaveta.getByRole("button", { name: "Imprimir pré-conta" }))
    expect(imprimir).toHaveBeenCalled()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(async () => expect(await cartao(70)).toHaveTextContent("Pediu a conta"))
  })

  test("Comprovante de um pagamento manda imprimir", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.pagar(comanda.id, { forma: "pix", valor: 10 })
    const { usuario, gaveta } = await abrirConta()
    const pagamento = within(await gaveta.findByRole("listitem", { name: /^Pix/ }))
    await usuario.click(pagamento.getByRole("button", { name: "Comprovante" }))
    await waitFor(() => expect(imprimir).toHaveBeenCalled())
  })

  test("a mesa em Limpeza com a conta fechada hoje oferece Reabrir a conta, com motivo", async () => {
    const { comanda } = await mesaComConta()
    await api().mesas.pagar(comanda.id, { forma: "pix", valor: 20 })
    await api().mesas.fecharConta(comanda.id, "dinheiro")
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
    await usuario.click(await gaveta.findByRole("button", { name: "Reabrir a conta" }))
    const janela = within(screen.getByRole("alertdialog", { name: "Reabrir a conta da mesa 70?" }))
    await usuario.type(janela.getByRole("textbox", { name: "Motivo" }), "Faltou a sobremesa")
    await usuario.click(janela.getByRole("button", { name: "Reabrir" }))

    expect(await screen.findByText("Conta da mesa 70 reaberta.")).toBeInTheDocument()
    await usuario.click(await gaveta.findByRole("tab", { name: "Conta" }))
    const pagamentos = within(await gaveta.findByRole("list", { name: "Pagamentos" }))
    expect(pagamentos.getAllByRole("listitem")).toHaveLength(2)
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await cartao(70)).not.toHaveTextContent("Limpeza")
  })
})
