import "fake-indexeddb/auto"
import { screen, waitFor, within } from "@testing-library/react"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { abrirPdv, venderNoServidor } from "./apoio-testes"

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
  await servidorDo("pizzaria").caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
  useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
  await venderNoServidor(30)
  await venderNoServidor(12, "pix")
})

afterEach(() => {
  vi.useRealTimers()
})

const conferencia = () =>
  within(screen.getByRole("table", { name: "Conferência por forma de pagamento" }))
const linha = (forma: string) => conferencia().getByRole("row", { name: new RegExp(`^${forma}`) })
const contagem = () => within(screen.getByRole("region", { name: "Contagem da gaveta" }))

describe("FechamentoCaixa", () => {
  test("F12 leva ao fechamento com o esperado em dinheiro", async () => {
    const usuario = await abrirPdv("PDV")
    await screen.findByRole("region", { name: "Turno do caixa" })
    await usuario.keyboard("{F12}")
    await screen.findByRole("heading", { level: 1, name: "Fechar o caixa" })
    await waitFor(() => expect(linha("Dinheiro")).toHaveTextContent("R$ 130,00"))
    expect(linha("Pix")).toHaveTextContent("R$ 12,00")
    expect(screen.getByRole("button", { name: "Fechar caixa" })).toBeDisabled()
  })

  test("contagem menor mostra a diferença e trava o botão até justificar", async () => {
    const usuario = await abrirPdv("Fechar o caixa", "?tela=fechar")
    await waitFor(() => expect(linha("Dinheiro")).toHaveTextContent("R$ 130,00"))
    await usuario.type(contagem().getByLabelText("R$ 100"), "1")
    await usuario.type(contagem().getByLabelText("R$ 20"), "1")
    await usuario.type(contagem().getByLabelText("R$ 5"), "1")

    expect(linha("Dinheiro")).toHaveTextContent("R$ 125,00")
    expect(linha("Dinheiro")).toHaveTextContent("−R$ 5,00")
    const fechar = screen.getByRole("button", { name: "Fechar caixa" })
    expect(fechar).toBeDisabled()
    await usuario.type(screen.getByLabelText("Justificativa"), "Troco dado a mais")
    expect(fechar).toBeEnabled()
  })

  test("fechar volta para Abrir o caixa", async () => {
    const usuario = await abrirPdv("Fechar o caixa", "?tela=fechar")
    await waitFor(() => expect(linha("Dinheiro")).toHaveTextContent("R$ 130,00"))
    await usuario.type(contagem().getByLabelText("R$ 100"), "1")
    await usuario.type(contagem().getByLabelText("R$ 20"), "1")
    await usuario.type(contagem().getByLabelText("R$ 10"), "1")
    expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Fechar caixa" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Abrir o caixa" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    const [ultimo] = await servidorDo("pizzaria").caixa.historico()
    expect(ultimo.turno).toMatchObject({
      fechadoPor: "eq-marina",
      conferencia: { contado: { dinheiro: 130, pix: 12 } },
    })
  })

  test("ao fechar, a abertura começa do topo da página", async () => {
    const rolar = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const usuario = await abrirPdv("Fechar o caixa", "?tela=fechar")
    await waitFor(() => expect(linha("Dinheiro")).toHaveTextContent("R$ 130,00"))
    await usuario.type(contagem().getByLabelText("R$ 100"), "1")
    await usuario.type(contagem().getByLabelText("R$ 20"), "1")
    await usuario.type(contagem().getByLabelText("R$ 10"), "1")
    await usuario.click(screen.getByRole("button", { name: "Fechar caixa" }))
    await screen.findByRole("heading", { level: 1, name: "Abrir o caixa" }, { timeout: 8000 })
    expect(rolar).toHaveBeenCalledWith({ top: 0 })
    rolar.mockRestore()
  })

  test("Voltar leva de volta à venda", async () => {
    const usuario = await abrirPdv("Fechar o caixa", "?tela=fechar")
    await usuario.click(screen.getByRole("button", { name: "Voltar à venda" }))
    expect(await screen.findByRole("region", { name: "Turno do caixa" })).toBeInTheDocument()
  })
})
