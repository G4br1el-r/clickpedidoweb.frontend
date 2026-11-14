import { zodResolver } from "@hookform/resolvers/zod"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { type DadosCheckout, esquemaCheckout, valoresIniciais } from "@/lib/checkout"
import { useLojaAtual } from "@/lib/loja-atual"
import { useSacola } from "@/lib/sacola"
import { PassoPagamento } from "./passo-pagamento"

// O Intl separa "R$" do valor com espaço não separável. A busca por texto da Testing Library
// normaliza os espaços, então ali o esperado usa espaço comum; o nome acessível e o textContent
// mantêm o caractere original.
const NBSP = " "

/** O passo dentro de um formulário igual ao do checkout. */
function Formulario({ total, valores }: { total: number; valores?: Partial<DadosCheckout> }) {
  const formulario = useForm<DadosCheckout>({
    resolver: zodResolver(esquemaCheckout),
    defaultValues: { ...valoresIniciais(null), ...valores, total },
    mode: "onTouched",
  })
  return (
    <FormProvider {...formulario}>
      <PassoPagamento total={total} />
    </FormProvider>
  )
}

function abrir(total: number, valores?: Partial<DadosCheckout>) {
  const usuario = userEvent.setup()
  render(<Formulario total={total} valores={valores} />)
  return usuario
}

const blocoTroco = () => screen.getByRole("radiogroup", { name: "Precisa de troco?" })

describe("PassoPagamento", () => {
  test("mostra o total do pedido", () => {
    abrir(73)

    expect(screen.getByText("R$ 73,00")).toBeInTheDocument()
  })

  test("na entrega, separa o que se paga agora do que se paga na entrega", () => {
    abrir(73)

    expect(screen.getByText("Pague agora")).toBeInTheDocument()
    expect(screen.getByText("Pague na entrega")).toBeInTheDocument()
  })

  test("na retirada, a maquininha fica no balcão", async () => {
    const usuario = abrir(73, { tipo: "retirada" })
    expect(screen.getByText("Pague na retirada")).toBeInTheDocument()

    await usuario.click(screen.getByRole("radio", { name: /Cartão na maquininha/ }))

    expect(screen.getByText("Pague no balcão, no crédito ou no débito.")).toBeInTheDocument()
  })

  test("no Pix, que já vem escolhido, pede o CPF", () => {
    abrir(73)

    expect(screen.getByRole("radio", { name: /Pix/ })).toBeChecked()
    expect(screen.getByLabelText("CPF")).toBeInTheDocument()
  })

  describe("troco no dinheiro", () => {
    test("sugere as próximas notas acima do total", async () => {
      const usuario = abrir(73)
      await usuario.click(screen.getByRole("radio", { name: /Dinheiro/ }))

      const opcoes = within(blocoTroco()).getAllByRole("radio")
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
        "Não preciso",
        `R$${NBSP}100`,
        `R$${NBSP}150`,
        `R$${NBSP}200`,
        "Outro valor",
      ])
    })

    test("ao escolher uma nota, mostra quanto volta", async () => {
      const usuario = abrir(73)
      await usuario.click(screen.getByRole("radio", { name: /Dinheiro/ }))

      await usuario.click(within(blocoTroco()).getByRole("radio", { name: `R$${NBSP}100` }))

      expect(screen.getByText("Seu troco será de R$ 27,00")).toBeInTheDocument()
    })

    test("outro valor abaixo do total mostra o erro do troco", async () => {
      const usuario = abrir(73)
      await usuario.click(screen.getByRole("radio", { name: /Dinheiro/ }))
      await usuario.click(within(blocoTroco()).getByRole("radio", { name: "Outro valor" }))

      await usuario.type(screen.getByLabelText("Troco para quanto?"), "50")
      await usuario.tab()

      expect(
        await screen.findByText("O troco precisa ser para R$ 73,00 ou mais"),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Seu troco será de/)).not.toBeInTheDocument()
    })

    test("outro valor acima do total mostra quanto volta", async () => {
      const usuario = abrir(73)
      await usuario.click(screen.getByRole("radio", { name: /Dinheiro/ }))
      await usuario.click(within(blocoTroco()).getByRole("radio", { name: "Outro valor" }))

      await usuario.type(screen.getByLabelText("Troco para quanto?"), "80")

      expect(screen.getByText("Seu troco será de R$ 7,00")).toBeInTheDocument()
    })
  })
})

describe("PassoPagamento no açougue", () => {
  beforeEach(() => {
    useLojaAtual.setState({ id: "acougue-sabor-da-carne", hidratada: true })
    useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
  })
  afterEach(() => useLojaAtual.setState(useLojaAtual.getInitialState(), true))

  test("com corte por quilo na sacola, oferece pagar depois da pesagem", async () => {
    useSacola.getState().adicionar({
      produtoId: "picanha",
      nome: "Picanha",
      imagem: { src: "/p.jpg", width: 1, height: 1 },
      precoUnitario: 44.95,
      quantidade: 1,
      resumo: ["500 g"],
      pesoGramas: 500,
    })
    const usuario = abrir(44.95)
    await usuario.click(screen.getByRole("radio", { name: /Pagar após a pesagem/ }))
    expect(
      screen.getByText(
        "Depois de pesar, mandamos pelo WhatsApp o valor exato e o link para pagar.",
      ),
    ).toBeInTheDocument()
  })

  test("sem corte por quilo, a opção não aparece", () => {
    abrir(30)
    expect(screen.queryByRole("radio", { name: /Pagar após a pesagem/ })).not.toBeInTheDocument()
  })
})
