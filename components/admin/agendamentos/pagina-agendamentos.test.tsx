import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaAgendamentos } from "./pagina-agendamentos"

// Impressora: a fronteira com o navegador. O teste confere só que o comprovante foi mandado.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

function Provedores({ children, endereco }: { children: ReactNode; endereco: string }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter searchParams={endereco} hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const api = () => servidorDo("salao")

/** Terça, 1/12/2026: longe dos atendimentos gerados para a demonstração. */
const terca = (hora: number, minuto = 0) => new Date(2026, 11, 1, hora, minuto).toISOString()

async function marcar(nome: string, inicio: string) {
  const [servico] = (await api().produtos.listar()).filter(
    (produto) => produto.disponivel && produto.duracaoMin === 60,
  )
  return api().agendamentos.criar({
    cliente: { nome, telefone: "12991110000" },
    servicos: [servico.id],
    inicio,
    pagamento: "pix",
  })
}

async function abrir(endereco = "?dia=2026-12-01") {
  telaGrande()
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={endereco}>
      <PaginaAgendamentos />
    </Provedores>,
  )
  await screen.findByRole("region", { name: "Agenda do dia" }, { timeout: 8000 })
  return usuario
}

const dia = () => within(screen.getByRole("region", { name: "Agenda do dia" }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "salao" }, true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PaginaAgendamentos", () => {
  test("o dia mostra cada atendimento na hora certa, lado a lado quando se cruzam", async () => {
    await marcar("Bruna Alves", terca(10))
    await marcar("Carla Dias", terca(10, 30))
    await marcar("Dora Lima", terca(15))
    await abrir()

    const bruna = await dia().findByRole("button", { name: /^10:00 · Bruna Alves/ })
    const carla = dia().getByRole("button", { name: /^10:30 · Carla Dias/ })
    const dora = dia().getByRole("button", { name: /^15:00 · Dora Lima/ })
    // Uma hora vale 64 px a partir das 9h, quando o salão abre.
    expect(bruna.style.top).toBe("64px")
    expect(bruna.style.height).toBe("64px")
    expect(carla.style.top).toBe("96px")
    expect([bruna.style.width, carla.style.width]).toEqual(["50%", "50%"])
    expect([bruna.style.left, carla.style.left]).toEqual(["0%", "50%"])
    expect(dora.style.width).toBe("100%")
  })

  test("o dia diz quantos atendimentos tem e o horário do salão", async () => {
    await marcar("Bruna Alves", terca(10))
    await marcar("Carla Dias", terca(15))
    await abrir()
    expect(await dia().findByText("2 atendimentos · das 09:00 às 19:00")).toBeInTheDocument()
  })

  test("anda entre os dias e avisa quando o salão não abre", async () => {
    const usuario = await abrir("?dia=2026-12-05")
    expect(
      screen.getByRole("heading", { level: 2, name: /^sábado, 5 de dezembro/ }),
    ).toBeInTheDocument()
    // O domingo seguinte é fechado.
    await usuario.click(screen.getByRole("button", { name: "Próximo dia" }))
    expect(
      await screen.findByRole("heading", { level: 2, name: /^domingo, 6 de dezembro/ }),
    ).toBeInTheDocument()
    expect(dia().getByText("O salão não abre neste dia.")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Dia anterior" }))
    await usuario.click(screen.getByRole("button", { name: "Dia anterior" }))
    expect(
      await screen.findByRole("heading", { level: 2, name: /^sexta-feira, 4 de dezembro/ }),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Hoje" }))
    expect(
      await screen.findByRole("heading", { level: 2, name: /^sexta-feira, 13 de novembro/ }),
    ).toBeInTheDocument()
  }, 15_000)

  test("o resumo mostra hoje, amanhã e os próximos 7 dias", async () => {
    await abrir()
    const resumo = within(screen.getByRole("region", { name: "Resumo da agenda" }))
    for (const nome of ["Hoje", "Amanhã", "Próximos 7 dias"]) {
      expect(resumo.getByText(nome)).toBeInTheDocument()
    }
  })

  test("tocar no atendimento abre os detalhes", async () => {
    const pedido = await marcar("Bruna Alves", terca(10))
    const usuario = await abrir()
    await usuario.click(await dia().findByRole("button", { name: /^10:00 · Bruna Alves/ }))
    const detalhes = await screen.findByRole("dialog", { name: new RegExp(`#${pedido.numero}`) })
    expect(detalhes).toHaveTextContent("Bruna Alves")
  })

  test("novo agendamento: só dias abertos e horários livres; aparece na agenda", async () => {
    await marcar("Bruna Alves", terca(10))
    await marcar("Carla Dias", terca(10))
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Novo agendamento" }))
    const janela = within(screen.getByRole("dialog", { name: "Novo agendamento" }))
    const confirmar = janela.getByRole("button", { name: "Marcar" })
    expect(confirmar).toBeDisabled()

    await usuario.type(janela.getByRole("textbox", { name: "Nome da cliente" }), "Elisa Rocha")
    await usuario.type(janela.getByRole("textbox", { name: "Telefone" }), "12991112222")
    const [servico] = (await api().produtos.listar()).filter(
      (produto) => produto.disponivel && produto.duracaoMin === 60,
    )
    await usuario.click(janela.getByRole("checkbox", { name: new RegExp(`^${servico.nome}`) }))
    expect(janela.getByText(/^Duração: 1 h/)).toBeInTheDocument()

    // O calendário fala português, inclusive para o leitor de tela.
    expect(janela.getByRole("button", { name: "Ir para o próximo mês" })).toBeInTheDocument()
    // Domingo o salão não abre.
    expect(janela.getByRole("button", { name: /^domingo, 6 de dezembro/ })).toBeDisabled()
    await usuario.click(janela.getByRole("button", { name: /^terça-feira, 1 de dezembro/ }))
    const horarios = within(await janela.findByRole("radiogroup", { name: "Horário" }))
    expect(await horarios.findByRole("radio", { name: "09:00" })).toBeInTheDocument()
    // Das 10h às 11h já há dois atendimentos: a capacidade do salão.
    expect(horarios.queryByRole("radio", { name: "10:00" })).not.toBeInTheDocument()
    expect(horarios.queryByRole("radio", { name: "10:30" })).not.toBeInTheDocument()

    await usuario.click(horarios.getByRole("radio", { name: "11:00" }))
    await usuario.click(janela.getByRole("radio", { name: "Pix" }))
    await usuario.click(confirmar)
    expect(
      await screen.findByText("Marcado para terça-feira, 01/12, às 11:00."),
    ).toBeInTheDocument()
    expect(await dia().findByRole("button", { name: /^11:00 · Elisa Rocha/ })).toBeInTheDocument()
  }, 15_000)

  test("remarcar e imprimir o comprovante pelos detalhes", async () => {
    const pedido = await marcar("Bruna Alves", terca(10))
    const usuario = await abrir()
    await usuario.click(await dia().findByRole("button", { name: /^10:00 · Bruna Alves/ }))
    const detalhes = within(
      await screen.findByRole("dialog", { name: new RegExp(`#${pedido.numero}`) }),
    )
    await usuario.click(detalhes.getByRole("button", { name: "Imprimir comprovante" }))
    expect(imprimir).toHaveBeenCalled()

    await usuario.click(detalhes.getByRole("button", { name: "Remarcar" }))
    const janela = within(
      screen.getByRole("dialog", { name: `Remarcar o agendamento #${pedido.numero}` }),
    )
    await usuario.click(janela.getByRole("button", { name: /^terça-feira, 1 de dezembro/ }))
    const horarios = within(await janela.findByRole("radiogroup", { name: "Horário" }))
    await usuario.click(await horarios.findByRole("radio", { name: "15:00" }))
    await usuario.click(janela.getByRole("button", { name: "Remarcar" }))

    expect(
      await screen.findByText("Marcado para terça-feira, 01/12, às 15:00."),
    ).toBeInTheDocument()
    expect((await api().pedidos.buscar(pedido.id))?.agendamento?.inicio).toBe(terca(15))
  }, 15_000)

  test("a lista busca pela cliente e filtra pelo status", async () => {
    await marcar("Zuleica Prado", terca(11))
    const usuario = await abrir()
    await usuario.click(screen.getByRole("tab", { name: "Lista" }))
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar na agenda" }), "zuleica")

    const linhas = await screen.findAllByRole("row", { name: /Zuleica Prado/ })
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toHaveTextContent("01/12 11:00")

    await usuario.click(screen.getByRole("combobox", { name: "Status" }))
    await usuario.click(await screen.findByRole("option", { name: "Concluídos" }))
    expect(screen.queryByRole("row", { name: /Zuleica Prado/ })).not.toBeInTheDocument()
    expect(screen.getByText("Nenhum atendimento encontrado.")).toBeInTheDocument()
  })
})
