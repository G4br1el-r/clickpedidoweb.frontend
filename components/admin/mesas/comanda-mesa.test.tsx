import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

vi.mock("react-to-print", () => ({ useReactToPrint: () => () => {} }))

// Cada teste monta a tela de mesas inteira e passa por várias janelas: 5 s é pouco com a máquina ocupada.
vi.setConfig({ testTimeout: 15_000 })

function Provedores({ children, endereco }: { children: ReactNode; endereco?: string }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={endereco}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const api = () => servidorDo("pizzaria")

/** Abre a tela de mesas já com a gaveta da mesa `numero` (pelo endereço). */
async function abrirMesa(numero: number) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={`?mesa=${numero}`}>
      <PaginaMesas />
    </Provedores>,
  )
  const gaveta = await screen.findByRole(
    "dialog",
    { name: new RegExp(`^Mesa ${numero}\\b`) },
    {
      timeout: 8000,
    },
  )
  return { usuario, gaveta: within(gaveta) }
}

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useGarcom.setState(useGarcom.getInitialState(), true)
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ComandaMesa: abrir a mesa", () => {
  test("a mesa livre 11 pergunta pessoas, garçom e cliente, e abre com a comanda vazia", async () => {
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(gaveta.getByRole("combobox", { name: "Garçom" }))
    await usuario.click(await screen.findByRole("option", { name: "Bia" }))
    await usuario.type(gaveta.getByRole("textbox", { name: "Cliente (opcional)" }), "Carla")
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesa" }))

    expect(await screen.findByText("Mesa 11 aberta.")).toBeInTheDocument()
    expect(await gaveta.findByText(/A comanda está vazia/)).toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await cartao(11)).toHaveTextContent("Ocupada")
    expect(await cartao(11)).toHaveTextContent("2 pessoas")
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
    const comanda = await api().pedidos.buscar(mesa?.pedidoAtivoId ?? 0)
    expect(comanda).toMatchObject({
      cliente: { nome: "Carla" },
      mesa: { garcom: "Bia", pessoas: 2 },
    })
  })

  test("mais pessoas que lugares avisa e deixa abrir", async () => {
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "3")
    expect(gaveta.getByText("A mesa 11 tem 2 lugares.")).toBeInTheDocument()
    await usuario.clear(gaveta.getByRole("spinbutton", { name: "Pessoas" }))
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    expect(gaveta.queryByText("A mesa 11 tem 2 lugares.")).not.toBeInTheDocument()
  })

  test("sem pessoas ou sem garçom, Abrir mesa diz o que falta e não abre", async () => {
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesa" }))
    expect(gaveta.getByText("Informe de 1 a 99 pessoas.")).toBeInTheDocument()
    expect(gaveta.getByText("Escolha o garçom.")).toBeInTheDocument()
    expect(gaveta.getByRole("spinbutton", { name: "Pessoas" })).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesa" }))
    expect(gaveta.queryByText("Informe de 1 a 99 pessoas.")).not.toBeInTheDocument()
    expect(gaveta.getByText("Escolha o garçom.")).toBeInTheDocument()
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
    expect(mesa?.status).toBe("livre")
  })

  test("sem garçons no salão, não há o campo Garçom e a mesa abre sem garçom", async () => {
    const salao = await api().salao.config()
    await api().salao.salvar({ ...salao, garcons: [] })
    const { usuario, gaveta } = await abrirMesa(11)
    expect(gaveta.queryByRole("combobox", { name: "Garçom" })).not.toBeInTheDocument()
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesa" }))
    expect(await screen.findByText("Mesa 11 aberta.")).toBeInTheDocument()
  })

  test("o cliente aceita até 80 letras, como o servidor", async () => {
    const { gaveta } = await abrirMesa(11)
    expect(gaveta.getByRole("textbox", { name: "Cliente (opcional)" })).toHaveAttribute(
      "maxLength",
      "80",
    )
  })

  test("a mesa em limpeza oferece Marcar limpa e também Abrir mesa", async () => {
    const { gaveta } = await abrirMesa(9)
    expect(gaveta.getByRole("button", { name: "Marcar limpa" })).toBeInTheDocument()
    expect(gaveta.getByRole("button", { name: "Abrir mesa" })).toBeInTheDocument()
  })

  test("o garçom guardado neste aparelho já vem marcado", async () => {
    useGarcom.setState({ nome: "Rafa" })
    const { gaveta } = await abrirMesa(11)
    expect(gaveta.getByRole("combobox", { name: "Garçom" })).toHaveTextContent("Rafa")
  })
})

describe("ComandaMesa: adicionar itens", () => {
  async function produtoSimples() {
    const lista = await api().produtos.listar()
    return lista.find((produto) => produto.grupos.length === 0 && produto.disponivel) as Produto
  }

  test("Adicionar itens abre o catálogo com a bandeja; enviar para a cozinha lança a rodada", async () => {
    const { simples } = { simples: await produtoSimples() }
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
    await api().mesas.abrir(mesa?.id ?? "", { pessoas: 2, garcom: "Bia" })
    const { usuario, gaveta } = await abrirMesa(11)

    await usuario.click(await gaveta.findByRole("button", { name: "Adicionar itens" }))
    const janela = within(await screen.findByRole("dialog", { name: "Adicionar itens · Mesa 11" }))
    const cartaoProduto = within(janela.getByRole("list", { name: "Produtos" }))
      .getByText(simples.nome, { exact: false, selector: "span" })
      .closest("button") as HTMLButtonElement
    await usuario.click(cartaoProduto)
    const bandeja = within(janela.getByRole("region", { name: "Bandeja" }))
    expect(bandeja.getByRole("listitem", { name: simples.nome })).toBeInTheDocument()
    await usuario.click(bandeja.getByRole("button", { name: "Enviar para a cozinha" }))

    expect(await screen.findByText("Mesa 11: enviado para a cozinha.")).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Adicionar itens · Mesa 11" }),
      ).not.toBeInTheDocument(),
    )
    expect(await gaveta.findByRole("listitem", { name: simples.nome })).toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(async () => expect(await cartao(11)).toHaveAccessibleDescription(/^Na cozinha/))
  })

  test("adicionar itens na mesa 1, que pediu a conta, avisa que ela voltou para Ocupada", async () => {
    const simples = await produtoSimples()
    const { usuario, gaveta } = await abrirMesa(1)
    await usuario.click(await gaveta.findByRole("button", { name: "Adicionar itens" }))
    const janela = within(await screen.findByRole("dialog", { name: "Adicionar itens · Mesa 1" }))
    const cartaoProduto = within(janela.getByRole("list", { name: "Produtos" }))
      .getByText(simples.nome, { exact: false, selector: "span" })
      .closest("button") as HTMLButtonElement
    await usuario.click(cartaoProduto)
    await usuario.click(
      within(janela.getByRole("region", { name: "Bandeja" })).getByRole("button", {
        name: "Lançar na mesa",
      }),
    )
    expect(
      await screen.findByText("A mesa 1 tinha pedido a conta e voltou para Ocupada."),
    ).toBeInTheDocument()
  })
})

/** Mesa 11 aberta com um Suco só lançado e uma Pizza que a cozinha já está preparando. */
async function mesa11ComPizzaEmPreparo() {
  const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
  const mesaId = mesa?.id ?? ""
  await api().mesas.abrir(mesaId, { pessoas: 2, garcom: "Bia" })
  await api().mesas.lancar({
    mesaId,
    enviarParaCozinha: false,
    itens: [{ avulso: { nome: "Suco", preco: 9.5 }, quantidade: 1 }],
  })
  const comanda = await api().mesas.lancar({
    mesaId,
    enviarParaCozinha: true,
    itens: [{ avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 }],
  })
  await api().pedidos.avancar(comanda.id, "recebido")
  return comanda
}

describe("ComandaMesa: editar, tirar e cancelar", () => {
  test("Editar no item que a cozinha não preparou troca a observação", async () => {
    await mesa11ComPizzaEmPreparo()
    const { usuario, gaveta } = await abrirMesa(11)
    const suco = within(await gaveta.findByRole("listitem", { name: "Suco" }))
    await usuario.click(suco.getByRole("button", { name: "Editar" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar Suco" }))
    await usuario.type(janela.getByRole("textbox", { name: "Observação" }), "Sem gelo")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))

    expect(await suco.findByText("“Sem gelo”")).toBeInTheDocument()
  })

  test("o item que a cozinha já preparou não tem Editar e não aumenta", async () => {
    await mesa11ComPizzaEmPreparo()
    const { gaveta } = await abrirMesa(11)
    const pizza = within(await gaveta.findByRole("listitem", { name: "Pizza" }))
    expect(pizza.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
    expect(pizza.getByRole("button", { name: "Mais um" })).toBeDisabled()
  })

  test("Cancelar comanda, na aba Conta, pede o motivo e deixa a mesa livre", async () => {
    await mesa11ComPizzaEmPreparo()
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.click(await gaveta.findByRole("tab", { name: "Conta" }))
    await usuario.click(gaveta.getByRole("button", { name: "Cancelar comanda" }))
    const pergunta = within(
      await screen.findByRole("alertdialog", { name: "Cancelar a comanda da mesa 11?" }),
    )
    const confirmar = pergunta.getByRole("button", { name: "Cancelar comanda" })
    expect(confirmar).toBeDisabled()
    await usuario.type(pergunta.getByRole("textbox", { name: "Motivo" }), "Cliente foi embora")
    await usuario.click(confirmar)

    expect(await screen.findByText("Comanda da mesa 11 cancelada.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await cartao(11)).toHaveTextContent("Livre")
  })
})

describe("ComandaMesa: servir, pedir a conta e histórico", () => {
  test("a mesa em Servir mostra Marcar servido; ao marcar, o botão some", async () => {
    const comanda = await mesa11ComPizzaEmPreparo()
    await api().pedidos.avancar(comanda.id, "em-preparo")
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.click(await gaveta.findByRole("button", { name: "Marcar servido" }))

    expect(await screen.findByText("Mesa 11 servida.")).toBeInTheDocument()
    await waitFor(() =>
      expect(gaveta.queryByRole("button", { name: "Marcar servido" })).not.toBeInTheDocument(),
    )
    expect((await api().pedidos.buscar(comanda.id))?.servirDesde).toBeUndefined()
  })

  test("o menu ⋯ da mesa em Servir tem Marcar servido", async () => {
    const comanda = await mesa11ComPizzaEmPreparo()
    await api().pedidos.avancar(comanda.id, "em-preparo")
    const { usuario } = await abrirMesa(11)
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 11" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Marcar servido" }))

    expect(await screen.findByText("Mesa 11 servida.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(11)).toHaveAccessibleDescription(/^Ocupada/))
  })

  test("Pediu a conta, na aba Conta, deixa o cartão em Pediu a conta", async () => {
    await mesa11ComPizzaEmPreparo()
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.click(await gaveta.findByRole("tab", { name: "Conta" }))
    await usuario.click(gaveta.getByRole("button", { name: "Pediu a conta" }))

    expect(await screen.findByText("Mesa 11 pediu a conta.")).toBeInTheDocument()
    expect(gaveta.queryByRole("button", { name: "Pediu a conta" })).not.toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(async () =>
      expect(await cartao(11)).toHaveAccessibleDescription(/^Pediu a conta/),
    )
  })

  test("a aba Histórico lista os eventos do mais novo para o mais antigo, com hora e garçom", async () => {
    await mesa11ComPizzaEmPreparo()
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.click(await gaveta.findByRole("tab", { name: "Histórico" }))
    const linhas = within(gaveta.getByRole("list", { name: "Histórico da comanda" }))
      .getAllByRole("listitem")
      .map((linha) => linha.textContent)
    expect(linhas).toEqual([
      "20:30Rodada 2 para a cozinha: 1× Pizza",
      "20:30Rodada 1 lançada na mesa: 1× Suco",
      "20:30Mesa aberta para 2 pessoas · Bia",
    ])
  })

  test("a comanda antiga, sem eventos, diz que não há histórico", async () => {
    const { usuario, gaveta } = await abrirMesa(1)
    await usuario.click(await gaveta.findByRole("tab", { name: "Histórico" }))
    expect(gaveta.getByText("Sem histórico registrado.")).toBeInTheDocument()
  })
})
