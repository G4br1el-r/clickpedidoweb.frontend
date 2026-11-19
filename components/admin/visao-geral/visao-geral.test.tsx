import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { resumir } from "@/lib/admin/regras/dashboard/resumo"
import {
  AGORA_DE_TESTE,
  PEDIDOS_DE_TESTE,
  PERIODO_DE_TESTE,
} from "@/lib/admin/regras/pedidos-de-teste"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { FiltroPeriodo } from "./filtro-periodo"
import { AbaFinanceiro, AbaResumo, AbaVendas } from "./painel-visao-geral"
import { VisaoGeral } from "./visao-geral"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

function Provedores({
  children,
  onUrlUpdate,
  endereco,
}: {
  children: ReactNode
  onUrlUpdate?: OnUrlUpdateFunction
  endereco?: string
}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} searchParams={endereco}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const RESUMO = resumir(PEDIDOS_DE_TESTE, PERIODO_DE_TESTE, AGORA_DE_TESTE)
const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("abas do painel", () => {
  test("mostra o movimento de hoje", () => {
    render(<AbaResumo resumo={RESUMO} periodo={PERIODO_DE_TESTE} segmento="pizzaria" />, {
      wrapper: Provedores,
    })
    const hoje = regiao("Hoje")
    expect(hoje.getByText("Faturamento hoje").closest("[data-indicador]")).toHaveTextContent(
      "R$ 90,00",
    )
    expect(hoje.getByText("Pedidos hoje").closest("[data-indicador]")).toHaveTextContent("2")
    expect(hoje.getByText("Ticket médio hoje").closest("[data-indicador]")).toHaveTextContent(
      "R$ 45,00",
    )
    expect(hoje.getByText("Em andamento").closest("[data-indicador]")).toHaveTextContent("1")
    expect(hoje.getByText("1 aguardando pagamento online")).toBeInTheDocument()
  })

  test("mostra os indicadores do período, com a variação e o melhor dia", () => {
    render(<AbaResumo resumo={RESUMO} periodo={PERIODO_DE_TESTE} segmento="pizzaria" />, {
      wrapper: Provedores,
    })
    const periodo = regiao("Desempenho do período")
    const faturamento = periodo.getByText("Faturamento").closest("[data-indicador]")
    expect(faturamento).toHaveTextContent("R$ 170,00")
    expect(faturamento).toHaveTextContent("+6,3% sobre os 2 dias anteriores")
    expect(periodo.getByText("Ticket médio").closest("[data-indicador]")).toHaveTextContent(
      "R$ 42,50",
    )
    expect(periodo.getByText("Melhor dia").closest("[data-indicador]")).toHaveTextContent(
      "sexta-feira, 13/11R$ 90,00 em 2 pedidos",
    )
  })

  test("o Resumo mostra mais vendidos e recentes, sem pagamentos nem canais", () => {
    render(<AbaResumo resumo={RESUMO} periodo={PERIODO_DE_TESTE} segmento="pizzaria" />, {
      wrapper: Provedores,
    })
    expect(regiao("Mais vendidos").getAllByRole("listitem")[0]).toHaveTextContent("Coca4 vendidos")
    expect(regiao("Pedidos recentes").getAllByRole("row")[1]).toHaveTextContent("#6")
    expect(screen.queryByRole("region", { name: "Formas de pagamento" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Canais de venda" })).not.toBeInTheDocument()
  })

  test("Vendas mostra os canais; Financeiro, as formas de pagamento", () => {
    const { unmount } = render(<AbaVendas resumo={RESUMO} segmento="pizzaria" />, {
      wrapper: Provedores,
    })
    expect(regiao("Canais de venda").getAllByRole("listitem")[0]).toHaveTextContent("Entrega")
    unmount()

    render(<AbaFinanceiro resumo={RESUMO} />, { wrapper: Provedores })
    expect(regiao("Formas de pagamento").getAllByRole("listitem")[0]).toHaveTextContent(
      "Dinheiro2 pedidosR$ 100,0059%",
    )
  })

  test("no salão, os pedidos são atendimentos", () => {
    render(<AbaResumo resumo={RESUMO} periodo={PERIODO_DE_TESTE} segmento="salao" />, {
      wrapper: Provedores,
    })
    expect(regiao("Hoje").getByText("Atendimentos hoje")).toBeInTheDocument()
  })
})

describe("FiltroPeriodo", () => {
  test("um atalho troca o período no endereço", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    render(
      <Provedores onUrlUpdate={aoMudar}>
        <FiltroPeriodo />
      </Provedores>,
    )
    expect(screen.getByRole("radio", { name: "7 dias" })).toBeChecked()

    await usuario.click(screen.getByRole("radio", { name: "Hoje" }))

    const ultima = aoMudar.mock.lastCall?.[0]
    expect(ultima?.searchParams.get("de")).toBe("2026-11-13")
    expect(ultima?.searchParams.get("ate")).toBe("2026-11-13")
  })
})

describe("VisaoGeral", () => {
  test("mostra o esqueleto e depois os números da loja", async () => {
    render(<VisaoGeral />, { wrapper: Provedores })
    expect(screen.getByRole("status", { name: "Carregando a visão geral" })).toBeInTheDocument()
    // Na primeira vez, o servidor de demonstração gera 90 dias de pedidos.
    expect(
      await screen.findByRole("region", { name: "Hoje" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("status", { name: "Carregando a visão geral" }),
    ).not.toBeInTheDocument()
  })

  test("a aba vem do endereço, e trocar de aba muda o endereço", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    render(
      <Provedores endereco="?aba=financeiro" onUrlUpdate={aoMudar}>
        <VisaoGeral />
      </Provedores>,
    )

    const abas = screen.getByRole("tablist", { name: "Abas da visão geral" })
    expect(
      within(abas)
        .getAllByRole("tab")
        .map((aba) => aba.textContent),
    ).toEqual(["Resumo", "Vendas", "Financeiro"])
    expect(within(abas).getByRole("tab", { name: "Financeiro" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(
      await screen.findByRole("region", { name: "Formas de pagamento" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Hoje" })).not.toBeInTheDocument()

    await usuario.click(within(abas).getByRole("tab", { name: "Vendas" }))

    expect(aoMudar.mock.lastCall?.[0].searchParams.get("aba")).toBe("vendas")
    expect(await screen.findByRole("region", { name: "Canais de venda" })).toBeInTheDocument()
  })
})
