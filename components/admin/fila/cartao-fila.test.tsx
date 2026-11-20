import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { CartaoFila } from "./cartao-fila"

const TEMPOS = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }

/** Entrega em preparo que chegou às 20:00; agora são 20:30. */
const PEDIDO: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  tipo: "entrega",
  status: "em-preparo",
  criadoEm: new Date(2026, 10, 13, 20, 0).toISOString(),
}

function renderizar(
  pedido: Pedido,
  agora = AGORA,
  seloCliente: string | null = null,
  compacto = false,
  maioridade = false,
  naCozinha = false,
) {
  const nada = () => {}
  return render(
    <TooltipProvider>
      <CartaoFila
        pedido={pedido}
        agora={agora}
        tempos={TEMPOS}
        seloCliente={seloCliente}
        nomeLoja="Casa da Pizza"
        compacto={compacto}
        maioridade={maioridade}
        naCozinha={naCozinha}
        motoboys={[]}
        novo={false}
        ocupado={false}
        limiteAceiteMin={5}
        aoAceitar={nada}
        aoRecusar={nada}
        aoCancelar={nada}
        aoAvancar={nada}
        aoAbrir={nada}
        aoImprimir={nada}
      />
    </TooltipProvider>,
  )
}

describe("CartaoFila: prazo prometido", () => {
  test("mostra até quando entregar e quanto falta", () => {
    renderizar(PEDIDO)
    expect(screen.getByText("até 21:00 · 30 min")).toBeInTheDocument()
    expect(screen.getByText("Entregar até 21:00, faltam 30 min")).toBeInTheDocument()
  })

  test("passou do prazo: mostra quanto atrasou", () => {
    renderizar(PEDIDO, new Date(2026, 10, 13, 21, 12))
    expect(screen.getByText("até 21:00 · +12 min")).toBeInTheDocument()
  })
})

describe("CartaoFila: o pedido de relance", () => {
  test("mostra quantos itens, o total e de onde veio", () => {
    renderizar({
      ...PEDIDO,
      origem: "garcom",
      total: 52,
      itens: [{ ...PEDIDO.itens[0], quantidade: 3 }],
    })
    expect(screen.getByText("3 itens · R$ 52,00")).toBeInTheDocument()
    expect(screen.getByText("Garçom")).toBeInTheDocument()
  })
})

describe("CartaoFila: o cliente", () => {
  test("mostra o selo de cliente novo", () => {
    renderizar(PEDIDO, AGORA, "1º pedido")
    expect(screen.getByText("1º pedido")).toBeInTheDocument()
  })
})

describe("CartaoFila: avisar o cliente", () => {
  test("o WhatsApp abre a conversa do cliente com a mensagem da etapa", () => {
    renderizar({ ...PEDIDO, numero: 1412, cliente: { nome: "Ana Lima", telefone: "12991230000" } })
    const link = screen.getByRole("link", { name: "Avisar #1412 no WhatsApp" })
    const href = link.getAttribute("href") ?? ""
    expect(href.startsWith("https://wa.me/5512991230000?text=")).toBe(true)
    const texto = decodeURIComponent(href.split("text=")[1])
    expect(texto).toContain("Olá, Ana! Seu pedido #1412 na Casa da Pizza")
    expect(link).toHaveAttribute("target", "_blank")
  })
})

describe("CartaoFila: compacto", () => {
  test("uma linha com número, cliente e prazo; tocar abre o cartão inteiro", async () => {
    const usuario = userEvent.setup()
    const pedido = {
      ...PEDIDO,
      numero: 1412,
      cliente: { nome: "Ana Lima", telefone: "12991230000" },
    }
    renderizar(pedido, AGORA, null, true)
    const linha = screen.getByRole("button", { name: /^#1412/ })
    expect(linha).toHaveAttribute("aria-expanded", "false")
    expect(linha).toHaveTextContent("Ana Lima")
    expect(linha).toHaveTextContent("até 21:00 · 30 min")
    expect(screen.queryByRole("button", { name: "Marcar como pronto" })).not.toBeInTheDocument()

    await usuario.click(linha)
    expect(screen.getByRole("button", { name: "Marcar como pronto" })).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Recolher #1412" }))
    expect(screen.queryByRole("button", { name: "Marcar como pronto" })).not.toBeInTheDocument()
  })
})

describe("CartaoFila: adega", () => {
  test("pedido com bebida alcoólica avisa para conferir o documento", () => {
    renderizar(PEDIDO, AGORA, null, false, true)
    expect(screen.getByText("+18: conferir documento")).toBeInTheDocument()
  })
})

describe("CartaoFila: cozinha", () => {
  test("o pedido na tela da cozinha leva o selo Na cozinha", () => {
    renderizar(PEDIDO, AGORA, null, false, false, true)
    expect(screen.getByText("Na cozinha")).toBeInTheDocument()
  })
})

describe("CartaoFila: açougue", () => {
  const PICANHA = {
    id: "p1",
    produtoId: "picanha",
    nome: "Picanha",
    quantidade: 1,
    precoUnitario: 60,
    opcoes: [],
    total: 60,
    pesoGramas: 1000,
    precoKg: 60,
  }

  function comPesagem(pedido: Pedido, aoPesar: () => void) {
    const nada = () => {}
    return render(
      <TooltipProvider>
        <CartaoFila
          pedido={pedido}
          agora={AGORA}
          tempos={TEMPOS}
          motoboys={[]}
          novo={false}
          ocupado={false}
          limiteAceiteMin={5}
          aoAceitar={nada}
          aoRecusar={nada}
          aoCancelar={nada}
          aoAvancar={nada}
          aoPesar={aoPesar}
          aoAbrir={nada}
          aoImprimir={nada}
        />
      </TooltipProvider>,
    )
  }

  test("em preparo com carne por quilo sem pesar: o botão é Pesar, não Marcar como pronto", async () => {
    const aoPesar = vi.fn()
    comPesagem({ ...PEDIDO, tipo: "retirada", itens: [PICANHA] }, aoPesar)
    expect(screen.queryByRole("button", { name: "Marcar como pronto" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Pesar" }))
    expect(aoPesar).toHaveBeenCalled()
  })

  test("pesado, volta o Marcar como pronto", () => {
    comPesagem(
      {
        ...PEDIDO,
        tipo: "retirada",
        itens: [{ ...PICANHA, pesoReal: 1000 }],
        pesagem: { totalEstimado: 60, diferenca: 0, pesadoEm: AGORA.toISOString() },
      },
      vi.fn(),
    )
    expect(screen.getByRole("button", { name: "Marcar como pronto" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pesar" })).not.toBeInTheDocument()
  })
})
