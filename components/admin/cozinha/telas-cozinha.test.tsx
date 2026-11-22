import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useConfig } from "@/lib/admin/config"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { ChamadaCozinha } from "./chamada-cozinha"
import { TvCozinha } from "./tv-cozinha"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const api = () => servidorDo("pizzaria")
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

/** AudioContext de mentira: anota a frequência de cada nota. */
function simularAudio() {
  const notas: number[] = []
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      destination = {}
      state = "running"
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: (valor: number) => notas.push(valor) },
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
  return { chamada: () => notas.filter((nota) => nota === 783.99).length }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
  useConfig.setState({ pro: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useConfig.setState({ pro: false, compradas: [] })
})

describe("TvCozinha", () => {
  test("só leitura, em letra grande, e pagina sozinha quando não cabe", async () => {
    for (const numero of [40, 41, 42, 43]) {
      const mesa = await api().mesas.criar({ numero })
      await api().mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: true,
        itens: [{ avulso: { nome: "Porção", preco: 20 }, quantidade: 1 }],
      })
    }
    render(
      <Provedores>
        <TvCozinha porColuna={2} trocaDePagina={1000} />
      </Provedores>,
    )
    const tv = within(await screen.findByRole("main", { name: "Cozinha na TV" }, { timeout: 8000 }))
    const aFazer = within(await tv.findByRole("region", { name: /^A fazer/ }, { timeout: 8000 }))
    expect(aFazer.getAllByRole("article")).toHaveLength(2)
    expect(tv.queryAllByRole("button")).toHaveLength(0)
    const pagina = tv.getByText(/^Página 1 de \d+$/)
    const primeira = aFazer.getAllByRole("article")[0].getAttribute("aria-label")

    await waitFor(() => expect(pagina).toHaveTextContent(/^Página 2 de \d+$/), { timeout: 3000 })
    expect(aFazer.getAllByRole("article")[0].getAttribute("aria-label")).not.toBe(primeira)
  })

  test("sem o Pro, o cadeado com o preço e o Contratar", async () => {
    useConfig.setState({ pro: false, compradas: [] })
    const usuario = userEvent.setup()
    render(
      <Provedores>
        <TvCozinha />
      </Provedores>,
    )
    await usuario.click(await screen.findByRole("button", { name: /^Contratar o Modo TV/ }))
    expect(
      await screen.findByRole("main", { name: "Cozinha na TV" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(useConfig.getState().compradas).toContain("cozinha.tv")
  })
})

describe("ChamadaCozinha", () => {
  test("os números da retirada em Preparando e Pode retirar; o que fica pronto toca a chamada", async () => {
    const som = simularAudio()
    usePreferenciasFila.setState({ somLigado: true })
    // Venda de balcão que vai para a cozinha: uma retirada.
    const [lanche] = (await api().produtos.listar()).filter(
      (produto) => produto.grupos.length === 0 && produto.disponivel,
    )
    const retirada = await api().pdv.finalizar({
      itens: [{ produtoId: lanche.id, escolhas: {}, quantidade: 1 }],
      pagamento: "pix",
      desconto: { modo: "reais", valor: 0 },
      concluida: false,
    })
    await api().cozinha.avancar(retirada.id, 1, "recebido")
    render(
      <Provedores>
        <ChamadaCozinha intervalo={100} />
      </Provedores>,
    )
    const preparando = within(
      await screen.findByRole("region", { name: "Preparando" }, { timeout: 8000 }),
    )
    expect(preparando.getByText(String(retirada.numero))).toBeInTheDocument()
    await esperar(300)
    expect(som.chamada()).toBe(0)

    await act(async () => {
      await api().cozinha.avancar(retirada.id, 1, "em-preparo")
    })
    const prontos = within(screen.getByRole("region", { name: "Pode retirar" }))
    expect(
      await prontos.findByText(String(retirada.numero), {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    await waitFor(() => expect(som.chamada()).toBe(1))
  })
})
