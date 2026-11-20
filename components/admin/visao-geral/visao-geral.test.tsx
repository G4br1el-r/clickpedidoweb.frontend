import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useMetas } from "@/lib/admin/metas"
import { resumir } from "@/lib/admin/regras/dashboard/resumo"
import {
  AGORA_DE_TESTE,
  PEDIDOS_DE_TESTE,
  PERIODO_DE_TESTE,
} from "@/lib/admin/regras/pedidos-de-teste"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { FiltroPeriodo } from "./filtro-periodo"
import { AbaResumo } from "./painel-visao-geral"
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

/** O Resumo com os dados de teste; cada teste muda só o que importa para ele. */
function renderizarResumo(mudancas: Partial<ComponentProps<typeof AbaResumo>> = {}) {
  return render(
    <AbaResumo resumo={RESUMO} periodo={PERIODO_DE_TESTE} segmento="pizzaria" {...mudancas} />,
    { wrapper: Provedores },
  )
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useMetas.setState(useMetas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("abas do painel", () => {
  test("mostra o movimento de hoje", () => {
    renderizarResumo()
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

  test("cada número de hoje se compara com o mesmo dia da semana passada", () => {
    renderizarResumo({
      comparacao: {
        dia: new Date(2026, 10, 6),
        variacao: { pedidos: 100, faturamento: 50, ticket: -25 },
      },
    })
    const hoje = regiao("Hoje")
    expect(hoje.getByText("Pedidos hoje").closest("[data-indicador]")).toHaveTextContent(
      "+100% vs sexta passada",
    )
    expect(hoje.getByText("Faturamento hoje").closest("[data-indicador]")).toHaveTextContent(
      "+50% vs sexta passada",
    )
    expect(hoje.getByText("Ticket médio hoje").closest("[data-indicador]")).toHaveTextContent(
      "-25% vs sexta passada",
    )
  })

  test("a faixa de atenção lista cada alerta com o caminho para resolver", () => {
    renderizarResumo({
      alertas: [
        {
          id: "atrasados",
          texto: "2 pedidos atrasados",
          acao: { rotulo: "Abrir a fila", href: "/admin/fila" },
        },
        {
          id: "estoque-baixo",
          texto: "1 produto com estoque baixo",
          acao: { rotulo: "Ver estoque", href: "/admin/estoque" },
        },
      ],
    })
    const faixa = regiao("Precisa de atenção")
    const itens = faixa.getAllByRole("listitem")
    expect(itens.map((item) => item.textContent)).toEqual([
      "2 pedidos atrasadosAbrir a fila",
      "1 produto com estoque baixoVer estoque",
    ])
    expect(within(itens[0]).getByRole("link", { name: "Abrir a fila" })).toHaveAttribute(
      "href",
      "/admin/fila",
    )
  })

  test("o bloco do segmento mostra cada número com o caminho para ver mais", () => {
    renderizarResumo({
      destaques: [
        {
          id: "mesas",
          rotulo: "Mesas ocupadas",
          valor: 2,
          detalhe: "De 3 mesas",
          href: "/admin/mesas",
        },
      ],
    })
    const bloco = regiao("Agora na loja")
    const mesas = bloco.getByText("Mesas ocupadas").closest("[data-indicador]")
    expect(mesas).toHaveTextContent("2De 3 mesas")
    expect(within(mesas as HTMLElement).getByRole("link", { name: "De 3 mesas" })).toHaveAttribute(
      "href",
      "/admin/mesas",
    )
  })

  test("no Resumo, os mais vendidos param nos 5 primeiros", () => {
    const oito = Array.from({ length: 8 }, (_, indice) => ({
      nome: `Produto ${indice + 1}`,
      quantidade: 10 - indice,
      total: 100,
    }))
    renderizarResumo({ resumo: { ...RESUMO, maisVendidos: { periodo: oito, hoje: oito } } })
    const lista = regiao("Mais vendidos").getAllByRole("listitem")
    expect(lista).toHaveLength(5)
    expect(lista.at(-1)).toHaveTextContent("Produto 5")
  })

  test("sem destaques do segmento, o bloco não aparece", () => {
    renderizarResumo({ destaques: [] })
    expect(screen.queryByRole("region", { name: "Agora na loja" })).not.toBeInTheDocument()
  })

  test("sem alertas, a faixa não aparece", () => {
    renderizarResumo({ alertas: [] })
    expect(screen.queryByRole("region", { name: "Precisa de atenção" })).not.toBeInTheDocument()
  })

  test("sem venda no mesmo dia da semana passada, avisa que não há base", () => {
    renderizarResumo({ comparacao: { dia: new Date(2026, 10, 6), variacao: null } })
    expect(
      regiao("Hoje").getByText("Faturamento hoje").closest("[data-indicador]"),
    ).toHaveTextContent("Sem base na sexta passada")
  })

  test("mostra os indicadores do período, com a variação e o melhor dia", () => {
    renderizarResumo()
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
    renderizarResumo()
    expect(regiao("Mais vendidos").getAllByRole("listitem")[0]).toHaveTextContent("Coca4 vendidos")
    expect(regiao("Pedidos recentes").getAllByRole("row")[1]).toHaveTextContent("#6")
    expect(screen.queryByRole("region", { name: "Formas de pagamento" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Canais de venda" })).not.toBeInTheDocument()
  })

  test("no salão, os pedidos são atendimentos", () => {
    renderizarResumo({ segmento: "salao" })
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

  test("no Resumo, hoje vem comparado com a sexta passada, mesmo no período de hoje", async () => {
    render(
      <Provedores endereco="?de=2026-11-13&ate=2026-11-13">
        <VisaoGeral />
      </Provedores>,
    )
    const hoje = within(await screen.findByRole("region", { name: "Hoje" }, { timeout: 8000 }))
    expect(hoje.getByText("Faturamento hoje").closest("[data-indicador]")).toHaveTextContent(
      /sexta passada/,
    )
  })

  test("no Resumo, a faixa de atenção avisa do estoque da loja", async () => {
    render(<VisaoGeral />, { wrapper: Provedores })
    const faixa = within(
      await screen.findByRole("region", { name: "Precisa de atenção" }, { timeout: 8000 }),
    )
    expect(faixa.getAllByRole("link", { name: "Ver estoque" }).length).toBeGreaterThan(0)
  })

  test("no Resumo, a meta do segmento aparece calculada com os pedidos do mês", async () => {
    useMetas.getState().definir("pizzaria", { faturamento: 60_000, pedidos: null })
    render(<VisaoGeral />, { wrapper: Provedores })

    const meta = within(
      await screen.findByRole("region", { name: "Meta do mês" }, { timeout: 8000 }),
    )
    expect(meta.getByText("Vendido no mês").closest("[data-indicador]")).toHaveTextContent(
      "de R$ 60.000,00",
    )
  })

  test("no Resumo da pizzaria, o bloco do segmento mostra as mesas", async () => {
    render(<VisaoGeral />, { wrapper: Provedores })
    const bloco = within(
      await screen.findByRole("region", { name: "Agora na loja" }, { timeout: 8000 }),
    )
    expect(bloco.getByText("Mesas ocupadas")).toBeInTheDocument()
  })

  test("o Resumo se atualiza sozinho a cada 30 segundos", async () => {
    // Só o relógio e os intervalos são falsos: as esperas da Testing Library seguem de verdade.
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(AGORA_DE_TESTE)
    render(<VisaoGeral />, { wrapper: Provedores })
    await screen.findByRole("region", { name: "Pedidos recentes" }, { timeout: 8000 })

    const novo = await servidorDo("pizzaria").pedidos.simular()
    const primeiraLinha = () => regiao("Pedidos recentes").getAllByRole("row")[1]
    expect(primeiraLinha()).not.toHaveTextContent(`#${novo.numero}`)

    await vi.advanceTimersByTimeAsync(30_000)

    await waitFor(() => expect(primeiraLinha()).toHaveTextContent(`#${novo.numero}`))
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
    ).toEqual(["Resumo", "Vendas", "Produtos", "Financeiro"])
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

  test("a aba Produtos mostra os produtos da loja: ranking e o cardápio parado", async () => {
    render(
      <Provedores endereco="?aba=produtos">
        <VisaoGeral />
      </Provedores>,
    )
    expect(
      await screen.findByRole("region", { name: "Mais vendidos" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Por categoria" })).getAllByRole("listitem").length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole("region", { name: "Sem venda no período" })).toBeInTheDocument()
  })
})
