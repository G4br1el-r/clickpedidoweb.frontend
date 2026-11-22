import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaGarcom } from "./pagina-garcom"

vi.mock("react-to-print", () => ({ useReactToPrint: () => () => {} }))

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={cliente}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const api = () => servidorDo("pizzaria")

/** A pizzaria da demonstração cobra taxa e couvert: aqui o teste confere só a soma dos itens. */
async function semTaxaNemCouvert(api: ReturnType<typeof servidorDo>) {
  const salao = await api.salao.config()
  await api.salao.salvar({
    ...salao,
    taxaServico: { ...salao.taxaServico, ativa: false },
    couvert: { ...salao.couvert, ativo: false },
  })
}

async function produtos() {
  const lista = await api().produtos.listar()
  const simples = lista.find(
    (produto) => produto.grupos.length === 0 && produto.disponivel,
  ) as Produto
  const comOpcoes = lista.find(
    (produto) =>
      produto.disponivel &&
      produto.grupos.length === 1 &&
      produto.grupos[0].minimo === 1 &&
      produto.grupos[0].maximo === 1,
  ) as Produto
  return { simples, comOpcoes }
}

/** Cartão do catálogo pelo texto: rápido, sem calcular o nome acessível de todos. */
const botao = (nome: string) => {
  const cartao = within(screen.getByRole("list", { name: "Produtos" }))
    .getByText(nome, { exact: false, selector: "span" })
    .closest("button")
  if (!cartao) throw new Error(`Cartão de ${nome} não encontrado`)
  return cartao
}

function renderizar() {
  return render(
    <Provedores>
      <PaginaGarcom />
    </Provedores>,
  )
}

async function abrir() {
  telaGrande()
  const usuario = userEvent.setup()
  renderizar()
  await within(
    await screen.findByRole("list", { name: "Produtos" }, { timeout: 8000 }),
  ).findAllByRole("listitem")
  return usuario
}

async function escolherMesa(usuario: ReturnType<typeof userEvent.setup>, numero: number) {
  await usuario.click(await screen.findByRole("combobox", { name: "Mesa" }))
  await usuario.click(await screen.findByRole("option", { name: new RegExp(`^Mesa ${numero}\\b`) }))
}

const bandeja = () => within(screen.getByRole("region", { name: "Bandeja" }))

async function comandaDa(mesaId: string) {
  const mesa = (await api().mesas.listar()).find((item) => item.id === mesaId)
  return mesa?.pedidoAtivoId ? api().pedidos.buscar(mesa.pedidoAtivoId) : undefined
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useGarcom.setState(useGarcom.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PaginaGarcom", () => {
  test("a mesa bloqueada não aparece para escolher", async () => {
    const mesas = await api().mesas.listar()
    const bloqueada = mesas.find((mesa) => mesa.bloqueio)
    if (!bloqueada) throw new Error("A demonstração devia ter uma mesa bloqueada")
    const usuario = await abrir()
    await usuario.click(await screen.findByRole("combobox", { name: "Mesa" }))
    const opcoes = await screen.findAllByRole("option")
    expect(opcoes.length).toBe(mesas.length - 1)
    expect(
      screen.queryByRole("option", { name: new RegExp(`^Mesa ${bloqueada.numero}\\b`) }),
    ).not.toBeInTheDocument()
  })

  test("a mesa reservada diz a hora da reserva na lista (Fase 7)", async () => {
    const usuario = await abrir()
    await usuario.click(await screen.findByRole("combobox", { name: "Mesa" }))
    expect(await screen.findByRole("option", { name: "Mesa 13 · reservada 20:50" })).toBeVisible()
  })

  test("sem mesa não dá para lançar", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    expect(bandeja().getByRole("button", { name: "Enviar para a cozinha" })).toBeDisabled()
    expect(bandeja().getByText("Escolha a mesa.")).toBeInTheDocument()
  })

  test("cada toque avisa o que entrou na bandeja, e a bandeja diz para qual mesa vai", async () => {
    await api().mesas.criar({ numero: 73 })
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    expect(bandeja().getByRole("status")).toHaveTextContent(`${simples.nome}: 1 na bandeja`)
    await usuario.click(botao(simples.nome))
    expect(bandeja().getByRole("status")).toHaveTextContent(`${simples.nome}: 2 na bandeja`)

    await escolherMesa(usuario, 73)
    expect(bandeja().getByRole("heading", { name: /Mesa 73/ })).toBeInTheDocument()
  })

  test("monta a bandeja e envia para a cozinha com garçom e cliente", async () => {
    const mesa = await api().mesas.criar({ numero: 70 })
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.type(screen.getByRole("textbox", { name: "Seu nome" }), "Rafa")
    await escolherMesa(usuario, 70)
    await usuario.type(screen.getByRole("textbox", { name: "Cliente" }), "Léo")
    await usuario.click(botao(simples.nome))
    await usuario.click(botao(simples.nome))
    const item = within(bandeja().getByRole("listitem", { name: simples.nome }))
    expect(item.getByText("2")).toBeInTheDocument()

    await usuario.click(bandeja().getByRole("button", { name: "Enviar para a cozinha" }))
    expect(await screen.findByText("Mesa 70: enviado para a cozinha.")).toBeInTheDocument()
    expect(bandeja().getByText("Toque nos produtos para montar a rodada.")).toBeInTheDocument()

    const comanda = await comandaDa(mesa.id)
    expect(comanda).toMatchObject({
      status: "recebido",
      cliente: { nome: "Léo" },
      mesa: { numero: 70, garcom: "Rafa" },
    })
    expect(comanda?.itens).toMatchObject([
      { produtoId: simples.id, quantidade: 2, vaiParaCozinha: true },
    ])
  })

  test("produto com opções passa pela janela; lançar na mesa não vai para a cozinha", async () => {
    const mesa = await api().mesas.criar({ numero: 71 })
    const usuario = await abrir()
    const { comOpcoes } = await produtos()
    const [grupo] = comOpcoes.grupos
    const [opcao] = grupo.itens
    await escolherMesa(usuario, 71)

    await usuario.click(botao(comOpcoes.nome))
    const janela = within(screen.getByRole("dialog", { name: `Opções de ${comOpcoes.nome}` }))
    await usuario.click(janela.getByRole("radio", { name: new RegExp(`^${opcao.nome}`) }))
    await usuario.click(janela.getByRole("button", { name: /^Adicionar · / }))
    expect(bandeja().getByRole("listitem", { name: comOpcoes.nome })).toHaveTextContent(
      `${grupo.nome}: ${opcao.nome}`,
    )

    await usuario.click(bandeja().getByRole("button", { name: "Lançar na mesa" }))
    expect(await screen.findByText("Mesa 71: lançado na comanda.")).toBeInTheDocument()
    const comanda = await comandaDa(mesa.id)
    expect(comanda?.status).toBe("pronto")
    expect(comanda?.itens).toMatchObject([
      { produtoId: comOpcoes.id, opcoes: [`${grupo.nome}: ${opcao.nome}`], vaiParaCozinha: false },
    ])
  })

  test("na mesa ocupada, mostra a comanda e a rodada nova se soma a ela", async () => {
    await semTaxaNemCouvert(api())
    const mesa = await api().mesas.criar({ numero: 72 })
    await api().mesas.lancar({
      mesaId: mesa.id,
      clienteNome: "Júlia",
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    const usuario = await abrir()
    const { simples } = await produtos()
    await escolherMesa(usuario, 72)
    expect(await screen.findByText(/Júlia · 1 item · R\$\s4,00/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Cliente" })).not.toBeInTheDocument()

    await usuario.click(botao(simples.nome))
    await usuario.click(bandeja().getByRole("button", { name: "Lançar na mesa" }))
    expect(await screen.findByText(/Júlia · 2 itens/)).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Ver comanda" }))
    const comanda = within(await screen.findByRole("dialog", { name: /^Mesa 72/ }))
    expect(comanda.getByRole("listitem", { name: "Água" })).toBeInTheDocument()
    expect(comanda.getByRole("listitem", { name: simples.nome })).toBeInTheDocument()
  })

  test("na mesa juntada, mostra a principal: sem Cliente, o resumo da comanda dela e o aviso com as duas", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(await screen.findByRole("combobox", { name: "Mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 16 · com a mesa 15" }))

    // A comanda da 15 na demonstração: 6 pessoas, R$ 150,30.
    expect(await screen.findByText(/R\$\s150,30/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Cliente" })).not.toBeInTheDocument()

    await usuario.click(botao(simples.nome))
    await usuario.click(bandeja().getByRole("button", { name: "Lançar na mesa" }))
    expect(await screen.findByText("Mesa 15 + 16: lançado na comanda.")).toBeInTheDocument()
  })

  test("os garçons ativos do salão aparecem para tocar e preencher Seu nome", async () => {
    const usuario = await abrir()
    const garcons = within(await screen.findByRole("group", { name: "Garçons do salão" }))
    expect(garcons.getAllByRole("button").map((botao) => botao.textContent)).toEqual([
      "Lucas",
      "Paula",
      "Rafa",
      "Bia",
    ])
    await usuario.click(garcons.getByRole("button", { name: "Bia" }))
    expect(screen.getByRole("textbox", { name: "Seu nome" })).toHaveValue("Bia")
    expect(garcons.getByRole("button", { name: "Bia" })).toHaveAttribute("aria-pressed", "true")
  })

  test("o nome digitado sem acento ou em minúsculas marca o garçom da lista", async () => {
    const usuario = await abrir()
    const garcons = within(await screen.findByRole("group", { name: "Garçons do salão" }))
    await usuario.type(screen.getByRole("textbox", { name: "Seu nome" }), " rafa ")
    expect(garcons.getByRole("button", { name: "Rafa" })).toHaveAttribute("aria-pressed", "true")
  })

  test("o nome do garçom fica guardado neste aparelho", async () => {
    const usuario = await abrir()
    await usuario.type(screen.getByRole("textbox", { name: "Seu nome" }), "Rafa")
    await waitFor(() => expect(localStorage.getItem("clickpedido-admin-garcom")).toContain("Rafa"))

    // Reabrir o aparelho: a memória zera, o que ficou guardado volta.
    const guardado = localStorage.getItem("clickpedido-admin-garcom") as string
    useGarcom.setState(useGarcom.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-garcom", guardado)
    await useGarcom.persist.rehydrate()
    expect(useGarcom.getState().nome).toBe("Rafa")
  })
})
