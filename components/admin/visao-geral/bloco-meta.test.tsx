import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { useMetas } from "@/lib/admin/metas"
import { BlocoMeta } from "./bloco-meta"

beforeEach(() => {
  localStorage.clear()
  useMetas.setState(useMetas.getInitialState(), true)
})

describe("BlocoMeta", () => {
  test("sem meta, convida a definir e guarda a meta do segmento", async () => {
    const usuario = userEvent.setup()
    render(<BlocoMeta segmento="pizzaria" situacao={null} />)
    const bloco = within(screen.getByRole("region", { name: "Meta do mês" }))
    expect(bloco.getByText("Defina a meta do mês para acompanhar o ritmo")).toBeInTheDocument()

    await usuario.click(bloco.getByRole("button", { name: "Definir meta" }))
    await usuario.type(bloco.getByRole("textbox", { name: "Faturamento do mês" }), "30000")
    await usuario.click(bloco.getByRole("button", { name: "Salvar meta" }))

    expect(useMetas.getState().metas.pizzaria).toEqual({ faturamento: 30_000, pedidos: null })
  })

  const SITUACAO = {
    mes: { meta: 30_000, realizado: 10_300, percentual: 34.33 },
    hoje: { meta: 1333.33, realizado: 300 },
    projecao: 25_000,
    emRisco: false,
    pedidos: null,
  }

  test("com meta, mostra o mês, a meta de hoje e a projeção", () => {
    render(<BlocoMeta segmento="pizzaria" situacao={SITUACAO} />)
    const bloco = within(screen.getByRole("region", { name: "Meta do mês" }))

    expect(bloco.getByText("Vendido no mês").closest("[data-indicador]")).toHaveTextContent(
      "R$ 10.300,00de R$ 30.000,00 · 34%",
    )
    expect(bloco.getByRole("progressbar", { name: "34% da meta do mês" })).toBeInTheDocument()
    expect(bloco.getByText("Meta de hoje").closest("[data-indicador]")).toHaveTextContent(
      "R$ 1.333,33Vendido hoje: R$ 300,00",
    )
    expect(bloco.getByText("Projeção do mês").closest("[data-indicador]")).toHaveTextContent(
      "R$ 25.000,00No ritmo dos dias abertos",
    )
  })

  test("antes do 3º dia aberto, a projeção explica quando aparece", () => {
    render(<BlocoMeta segmento="pizzaria" situacao={{ ...SITUACAO, projecao: null }} />)
    expect(screen.getByText("Projeção do mês").closest("[data-indicador]")).toHaveTextContent(
      "A partir do 3º dia de funcionamento",
    )
  })

  test("dá para mudar e apagar a meta", async () => {
    const usuario = userEvent.setup()
    useMetas.getState().definir("pizzaria", { faturamento: 30_000, pedidos: null })
    render(<BlocoMeta segmento="pizzaria" situacao={SITUACAO} />)

    await usuario.click(screen.getByRole("button", { name: "Mudar meta" }))
    const campo = screen.getByRole("textbox", { name: "Faturamento do mês" })
    await usuario.clear(campo)
    await usuario.type(campo, "40000")
    await usuario.click(screen.getByRole("button", { name: "Salvar meta" }))
    expect(useMetas.getState().metas.pizzaria?.faturamento).toBe(40_000)

    await usuario.click(screen.getByRole("button", { name: "Apagar meta" }))
    expect(useMetas.getState().metas.pizzaria).toBeUndefined()
  })
})
