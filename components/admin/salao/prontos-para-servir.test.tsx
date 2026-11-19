import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { ProntosParaServir } from "./prontos-para-servir"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const api = () => servidorDo("pizzaria")

/** Mesa nova com uma rodada de batata já pronta na cozinha. */
async function rodadaPronta(numero: number) {
  const mesa = await api().mesas.criar({ numero })
  const comanda = await api().mesas.lancar({
    mesaId: mesa.id,
    enviarParaCozinha: true,
    itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 2 }],
  })
  await api().cozinha.avancar(comanda.id, 1, "recebido")
  await api().cozinha.avancar(comanda.id, 1, "em-preparo")
  return comanda
}

/** Tira da demonstração o que já estava pronto, para o teste ver só o que criou. */
async function servirTudo() {
  for (const pedido of await api().pedidos.listar({ naCozinha: true })) {
    if (pedido.tipo !== "mesa") continue
    for (const rodada of new Set(pedido.itens.map((item) => item.rodada ?? 1))) {
      await api()
        .cozinha.servir(pedido.id, rodada)
        .catch(() => {})
    }
    for (const mensagem of pedido.mensagensCozinha ?? []) {
      await api().pedidos.verMensagem(pedido.id, mensagem.id)
    }
  }
}

function renderizar(intervalo = 60_000) {
  return render(
    <Provedores>
      <ProntosParaServir intervalo={intervalo} />
    </Provedores>,
  )
}

const faixa = () => screen.findByRole("region", { name: /^Prontos para servir/ }, { timeout: 8000 })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
  await servirTudo()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ProntosParaServir", () => {
  test("lista a rodada pronta da mesa; Servido tira da lista e da cozinha", async () => {
    const comanda = await rodadaPronta(71)
    const usuario = userEvent.setup()
    renderizar()

    const rodada = await within(await faixa()).findByRole("listitem", { name: /^Mesa 71/ })
    expect(rodada).toHaveTextContent("2× Batata")
    await usuario.click(within(rodada).getByRole("button", { name: "Servido" }))

    await waitFor(() => expect(screen.queryByRole("region", { name: /^Prontos/ })).toBeNull())
    const servida = await api().pedidos.buscar(comanda.id)
    expect(servida?.itens[0].servidoEm).toBe(new Date(2026, 10, 13, 20, 30).toISOString())
  })

  test("a rodada que não é a primeira diz qual é", async () => {
    const comanda = await rodadaPronta(72)
    await api().cozinha.servir(comanda.id, 1)
    const segunda = await api().mesas.lancar({
      mesaId: comanda.mesa?.id ?? "",
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Esfiha", preco: 6 }, quantidade: 1 }],
    })
    await api().cozinha.avancar(segunda.id, 2, "recebido")
    await api().cozinha.avancar(segunda.id, 2, "em-preparo")
    renderizar()

    expect(
      await within(await faixa()).findByRole("listitem", { name: "Mesa 72 · 2ª rodada" }),
    ).toHaveTextContent("1× Esfiha")
  })

  test("mensagem da cozinha aparece com Ok, e o Ok tira", async () => {
    const mesa = await api().mesas.criar({ numero: 73 })
    const comanda = await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 1 }],
    })
    await api().cozinha.avisar(comanda.id, 1, "duvida")
    const usuario = userEvent.setup()
    renderizar()

    const mensagem = await within(await faixa()).findByRole("listitem", {
      name: "Mesa 73: Dúvida no pedido, venha à cozinha",
    })
    await usuario.click(within(mensagem).getByRole("button", { name: "Ok" }))
    await waitFor(() => expect(screen.queryByRole("region", { name: /^Prontos/ })).toBeNull())
    const vista = await api().pedidos.buscar(comanda.id)
    expect(vista?.mensagensCozinha?.[0].vistaEm).toBeDefined()
  })

  test("sem nada pronto nem mensagem, a faixa não aparece", async () => {
    renderizar()
    await new Promise((pronto) => setTimeout(pronto, 50))
    expect(screen.queryByRole("region", { name: /^Prontos/ })).toBeNull()
  })

  test("rodada que fica pronta depois toca o alerta, se o som estiver ligado", async () => {
    const tocar = vi.fn()
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0
        destination = {}
        state = "running"
        createOscillator() {
          tocar()
          return {
            type: "sine",
            frequency: { setValueAtTime: () => {} },
            connect: (no: unknown) => no,
            start: () => {},
            stop: () => {},
          }
        }
        createGain() {
          return {
            gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            connect: (no: unknown) => no,
          }
        }
        resume() {}
      },
    )
    usePreferenciasFila.setState({ somLigado: true })
    await rodadaPronta(74)
    renderizar(200)
    await faixa()
    expect(tocar).not.toHaveBeenCalled()

    await rodadaPronta(75)
    await within(await faixa()).findByRole("listitem", { name: /^Mesa 75/ })
    expect(tocar).toHaveBeenCalled()
  })
})
