import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { type Pedido, useSacola } from "@/lib/sacola"
import { Acompanhamento } from "./acompanhamento"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pedido",
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
