import { zodResolver } from "@hookform/resolvers/zod"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { type DadosCheckout, esquemaCheckout, valoresIniciais } from "@/lib/checkout"
import { useLojaAtual } from "@/lib/loja-atual"
import { useSacola } from "@/lib/sacola"
import { PassoHorario } from "./passo-horario"

function Escolhido() {
  const agendamento = useWatch<DadosCheckout, "agendamento">({ name: "agendamento" })
  return <output aria-label="Horário escolhido">{agendamento}</output>
}

function Formulario() {
  const formulario = useForm<DadosCheckout>({
    resolver: zodResolver(esquemaCheckout),
    defaultValues: valoresIniciais(null),
  })
  return (
    <FormProvider {...formulario}>
      <PassoHorario />
      <Escolhido />
    </FormProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  // Sexta, 13/11/2026, 20h30: o salão (terça a sábado, 9h às 19h) já fechou.
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  useLojaAtual.setState({ id: "emporio-das-deusas", hidratada: true })
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
  useSacola.getState().adicionar({
    produtoId: "escova",
    nome: "Escova",
    imagem: { src: "/e.jpg", width: 1, height: 1 },
    precoUnitario: 55,
    quantidade: 1,
    resumo: [],
    duracaoMin: 120,
  })
})

afterEach(() => {
  vi.useRealTimers()
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("PassoHorario", () => {
  test("mostra quanto o atendimento dura e os próximos dias em que o salão abre", () => {
    render(<Formulario />)
    expect(screen.getByRole("heading", { name: "Quando você quer vir?" })).toBeInTheDocument()
    expect(screen.getByText("Seu atendimento dura 2h.")).toBeInTheDocument()
    const dias = within(screen.getByRole("radiogroup", { name: "Dia" })).getAllByRole("radio")
    expect(dias).toHaveLength(7)
    // Sábado e, depois do domingo e da segunda fechados, terça e quarta.
    expect(dias[0]).toHaveAccessibleName("sáb 14/11")
    expect(dias[1]).toHaveAccessibleName("ter 17/11")
    expect(dias[2]).toHaveAccessibleName("qua 18/11")
  })

  test("no fim do expediente de hoje, já vem marcado o próximo dia com horário livre", () => {
    // Sábado, 14/11/2026, 18h30: o salão fecha às 19h e a escova de 2h não cabe mais hoje.
    vi.setSystemTime(new Date(2026, 10, 14, 18, 30))
    render(<Formulario />)
    const dias = within(screen.getByRole("radiogroup", { name: "Dia" })).getAllByRole("radio")
    expect(dias[0]).toHaveAccessibleName("sáb 14/11")
    expect(screen.getByRole("radio", { name: "ter 17/11" })).toBeChecked()
    const horas = within(screen.getByRole("radiogroup", { name: "Horário" })).getAllByRole("radio")
    expect(horas[0]).toHaveAccessibleName("09:00")
    expect(screen.queryByText(/Nenhum horário livre neste dia/)).not.toBeInTheDocument()
  })

  test("escolhe o dia e um horário em que tudo cabe antes de fechar", async () => {
    const usuario = userEvent.setup()
    render(<Formulario />)
    await usuario.click(screen.getByRole("radio", { name: /sáb.*14\/11/ }))
    const horas = within(screen.getByRole("radiogroup", { name: "Horário" }))
    const opcoes = horas.getAllByRole("radio")
    // Duas horas de serviço: o último começo é 17h, para terminar às 19h.
    expect(opcoes[0]).toHaveAccessibleName("09:00")
    expect(opcoes.at(-1)).toHaveAccessibleName("17:00")

    await usuario.click(horas.getByRole("radio", { name: "15:30" }))
    expect(screen.getByRole("status", { name: "Horário escolhido" })).toHaveTextContent(
      new Date(2026, 10, 14, 15, 30).toISOString(),
    )
    expect(screen.getByText("sábado, 14/11, das 15:30 às 17:30")).toBeInTheDocument()
  })
})
