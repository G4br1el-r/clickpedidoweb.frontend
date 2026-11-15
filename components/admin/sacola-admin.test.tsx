import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { SacolaAdmin } from "./sacola-admin"

function abrirCom(variante: "mosaico" | "imersivo", paraAplicar = false) {
  render(
    <TooltipProvider>
      <SacolaAdmin />
    </TooltipProvider>,
  )
  act(() => {
    useConfig.getState().atualizar("cards", { variante })
    useConfig.getState().abrirSacola(true, paraAplicar)
  })
  return screen.getByTestId("sacola-admin")
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
})

describe("SacolaAdmin", () => {
  test("cada item mostra que é Pro e o preço por mês", () => {
    const sacola = abrirCom("mosaico")
    const lista = within(sacola).getByRole("list", { name: "Recursos na sacola" })
    const item = within(lista).getByRole("listitem")
    expect(item).toHaveTextContent("Card Mosaico")
    expect(within(item).getByText("Pro")).toBeInTheDocument()
    expect(item).toHaveTextContent("R$ 9,90/mês")
  })

  test("o total segue o plano escolhido", async () => {
    const sacola = abrirCom("mosaico")
    const total = within(sacola).getByRole("status", { name: "Total" })
    expect(total).toHaveTextContent("R$ 9,90/mês")
    await userEvent.click(within(sacola).getByRole("radio", { name: "Pro completo" }))
    expect(total).toHaveTextContent("R$ 79,90/mês")
  })

  test("aberta para aplicar, explica o que falta e oferece aplicar sem o Pro", async () => {
    const sacola = abrirCom("imersivo", true)
    expect(within(sacola).getByText("Falta contratar para aplicar no site")).toBeInTheDocument()
    await userEvent.click(
      within(sacola).getByRole("button", { name: "Aplicar sem os recursos Pro" }),
    )
    expect(useConfig.getState().sacolaAberta).toBe(false)
    expect(useConfig.getState().publicadaEm).not.toBeNull()
    // O site recebe a configuração sem o recurso que não foi contratado.
    expect(useConfig.getState().publicada.cards.variante).not.toBe("imersivo")
  })
})
