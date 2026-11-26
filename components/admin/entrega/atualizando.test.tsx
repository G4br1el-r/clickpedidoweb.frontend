import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BarraAtualizando, RadarAoVivo } from "./atualizando"

// O relógio é o real: o Motion não convive bem com o relógio falso entre um teste e outro.
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

describe("BarraAtualizando", () => {
  it("parada, não mostra nada", async () => {
    render(<BarraAtualizando ativa={false} rotulo="Atualizando os bairros" />)
    await esperar(400)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("só aparece se a atualização demorar: as rápidas passam sem piscar", async () => {
    render(<BarraAtualizando ativa rotulo="Atualizando os bairros" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(
      await screen.findByRole("status", { name: "Atualizando os bairros" }),
    ).toBeInTheDocument()
  })

  it("se a atualização termina antes do atraso, nunca aparece", async () => {
    const { rerender } = render(<BarraAtualizando ativa rotulo="Atualizando os bairros" />)
    await esperar(100)
    rerender(<BarraAtualizando ativa={false} rotulo="Atualizando os bairros" />)
    await esperar(500)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("some quando a atualização termina", async () => {
    const { rerender } = render(<BarraAtualizando ativa rotulo="Atualizando os bairros" />)
    expect(await screen.findByRole("status")).toBeInTheDocument()
    rerender(<BarraAtualizando ativa={false} rotulo="Atualizando os bairros" />)
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), {
      timeout: 2000,
    })
  })
})

describe("RadarAoVivo", () => {
  it("mostra o radar quando a sincronização demora", async () => {
    render(<RadarAoVivo ativo rotulo="Sincronizando as mesas" />)
    expect(
      await screen.findByRole("status", { name: "Sincronizando as mesas" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("carregador-radar")).toBeInTheDocument()
  })

  it("sincronização rápida não mostra nada", () => {
    render(<RadarAoVivo ativo={false} rotulo="Sincronizando as mesas" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
