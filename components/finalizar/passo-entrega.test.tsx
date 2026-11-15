import { zodResolver } from "@hookform/resolvers/zod"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { type DadosCheckout, esquemaCheckout, valoresIniciais } from "@/lib/checkout"
import { useLojaAtual } from "@/lib/loja-atual"
import { PassoEntrega } from "./passo-entrega"

function Formulario({ valores }: { valores?: Partial<DadosCheckout> }) {
  const formulario = useForm<DadosCheckout>({
    resolver: zodResolver(esquemaCheckout),
    defaultValues: { ...valoresIniciais(null), ...valores },
    mode: "onTouched",
  })
  return (
    <FormProvider {...formulario}>
      <PassoEntrega />
    </FormProvider>
  )
}

function abrir(valores?: Partial<DadosCheckout>) {
  const usuario = userEvent.setup()
  render(<Formulario valores={valores} />)
  return usuario
}

const ENDERECO = {
  logradouro: "Rua das Flores",
  bairro: "Jardim Aquarius",
  localidade: "São José dos Campos",
  uf: "SP",
}

describe("PassoEntrega", () => {
  beforeEach(() => {
    useLojaAtual.setState(useLojaAtual.getInitialState(), true)
  })

  test("enquanto busca o CEP, espera com o carregador do nicho", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const usuario = abrir()

    await usuario.type(screen.getByLabelText("CEP"), "12245000")

    const busca = screen.getByText("Buscando endereço").parentElement as HTMLElement
    expect(within(busca).getByTestId("carregador-pizzaria")).toBeInTheDocument()
  })

  test("achado o CEP, completa a rua e mostra a taxa do bairro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(ENDERECO))),
    )
    const usuario = abrir()

    await usuario.type(screen.getByLabelText("CEP"), "12245000")

    expect(await screen.findByDisplayValue("Rua das Flores")).toBeInTheDocument()
    expect(screen.getByText("Endereço encontrado")).toBeInTheDocument()
    expect(screen.getByText(/Entrega para Jardim Aquarius/)).toHaveTextContent("R$ 8,00")
  })

  test("na retirada, mostra o balcão da loja e quando fica pronto", async () => {
    const usuario = abrir()

    await usuario.click(screen.getByRole("radio", { name: "Retirar no balcão" }))

    expect(await screen.findByText("Balcão da Casa da Pizza")).toBeInTheDocument()
    expect(screen.getByText(/Fica pronto em/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Abrir no mapa" })).toBeInTheDocument()
  })
})
