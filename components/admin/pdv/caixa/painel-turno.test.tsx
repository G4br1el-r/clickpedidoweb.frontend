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
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { PaginaPdv } from "../pagina-pdv"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    // O PDV lê a tela no endereço (`?tela=`).
    <NuqsTestingAdapter hasMemory>
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

/** Venda de balcão feita pela Marina direto no servidor. */
const vender = (preco: number, pagamento: "dinheiro" | "pix" = "dinheiro") =>
  api().pdv.finalizar({
    operadorId: "eq-marina",
    itens: [{ avulso: { nome: "Água", preco }, quantidade: 1 }],
    pagamento,
    desconto: { modo: "reais", valor: 0 },
    concluida: true,
  })

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaPdv />
    </Provedores>,
  )
  await screen.findByRole("region", { name: "Turno do caixa" }, { timeout: 8000 })
  return usuario
}

const painel = () => within(screen.getByRole("region", { name: "Turno do caixa" }))
/** O valor de um item da régua do turno, pelo nome dele. */
const item = (nome: string) => painel().getByText(nome).closest("div") as HTMLElement

/** Digita um valor em reais num campo com máscara. */
async function digitarReais(
  usuario: ReturnType<typeof userEvent.setup>,
  campo: HTMLElement,
  valor: string,
) {
  await usuario.tripleClick(campo)
  await usuario.keyboard(valor)
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
  await api().caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
  useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PainelTurno", () => {
  test("mostra vendas, total e gaveta do turno", async () => {
    await vender(30)
    await vender(12, "pix")
    await abrir()
    await waitFor(() => expect(item("Vendas")).toHaveTextContent("2"))
    expect(item("Turno")).toHaveTextContent("Marina S.")
    expect(item("Turno")).toHaveTextContent("Desde 20:30")
    expect(item("Total vendido")).toHaveTextContent("R$ 42,00")
    expect(item("Ticket médio")).toHaveTextContent("R$ 21,00")
    expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 130,00")
    expect(painel().queryByText("Sangria recomendada")).not.toBeInTheDocument()
  })

  test("gaveta acima do limite mostra Sangria recomendada", async () => {
    await vender(450)
    await abrir()
    expect(await painel().findByText("Sangria recomendada")).toBeInTheDocument()
    expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 550,00")
  })

  test("F11 abre a janela; suprimento de R$ 50 aumenta a gaveta", async () => {
    const usuario = await abrir()
    await waitFor(() => expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 100,00"))
    await usuario.keyboard("{F11}")
    const janela = await screen.findByRole("dialog", { name: "Sangria ou suprimento" })
    await usuario.click(within(janela).getByRole("radio", { name: "Suprimento" }))
    await digitarReais(usuario, within(janela).getByLabelText("Valor"), "50")
    await usuario.type(within(janela).getByLabelText("Motivo"), "Moedas")
    await usuario.click(within(janela).getByRole("button", { name: "Registrar" }))

    await waitFor(() => expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 150,00"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("sangria da Marina pede o PIN do Rafael e diminui a gaveta", async () => {
    await vender(200)
    const usuario = await abrir()
    await waitFor(() => expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 300,00"))
    await usuario.click(painel().getByRole("button", { name: /Sangria ou suprimento/ }))
    const janela = await screen.findByRole("dialog", { name: "Sangria ou suprimento" })
    await digitarReais(usuario, within(janela).getByLabelText("Valor"), "100")
    await usuario.type(within(janela).getByLabelText("Motivo"), "Cofre")
    await usuario.click(within(janela).getByRole("button", { name: "Registrar" }))

    const autorizacao = await screen.findByRole("dialog", { name: "Autorização do gerente" })
    await usuario.click(within(autorizacao).getByRole("radio", { name: "Rafael M. Gerente" }))
    await usuario.type(within(autorizacao).getByLabelText("PIN do gerente"), "2580")
    await usuario.click(within(autorizacao).getByRole("button", { name: "Autorizar" }))

    await waitFor(() => expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 200,00"))
    expect((await api().caixa.atual())?.movimentos[0]).toMatchObject({
      tipo: "sangria",
      valor: 100,
      feitoPor: "eq-marina",
      autorizadoPor: "eq-gerente",
    })
  })

  test("sangria maior que a gaveta mostra o erro", async () => {
    const usuario = await abrir()
    await waitFor(() => expect(item("Dinheiro na gaveta")).toHaveTextContent("R$ 100,00"))
    await usuario.keyboard("{F11}")
    const janela = await screen.findByRole("dialog", { name: "Sangria ou suprimento" })
    await digitarReais(usuario, within(janela).getByLabelText("Valor"), "500")
    await usuario.type(within(janela).getByLabelText("Motivo"), "Cofre")
    await usuario.click(within(janela).getByRole("button", { name: "Registrar" }))
    expect(within(janela).getByText("A gaveta só tem R$ 100,00.")).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Autorização do gerente" })).not.toBeInTheDocument()
  })
})
