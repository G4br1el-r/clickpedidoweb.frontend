import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { type Pedido, useSacola } from "@/lib/sacola"
import { Acompanhamento } from "./acompanhamento"

const { empurrar } = vi.hoisted(() => ({ empurrar: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: empurrar, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pedido",
}))
// A animação Lottie do entregador carrega WASM, que não existe no jsdom.
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => null,
  setWasmUrl: () => {},
}))

const pedido: Pedido = {
  numero: 2234,
  itens: [
    {
      chave: "amoxicilina-500",
      produtoId: "amoxicilina-500",
      nome: "Amoxicilina 500 mg",
      imagem: {
        src: "/a.jpg",
        width: 1,
        height: 1,
        blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      },
      precoUnitario: 27.9,
      quantidade: 1,
      resumo: [],
      venda: "receita-retida",
    },
  ],
  subtotal: 27.9,
  taxaEntrega: 5,
  total: 32.9,
  criadoEm: Date.now(),
  cliente: { nome: "Ana", whatsapp: "(12) 99876-5432" },
  tipo: "entrega",
  endereco: "Rua A, 1 - Vila Adyana",
  pagamento: "dinheiro",
  troco: null,
  receita: { arquivo: "receita.jpg", retida: true },
}

beforeEach(() => {
  useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
  useSacola.setState(
    { ...useSacola.getInitialState(), hidratada: true, ultimoPedido: pedido },
    true,
  )
})

describe("Acompanhamento na farmácia", () => {
  test("mostra que a receita foi enviada e lembra da via original", () => {
    render(
      <TooltipProvider>
        <Acompanhamento />
      </TooltipProvider>,
    )
    expect(screen.getByText("Receita enviada")).toBeInTheDocument()
    expect(
      screen.getByText("receita.jpg · tenha a via original em mãos para o entregador"),
    ).toBeInTheDocument()
  })
})

// Horário de Brasília (vitest.config.mts). Casa da Pizza: entrega "35–50 min".
// Pedido em dinheiro: as etapas começam 0, 6, 16 e 28 s depois do pedido.
const CRIADO = new Date("2026-11-08T21:00:00-03:00").getTime()

function abrirNaPizzaria(mudancas: Partial<Pedido>, segundosDepois: number) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(CRIADO + segundosDepois * 1000)
  useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
  useSacola.setState({
    ultimoPedido: { ...pedido, receita: undefined, criadoEm: CRIADO, ...mudancas },
  })
  render(
    <TooltipProvider>
      <Acompanhamento />
    </TooltipProvider>,
  )
}

describe("Acompanhamento", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test("Pedir de novo devolve todos os itens do pedido à sacola e leva ao cardápio", async () => {
    empurrar.mockClear()
    abrirNaPizzaria({}, 10)
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await usuario.click(screen.getByRole("button", { name: "Pedir de novo" }))

    expect(useSacola.getState().itens.map(({ produtoId }) => produtoId)).toEqual([
      "amoxicilina-500",
    ])
    expect(empurrar).toHaveBeenCalledWith("/")
  })

  test("a régua mostra a previsão em números, separada do rótulo", () => {
    abrirNaPizzaria({}, 10)
    expect(screen.getByText("Previsão")).toBeInTheDocument()
    expect(screen.getByText("21:35 – 21:50")).toBeInTheDocument()
  })

  test("enquanto a loja prepara, o carregador do nicho acompanha a frase da etapa", () => {
    abrirNaPizzaria({}, 10)
    expect(screen.getByRole("heading", { level: 1, name: "Em preparo" })).toBeInTheDocument()
    const frase = screen.getByText("Sua pizza está no forno a lenha.")
    expect(frase.closest("p")?.querySelector("[data-testid=carregador-pizzaria]")).not.toBeNull()
  })

  test("na linha do tempo, as feitas têm a hora e a ativa diz agora", () => {
    abrirNaPizzaria({}, 10)
    const linha = screen.getByRole("list", { name: "Andamento do pedido" })
    const etapas = within(linha).getAllByRole("listitem")
    expect(etapas[0]).toHaveTextContent("Pedido recebido (concluído)21:00")
    expect(etapas[1]).toHaveAttribute("aria-current", "step")
    expect(etapas[1]).toHaveTextContent("Em preparoagora")
    expect(etapas[2]).toHaveTextContent(/^Saiu para entrega$/)
  })

  test("saiu para entrega, a espera é o entregador a caminho", () => {
    abrirNaPizzaria({}, 20)
    expect(screen.getByRole("heading", { level: 1, name: "Saiu para entrega" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Entregador de moto a caminho" })).toBeInTheDocument()
    expect(screen.queryByTestId("carregador-pizzaria")).not.toBeInTheDocument()
  })

  test("pronto para retirar, a loja não está mais preparando: sem carregador", () => {
    abrirNaPizzaria({ tipo: "retirada" }, 20)
    expect(
      screen.getByRole("heading", { level: 1, name: "Pronto para retirar" }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("carregador-pizzaria")).not.toBeInTheDocument()
  })

  test("concluído, diz a hora em que chegou e para de esperar", () => {
    abrirNaPizzaria({}, 120)
    expect(screen.getByRole("heading", { level: 1, name: "Entregue" })).toBeInTheDocument()
    expect(screen.getByText("Entregue às")).toBeInTheDocument()
    expect(screen.queryByTestId("carregador-pizzaria")).not.toBeInTheDocument()
  })

  test("no Pix sem pagar, mostra o QR Code e copia o código", async () => {
    abrirNaPizzaria({ pagamento: "pix" }, 3)
    // O user-event põe uma área de transferência de mentira no navegador.
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    expect(screen.getByRole("heading", { level: 1, name: "Aguardando o Pix" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "QR Code do Pix" })).toBeInTheDocument()
    // Nenhuma etapa começou: a linha do tempo ainda não tem etapa atual.
    expect(
      within(screen.getByRole("list", { name: "Andamento do pedido" })).queryAllByRole("listitem", {
        current: "step",
      }),
    ).toHaveLength(0)

    await usuario.click(screen.getByRole("button", { name: "Copiar código Pix" }))

    expect(await navigator.clipboard.readText()).toContain("demo-clickpedido-2234")
    expect(await screen.findByText("Código copiado")).toBeInTheDocument()
  })
})

describe("Acompanhamento sem pedido", () => {
  test("mostra a arte do nicho e os caminhos: o cardápio ou a busca pelo celular", () => {
    useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
    useSacola.setState({ ultimoPedido: null })
    render(
      <TooltipProvider>
        <Acompanhamento />
      </TooltipProvider>,
    )
    expect(screen.getByRole("heading", { level: 1, name: "Nenhum pedido por aqui" })).toBeVisible()
    expect(screen.getByTestId("carregador-pizzaria")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver cardápio" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Buscar pelo celular" })).toHaveAttribute(
      "href",
      "/pedidos",
    )
  })
})
