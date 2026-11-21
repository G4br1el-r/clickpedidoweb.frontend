import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PainelChamada } from "./painel-chamada"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const api = () => servidorDo("pizzaria")

/** Venda no balcão que vai para a cozinha (não concluída na hora). */
const vendaNoBalcao = (clienteNome?: string) =>
  api().pdv.finalizar({
    itens: [{ avulso: { nome: "Coxinha", preco: 8 }, quantidade: 1 }],
    pagamento: "pix",
    desconto: { modo: "reais", valor: 0 },
    concluida: false,
    ...(clienteNome ? { clienteNome } : {}),
  })

/** Web Audio de mentira: anota a frequência de cada nota tocada. */
function simularAudio() {
  const frequencias: number[] = []
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      destination = {}
      state = "suspended"
      createOscillator() {
        return {
          type: "sine",
          frequency: {
            setValueAtTime: (valor: number) => frequencias.push(valor),
            linearRampToValueAtTime: () => {},
          },
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
      async resume() {
        this.state = "running"
      }
    },
  )
  return frequencias
}

/** Leva a venda do balcão até pronto, como a cozinha faria. */
async function ficarPronto(id: number) {
  await api().pedidos.avancar(id, "recebido")
  await api().pedidos.avancar(id, "em-preparo")
}

function renderizar(intervalo = 60_000) {
  return render(
    <Provedores>
      <PainelChamada intervalo={intervalo} />
    </Provedores>,
  )
}

const coluna = async (nome: string) =>
  within(await screen.findByRole("region", { name: nome }, { timeout: 8000 }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PainelChamada", () => {
  test("preparando e pronto, com o número grande e só o primeiro nome", async () => {
    const preparando = await vendaNoBalcao("Maria Eduarda Silva")
    const pronto = await vendaNoBalcao("joão pedro")
    await ficarPronto(pronto.id)
    renderizar()

    const naCozinha = await coluna("Preparando")
    expect(await naCozinha.findByText(String(preparando.numero))).toBeInTheDocument()
    expect(naCozinha.getByText("Maria")).toBeInTheDocument()

    const prontos = await coluna("Pronto, pode retirar")
    expect(await prontos.findByText(String(pronto.numero))).toBeInTheDocument()
    expect(prontos.getByText("João")).toBeInTheDocument()
    expect(screen.queryByText(/Eduarda|Silva|Pedro/i)).not.toBeInTheDocument()
  })

  test("número que fica pronto toca o dim-dom e é anunciado; o que já estava pronto, não", async () => {
    const frequencias = simularAudio()
    const usuario = userEvent.setup()
    const antes = await vendaNoBalcao("Carla")
    await ficarPronto(antes.id)
    renderizar(200)
    await (await coluna("Pronto, pode retirar")).findByText(String(antes.numero))

    await usuario.click(screen.getByRole("button", { name: "Ligar o som da chamada" }))
    expect(screen.getByRole("button", { name: "Som da chamada ligado" })).toBeInTheDocument()
    expect(frequencias).toEqual([])

    const novo = await vendaNoBalcao("joão pedro")
    await ficarPronto(novo.id)
    expect(
      await screen.findByText(`Pedido ${novo.numero}, João: pronto, pode retirar.`, undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument()
    await waitFor(() => expect(frequencias).toEqual([659.3, 523.3]))
  })

  test("coluna vazia diz o que vai aparecer ali", async () => {
    // O salão não tem retirada: as duas colunas ficam vazias.
    useSegmentoAtual.setState({ segmento: "salao" })
    renderizar()
    expect(
      (await coluna("Preparando")).getByText("Os pedidos do balcão aparecem aqui."),
    ).toBeInTheDocument()
    expect(
      (await coluna("Pronto, pode retirar")).getByText(
        "Quando o seu ficar pronto, o número aparece aqui.",
      ),
    ).toBeInTheDocument()
  })
})

describe("PainelChamada na lanchonete", () => {
  test("chama pelo número do mês, o mesmo do cupom: recomeça do 1 a cada mês", async () => {
    useSegmentoAtual.setState({ segmento: "lanchonete" })
    const lanchonete = servidorDo("lanchonete")
    const venda = await lanchonete.pdv.finalizar({
      itens: [{ avulso: { nome: "X-salada", preco: 22 }, quantidade: 1 }],
      pagamento: "pix",
      desconto: { modo: "reais", valor: 0 },
      concluida: false,
      clienteNome: "Rafael Lima",
    })
    // Numeração mensal: o número é pequeno, não o id que corre desde o começo.
    expect(venda.numero).toBeLessThan(venda.id)
    renderizar()
    expect(
      await (await coluna("Preparando")).findByText(String(venda.numero)),
    ).toBeInTheDocument()
  })
})
