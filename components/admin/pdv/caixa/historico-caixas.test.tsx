import "fake-indexeddb/auto"
import { screen, waitFor, within } from "@testing-library/react"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { abrirPdv, venderNoServidor } from "./apoio-testes"

const api = () => servidorDo("pizzaria")

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
  // Fora do ShellAdmin ninguém lê o navegador: o teste começa com ele já lido.
  useUsuarioSalvo.setState({ hidratado: true })
  await api().caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
  useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
  await venderNoServidor(30)
  await api().caixa.movimentar({
    operadorId: "eq-marina",
    tipo: "sangria",
    valor: 50,
    motivo: "Cofre",
    autorizacao: { membroId: "eq-gerente", pin: "2580" },
  })
  await api().caixa.fechar({
    operadorId: "eq-marina",
    contadoDinheiro: 75,
    justificativa: "Troco dado a mais",
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const tabela = () => within(screen.getByRole("table", { name: "Caixas" }))

describe("HistoricoCaixas", () => {
  test("o histórico mostra o turno recém-fechado no topo, com a diferença", async () => {
    await abrirPdv("Histórico de caixas", "?tela=caixas")
    await waitFor(() => expect(tabela().getAllByRole("row").length).toBeGreaterThan(5))
    const [, primeira] = tabela().getAllByRole("row")
    expect(primeira).toHaveTextContent("13/11")
    expect(primeira).toHaveTextContent("Marina S.")
    expect(primeira).toHaveTextContent("20:30–20:30")
    expect(primeira).toHaveTextContent("R$ 30,00")
    expect(primeira).toHaveTextContent("−R$ 5,00")
  })

  test("a linha abre o detalhe com a sangria e quem autorizou", async () => {
    const usuario = await abrirPdv("Histórico de caixas", "?tela=caixas")
    await waitFor(() => expect(tabela().getAllByRole("row").length).toBeGreaterThan(5))
    await usuario.click(tabela().getByRole("button", { name: /13\/11.*Marina S\./ }))
    const detalhe = await screen.findByRole("dialog", { name: /Caixa de 13\/11/ })
    expect(within(detalhe).getByText("Sangria · Cofre")).toBeInTheDocument()
    expect(within(detalhe).getByText(/autorizou Rafael M\./)).toBeInTheDocument()
    expect(within(detalhe).getByText("Troco dado a mais")).toBeInTheDocument()
  })

  test("reabrir pela Marina pede o PIN do gerente", async () => {
    const usuario = await abrirPdv("Histórico de caixas", "?tela=caixas")
    await usuario.click(await screen.findByRole("button", { name: "Reabrir caixa" }))
    const autorizacao = await screen.findByRole("dialog", { name: "Autorização do gerente" })
    expect(
      within(autorizacao).getByText("Reabrir o caixa precisa do PIN de um gerente."),
    ).toBeInTheDocument()
    await usuario.click(within(autorizacao).getByRole("radio", { name: "Rafael M. Gerente" }))
    await usuario.type(within(autorizacao).getByLabelText("PIN do gerente"), "2580{Enter}")

    expect(
      await screen.findByRole("region", { name: "Turno do caixa" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect((await api().caixa.atual())?.reaberturas).toEqual([
      { em: new Date(2026, 10, 13, 20, 30).toISOString(), autorizadoPor: "eq-gerente" },
    ])
  })

  test("da abertura dá para ver o histórico", async () => {
    const usuario = await abrirPdv("Abrir o caixa")
    await usuario.click(screen.getByRole("button", { name: "Histórico de caixas" }))
    expect(
      await screen.findByRole("heading", { level: 1, name: "Histórico de caixas" }),
    ).toBeInTheDocument()
  })
})
