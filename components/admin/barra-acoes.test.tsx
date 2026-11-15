import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { BarraAcoes } from "./barra-acoes"

function renderizar() {
  return render(
    <TooltipProvider>
      <BarraAcoes />
    </TooltipProvider>,
  )
}

function mudar(acao: () => void) {
  act(acao)
}

beforeEach(() => {
  useConfig.setState({ ...useConfig.getInitialState(), hidratada: true }, true)
})

describe("BarraAcoes", () => {
  test("sem mudanças, diz que nada foi aplicado e não deixa aplicar", () => {
    renderizar()
    expect(screen.getByText("Ainda nada aplicado no site")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aplicar no site" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument()
  })

  test("com mudanças, diz em qual seção elas estão", async () => {
    renderizar()
    mudar(() => useConfig.getState().atualizar("identidade", { nome: "Bella Napoli" }))
    expect(await screen.findByText("Mudanças não aplicadas")).toBeInTheDocument()
    expect(await screen.findByText("em Identidade")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aplicar no site" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Descartar" })).toBeInTheDocument()
  })

  test("com mudanças em duas seções, nomeia as duas; com mais, conta", async () => {
    renderizar()
    mudar(() => useConfig.getState().atualizar("identidade", { nome: "Bella Napoli" }))
    mudar(() => useConfig.getState().atualizar("cores", { cantos: 4 }))
    expect(await screen.findByText("em Identidade e Cores e botões")).toBeInTheDocument()
    mudar(() => useConfig.getState().atualizar("tipografia", { escala: 110 }))
    expect(await screen.findByText("em 3 seções")).toBeInTheDocument()
  })

  test("com recurso Pro na sacola, o botão avisa que vai revisar antes de aplicar", async () => {
    renderizar()
    mudar(() => useConfig.getState().atualizar("cards", { variante: "mosaico" }))
    const aplicar = screen.getByRole("button", { name: "Revisar e aplicar" })
    expect(screen.getByRole("button", { name: /1 na sacola/ })).toHaveTextContent(
      "1 na sacola · R$ 9,90/mês",
    )
    await userEvent.click(aplicar)
    expect(useConfig.getState().sacolaAberta).toBe(true)
    expect(useConfig.getState().sacolaParaAplicar).toBe(true)
  })

  test("descartar volta ao que está no site", async () => {
    renderizar()
    mudar(() => useConfig.getState().atualizar("identidade", { nome: "Bella Napoli" }))
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }))
    expect(useConfig.getState().config.identidade.nome).toBe("Casa da Pizza")
    expect(screen.getByRole("button", { name: "Aplicar no site" })).toBeDisabled()
  })
})
