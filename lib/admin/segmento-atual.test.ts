import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { useSegmentoAtual, useSegmentoCarregado } from "./segmento-atual"

beforeEach(() => {
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

describe("useSegmentoAtual", () => {
  test("começa na pizzaria, a loja do protótipo", () => {
    expect(useSegmentoAtual.getState().segmento).toBe("pizzaria")
  })

  test("troca de segmento e guarda a escolha neste navegador", async () => {
    useSegmentoAtual.getState().escolher("salao")
    expect(useSegmentoAtual.getState().segmento).toBe("salao")

    useSegmentoAtual.setState({ segmento: "pizzaria" })
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: "salao" }, version: 1 }),
    )
    await useSegmentoAtual.persist.rehydrate()
    expect(useSegmentoAtual.getState().segmento).toBe("salao")
  })

  test("um segmento guardado que não existe mais volta para a pizzaria", async () => {
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: "sorveteria" }, version: 1 }),
    )
    await useSegmentoAtual.persist.rehydrate()
    expect(useSegmentoAtual.getState().segmento).toBe("pizzaria")
  })

  test("ao abrir o painel, carrega o segmento salvo uma vez", async () => {
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: "adega" }, version: 1 }),
    )
    renderHook(() => useSegmentoCarregado())
    await waitFor(() => expect(useSegmentoAtual.getState().hidratado).toBe(true))
    expect(useSegmentoAtual.getState().segmento).toBe("adega")
  })
})
