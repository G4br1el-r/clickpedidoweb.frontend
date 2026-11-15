import { act, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { type Pedido, useSacola } from "@/lib/sacola"
import { ConversaSimulada } from "./conversa-simulada"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/whatsapp",
}))

const imagem = { src: "/a.jpg", width: 1, height: 1 }

/** 19:42 de 14/11/2026. */
const AGORA = new Date("2026-11-14T19:42:00-03:00")

const pedido: Pedido = {
  numero: 4821,
  itens: [
    {
      chave: "meio-a-meio",
      produtoId: "meio-a-meio",
      nome: "Pizza meio a meio",
      imagem,
      precoUnitario: 73,
      quantidade: 1,
      resumo: ["½ Calabresa", "½ Pepperoni"],
      observacao: "Bem assada",
    },
    {
      chave: "refrigerante-cola",
      produtoId: "refrigerante-cola",
      nome: "Refrigerante de cola 2L",
      imagem,
      precoUnitario: 14,
      quantidade: 2,
      resumo: [],
    },
  ],
  subtotal: 101,
  taxaEntrega: 6,
  total: 107,
  criadoEm: AGORA.getTime(),
  tipo: "entrega",
  endereco: "Rua das Palmeiras, 120 - Centro",
}

function mostrar() {
  return render(
    <TooltipProvider>
      <ConversaSimulada />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
  useSacola.setState(
    { ...useSacola.getInitialState(), hidratada: true, ultimoPedido: pedido },
    true,
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ConversaSimulada", () => {
  test("sem pedido, leva de volta ao cardápio", () => {
    useSacola.setState({ ultimoPedido: null })
    mostrar()
    expect(screen.getByText("Nenhum pedido por aqui")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver cardápio" })).toHaveAttribute("href", "/")
  })

  test("o pedido vai como mensagem da pessoa, com o valor de cada item, a entrega e o total", () => {
    mostrar()
    const resumo = screen.getByRole("article", { name: "Seu pedido" })
    expect(within(resumo).getByText("Olá! Quero fazer este pedido:")).toBeInTheDocument()
    expect(within(resumo).getByText("1× Pizza meio a meio")).toBeInTheDocument()
    expect(within(resumo).getByText("½ Calabresa · ½ Pepperoni")).toBeInTheDocument()
    expect(within(resumo).getByText("Observação: Bem assada")).toBeInTheDocument()
    expect(within(resumo).getByText("R$ 73,00")).toBeInTheDocument()
    expect(within(resumo).getByText("2× Refrigerante de cola 2L")).toBeInTheDocument()
    expect(within(resumo).getByText("R$ 28,00")).toBeInTheDocument()
    expect(within(resumo).getByText("Entrega").closest("p")).toHaveTextContent("Entrega R$ 6,00")
    expect(within(resumo).getByText("Rua das Palmeiras, 120 - Centro")).toBeInTheDocument()
    // O rótulo lido em voz alta é "Total: R$ 107,00"; na tela, o traço da loja faz a pausa.
    expect(within(resumo).getByText("Total").closest("p")).toHaveTextContent("Total: R$ 107,00")
    expect(within(resumo).getByText("19:42")).toBeInTheDocument()
  })

  test("na retirada, o resumo diz que é no balcão, sem taxa", () => {
    useSacola.setState({ ultimoPedido: { ...pedido, tipo: "retirada", taxaEntrega: 0 } })
    mostrar()
    const resumo = screen.getByRole("article", { name: "Seu pedido" })
    expect(within(resumo).getByText("Retirada no balcão")).toBeInTheDocument()
    expect(within(resumo).queryByText("Entrega")).not.toBeInTheDocument()
    expect(within(resumo).queryByText("Rua das Palmeiras, 120 - Centro")).not.toBeInTheDocument()
  })

  describe("no tempo", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(AGORA)
      vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    })

    function passar(ms: number) {
      act(() => {
        vi.advanceTimersByTime(ms)
      })
    }

    test("a loja lê o pedido: a confirmação passa de enviada a lida", () => {
      mostrar()
      const resumo = screen.getByRole("article", { name: "Seu pedido" })
      expect(within(resumo).getByRole("img", { name: "Enviada" })).toBeInTheDocument()
      passar(500)
      expect(within(resumo).getByRole("img", { name: "Lida" })).toBeInTheDocument()
    })

    test("a loja digita antes de responder, e o topo mostra que ela está digitando", () => {
      mostrar()
      const topo = screen.getByTestId("topo-conversa")
      expect(within(topo).getByText("online")).toBeInTheDocument()
      expect(screen.queryByRole("status", { name: "Casa da Pizza está digitando" })).toBeNull()

      passar(900)
      expect(
        screen.getByRole("status", { name: "Casa da Pizza está digitando" }),
      ).toBeInTheDocument()
      expect(within(topo).getByText("digitando…")).toBeInTheDocument()
      expect(screen.queryByText(/Recebemos seu pedido/)).toBeNull()
    })

    test("as respostas chegam uma a uma, com a hora, e no fim aparece o novo pedido", () => {
      mostrar()
      expect(screen.queryByRole("link", { name: "Fazer novo pedido" })).toBeNull()
      passar(10_000)

      const conversa = screen.getByRole("log", { name: "Conversa com a loja" })
      const resposta = within(conversa).getByText(
        "Recebemos seu pedido nº 4821. Obrigado por escolher a Casa da Pizza!",
      )
      expect(resposta.closest("article")).toHaveTextContent("19:43")
      expect(
        within(conversa).getByText("Sua pizza já está indo para o forno a lenha."),
      ).toBeInTheDocument()
      expect(within(conversa).getByText(/A previsão de entrega é de 35–50 min/)).toBeInTheDocument()
      expect(screen.queryByRole("status", { name: "Casa da Pizza está digitando" })).toBeNull()
      expect(within(screen.getByTestId("topo-conversa")).getByText("online")).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Fazer novo pedido" })).toHaveAttribute("href", "/")
    })

    test("a tela rola junto quando a loja começa a digitar e quando a resposta chega", () => {
      mostrar()
      expect(window.scrollTo).not.toHaveBeenCalled()
      passar(900)
      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }))
    })
  })

  test("enquanto o pedido salvo não chega, espera com o carregador do nicho", () => {
    useSacola.setState({ hidratada: false, ultimoPedido: null })
    mostrar()
    const espera = screen.getByRole("status", { name: "Abrindo a conversa" })
    expect(within(espera).getByTestId("carregador-pizzaria")).toBeInTheDocument()
    expect(screen.queryByText("Nenhum pedido por aqui")).not.toBeInTheDocument()
  })
})
