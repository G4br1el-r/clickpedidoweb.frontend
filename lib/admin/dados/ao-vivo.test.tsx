import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { avisarOutrasAbas, CANAL_ADMIN, ouvirOutrasAbas } from "./ao-vivo"
import { reiniciarServidores, servidorDo, useAoVivo } from "./consultas"

type Ouvinte = (evento: { data: unknown }) => void

/** O BroadcastChannel do navegador (fronteira): entrega a todos os outros canais do mesmo nome. */
class CanalFalso {
  static abertos: CanalFalso[] = []
  ouvintes = new Set<Ouvinte>()
  constructor(readonly nome: string) {
    CanalFalso.abertos.push(this)
  }
  postMessage(dados: unknown) {
    for (const outro of CanalFalso.abertos) {
      if (outro !== this && outro.nome === this.nome) {
        for (const ouvinte of outro.ouvintes) ouvinte({ data: dados })
      }
    }
  }
  addEventListener(_tipo: "message", ouvinte: Ouvinte) {
    this.ouvintes.add(ouvinte)
  }
  removeEventListener(_tipo: "message", ouvinte: Ouvinte) {
    this.ouvintes.delete(ouvinte)
  }
}

/** Outra aba do mesmo navegador. */
const outraAba = () => new CanalFalso(CANAL_ADMIN)

beforeEach(async () => {
  CanalFalso.abertos = []
  // Uma classe nova a cada teste: como recarregar a página, a aba abre o canal de novo.
  vi.stubGlobal("BroadcastChannel", class extends CanalFalso {})
  reiniciarServidores()
  await clear()
})

describe("o canal entre abas", () => {
  test("avisar manda o segmento para as outras abas, no canal clickpedido-admin", () => {
    const outra = outraAba()
    const recebidos: unknown[] = []
    outra.addEventListener("message", (evento) => recebidos.push(evento.data))

    avisarOutrasAbas("pizzaria")

    expect(CANAL_ADMIN).toBe("clickpedido-admin")
    expect(recebidos).toEqual([{ segmento: "pizzaria" }])
  })

  test("ouvir recebe o segmento das outras abas até desligar", () => {
    const aoMudar = vi.fn()
    const desligar = ouvirOutrasAbas(aoMudar)
    const outra = outraAba()

    outra.postMessage({ segmento: "adega" })
    desligar()
    outra.postMessage({ segmento: "adega" })

    expect(aoMudar).toHaveBeenCalledTimes(1)
    expect(aoMudar).toHaveBeenCalledWith("adega")
  })

  test("sem BroadcastChannel no navegador, nada quebra", () => {
    vi.stubGlobal("BroadcastChannel", undefined)
    expect(() => avisarOutrasAbas("pizzaria")).not.toThrow()
    expect(() => ouvirOutrasAbas(vi.fn())()).not.toThrow()
  })
})

describe("o painel ao vivo", () => {
  test("o servidor do segmento avisa as outras abas quando grava", async () => {
    const outra = outraAba()
    const recebidos: unknown[] = []
    outra.addEventListener("message", (evento) => recebidos.push(evento.data))

    await servidorDo("lanchonete").mesas.criar({ numero: 90 })

    expect(recebidos.at(-1)).toEqual({ segmento: "lanchonete" })
  })

  test("o aviso esquece o servidor do segmento e invalida só as consultas dele", () => {
    const cliente = new QueryClient()
    cliente.setQueryData(["admin", "pizzaria", "mesas"], [])
    cliente.setQueryData(["admin", "adega", "mesas"], [])
    const esquecer = vi.spyOn(servidorDo("pizzaria"), "esquecer")
    const envolver = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    )
    renderHook(() => useAoVivo(), { wrapper: envolver })

    outraAba().postMessage({ segmento: "pizzaria" })

    expect(esquecer).toHaveBeenCalledTimes(1)
    expect(cliente.getQueryState(["admin", "pizzaria", "mesas"])?.isInvalidated).toBe(true)
    expect(cliente.getQueryState(["admin", "adega", "mesas"])?.isInvalidated).toBe(false)
  })
})
