import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Produto } from "@/lib/admin/dados/tipos"
import { BarraDeLoteCardapio } from "./barra-de-lote-cardapio"

function produto(id: string, extras: Partial<Produto> = {}) {
  return { id, nome: `Produto ${id}`, disponivel: true, ativo: true, ...extras } as Produto
}

const normal = produto("a")
const esgotado = produto("b", { disponivel: false })
const oculto = produto("c", { ativo: false })

function renderizar(
  selecionados: Produto[],
  extras: Partial<Parameters<typeof BarraDeLoteCardapio>[0]> = {},
) {
  const aoAplicar = vi.fn()
  const aoLimpar = vi.fn()
  render(
    <BarraDeLoteCardapio
      selecionados={selecionados}
      aoAplicar={aoAplicar}
      aoLimpar={aoLimpar}
      {...extras}
    />,
  )
  return { aoAplicar, aoLimpar }
}

describe("BarraDeLoteCardapio", () => {
  it("sem produtos marcados, não aparece", () => {
    renderizar([])
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument()
  })

  it("diz quantos produtos estão marcados", () => {
    renderizar([normal, esgotado])
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "2 produtos selecionados",
    )
  })

  it("Indisponível manda só quem está disponível", async () => {
    const { aoAplicar } = renderizar([normal, esgotado])
    await userEvent.click(screen.getByRole("button", { name: "Indisponível" }))
    expect(aoAplicar).toHaveBeenCalledWith("indisponivel", [normal])
  })

  it("Disponível manda só quem está esgotado", async () => {
    const { aoAplicar } = renderizar([normal, esgotado])
    await userEvent.click(screen.getByRole("button", { name: "Disponível" }))
    expect(aoAplicar).toHaveBeenCalledWith("disponivel", [esgotado])
  })

  it("Oculto e Visível seguem o campo de visibilidade", async () => {
    const { aoAplicar } = renderizar([normal, oculto])
    await userEvent.click(screen.getByRole("button", { name: "Oculto" }))
    expect(aoAplicar).toHaveBeenLastCalledWith("oculto", [normal])
    await userEvent.click(screen.getByRole("button", { name: "Visível" }))
    expect(aoAplicar).toHaveBeenLastCalledWith("visivel", [oculto])
  })

  it("a ação que não muda ninguém fica desligada", () => {
    renderizar([normal])
    expect(screen.getByRole("button", { name: "Disponível" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Visível" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Indisponível" })).toBeEnabled()
  })

  it("excluir pede confirmação antes de mandar", async () => {
    const { aoAplicar } = renderizar([normal, esgotado])
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }))
    expect(aoAplicar).not.toHaveBeenCalled()

    const dialogo = screen.getByRole("alertdialog", { name: "Excluir 2 produtos?" })
    await userEvent.click(within(dialogo).getByRole("button", { name: "Sim, excluir" }))
    expect(aoAplicar).toHaveBeenCalledWith("excluir", [normal, esgotado])
  })

  it("voltar na confirmação não exclui", async () => {
    const { aoAplicar } = renderizar([normal])
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }))
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(aoAplicar).not.toHaveBeenCalled()
  })

  it("limpa a seleção", async () => {
    const { aoLimpar } = renderizar([normal])
    await userEvent.click(screen.getByRole("button", { name: "Limpar seleção" }))
    expect(aoLimpar).toHaveBeenCalledOnce()
  })

  it("enquanto aplica, mostra o carregamento na ação e não aceita outro clique", async () => {
    const { aoAplicar } = renderizar([normal, esgotado], { aplicando: "indisponivel" })
    expect(screen.getByRole("status", { name: "Aplicando no cardápio" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Indisponível/ }))
    await userEvent.click(screen.getByRole("button", { name: "Disponível" }))
    expect(aoAplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Limpar seleção" })).toBeDisabled()
  })
})
