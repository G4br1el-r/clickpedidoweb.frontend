import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaPdv } from "./pagina-pdv"

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

/** Computador: catálogo e caixa lado a lado. */
function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

async function produtos() {
  const lista = await servidorDo("pizzaria").produtos.listar()
  const simples = lista.find(
    (produto) => produto.grupos.length === 0 && produto.disponivel,
  ) as Produto
  const comOpcoes = lista.find((produto) =>
    produto.grupos.some(
      (grupo) => grupo.minimo >= 1 && grupo.itens.some((item) => item.precoAdicional > 0),
    ),
  ) as Produto
  return { simples, comOpcoes }
}

/** Sem caracteres especiais de expressão regular no nome do produto. */
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Cartão do catálogo pelo nome do produto. Achar pelo texto é rápido; calcular o nome
 * acessível de 120 cartões a cada busca deixaria o teste lento. O nome falado
 * ("Adicionar" + nome + preço) é conferido pelo axe no E2E.
 */
const botao = (nome: string) => {
  const cartao = within(screen.getByRole("list", { name: "Produtos" }))
    .getByText(nome, { exact: false, selector: "span" })
    .closest("button")
  if (!cartao) throw new Error(`Cartão de ${nome} não encontrado`)
  return cartao
}

async function abrir() {
  telaGrande()
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaPdv />
    </Provedores>,
  )
  await screen.findByRole("searchbox", { name: "Buscar no cardápio" })
  await within(
    await screen.findByRole("list", { name: "Produtos" }, { timeout: 8000 }),
  ).findAllByRole("listitem")
  return usuario
}

const caixa = () => within(screen.getByRole("region", { name: "Venda" }))

/** Item avulso: o único com preço digitado. */
async function incluirAvulso(
  usuario: ReturnType<typeof userEvent.setup>,
  nome: string,
  valor: string,
) {
  await usuario.click(screen.getByRole("button", { name: "Lançar item avulso" }))
  await usuario.type(screen.getByRole("textbox", { name: "Item avulso" }), nome)
  await usuario.type(screen.getByRole("textbox", { name: "Valor" }), valor)
  await usuario.click(screen.getByRole("button", { name: "Incluir item avulso" }))
}

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

describe("PaginaPdv", () => {
  test("produto sem opções entra com um toque e soma no segundo", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    await usuario.click(botao(simples.nome))

    const item = within(caixa().getByRole("listitem", { name: simples.nome }))
    expect(item.getByRole("spinbutton", { name: "Quantidade" })).toHaveValue(2)
  })

  test("estoque no mínimo mostra quantos restam; com folga, nada", async () => {
    const { simples } = await produtos()
    const api = servidorDo("pizzaria").estoque
    await api.configurar(simples.id, { controlar: true, minimo: 5, esgotarAoZerar: true })
    await api.contagem(simples.id, { contado: 3 })
    const { comOpcoes } = await produtos()
    await api.configurar(comOpcoes.id, { controlar: true, minimo: 5, esgotarAoZerar: true })
    await api.contagem(comOpcoes.id, { contado: 40 })
    await abrir()
    expect(botao(simples.nome)).toHaveTextContent("Restam 3")
    expect(botao(comOpcoes.nome)).not.toHaveTextContent("Restam")
  })

  test("produto com opções pede o mínimo e cobra o adicional", async () => {
    const usuario = await abrir()
    const { comOpcoes } = await produtos()
    const grupo = comOpcoes.grupos.find((g) => g.minimo >= 1) as Produto["grupos"][number]
    const caro = grupo.itens.find(
      (item) => item.precoAdicional > 0,
    ) as Produto["grupos"][number]["itens"][number]

    await usuario.click(botao(comOpcoes.nome))
    const janela = within(screen.getByRole("dialog", { name: `Opções de ${comOpcoes.nome}` }))
    await usuario.click(janela.getByRole("button", { name: /^Adicionar · / }))
    expect(janela.getAllByText(/^Escolha /).length).toBeGreaterThan(0)

    for (const obrigatorio of comOpcoes.grupos.filter((g) => g.minimo >= 1)) {
      const escolha = obrigatorio.id === grupo.id ? caro : obrigatorio.itens[0]
      // Grupos diferentes podem ter opções com o mesmo nome (1º e 2º sabor).
      const doGrupo = within(
        janela.getByRole("group", { name: new RegExp(`^${escapar(obrigatorio.nome)}`) }),
      )
      await usuario.click(
        doGrupo.getByRole(obrigatorio.maximo === 1 ? "radio" : "checkbox", {
          name: new RegExp(`^${escapar(escolha.nome)}`),
        }),
      )
    }
    await usuario.click(janela.getByRole("button", { name: /^Adicionar · / }))

    const item = caixa().getByRole("listitem", { name: comOpcoes.nome })
    expect(item).toHaveTextContent(`${grupo.nome}: ${caro.nome}`)

    // As escolhas vão para o servidor, que calcula o preço e fecha a venda.
    await usuario.click(caixa().getByRole("radio", { name: "Pix" }))
    await usuario.click(caixa().getByRole("button", { name: /Finalizar venda/ }))
    const ticket = await screen.findByRole("dialog", { name: /^Venda #\d+/ })
    expect(ticket).toHaveTextContent(`* ${grupo.nome}: ${caro.nome}`)
  })

  test("o item do cardápio tem o preço calculado; o avulso tem o preço digitado", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    const doCardapio = within(caixa().getByRole("listitem", { name: simples.nome }))
    expect(doCardapio.queryByRole("textbox", { name: "Preço unitário" })).not.toBeInTheDocument()
    expect(doCardapio.getByText("Preço do cardápio")).toBeInTheDocument()

    await usuario.click(caixa().getByRole("button", { name: `Remover ${simples.nome}` }))
    await incluirAvulso(usuario, "Taxa de serviço", "5")
    const preco = within(caixa().getByRole("listitem", { name: "Taxa de serviço" })).getByRole(
      "textbox",
      { name: "Preço unitário" },
    )
    await usuario.clear(preco)
    await usuario.type(preco, "10")
    expect(caixa().getByText("Total").closest("div")).toHaveTextContent("R$ 10,00")
  })

  test("limpar a venda pede confirmação", async () => {
    const usuario = await abrir()
    await incluirAvulso(usuario, "Taxa de serviço", "10")
    await usuario.click(caixa().getByRole("button", { name: "Limpar venda" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Limpar a venda?" })).getByRole("button", {
        name: "Limpar",
      }),
    )
    expect(caixa().getByText("Nenhum item na venda.")).toBeInTheDocument()
  })

  test("apagar a quantidade não volta para 1 enquanto digita; ao sair do campo, volta", async () => {
    const usuario = await abrir()
    await incluirAvulso(usuario, "Taxa de serviço", "10")
    const quantidade = within(caixa().getByRole("listitem", { name: "Taxa de serviço" })).getByRole(
      "spinbutton",
      { name: "Quantidade" },
    )
    await usuario.clear(quantidade)
    expect(quantidade).toHaveValue(null)
    await usuario.type(quantidade, "3")
    expect(quantidade).toHaveValue(3)
    expect(caixa().getByText("Total").closest("div")).toHaveTextContent("R$ 30,00")

    await usuario.clear(quantidade)
    await usuario.tab()
    expect(quantidade).toHaveValue(1)
    expect(caixa().getByText("Total").closest("div")).toHaveTextContent("R$ 10,00")
  })

  test("o ticket do dinheiro mostra o recebido e o troco", async () => {
    const usuario = await abrir()
    await incluirAvulso(usuario, "Taxa de serviço", "40")
    await usuario.click(caixa().getByRole("radio", { name: "Dinheiro" }))
    await usuario.click(caixa().getByRole("button", { name: "R$ 50" }))
    await usuario.click(caixa().getByRole("button", { name: /Finalizar venda/ }))
    const ticket = await screen.findByRole("dialog", { name: /^Venda #\d+/ })
    expect(ticket).toHaveTextContent("Dinheiro · PAGO · recebido R$ 50,00 · troco R$ 10,00")
  })

  test("desconto de 10%, troco e o que falta no dinheiro", async () => {
    const usuario = await abrir()
    await incluirAvulso(usuario, "Taxa de serviço", "40")
    await usuario.click(caixa().getByRole("button", { name: "10%" }))
    expect(caixa().getByText("Total").closest("div")).toHaveTextContent("R$ 36,00")

    await usuario.click(caixa().getByRole("radio", { name: "Dinheiro" }))
    const recebido = caixa().getByRole("textbox", { name: "Valor recebido" })
    await usuario.type(recebido, "30")
    expect(caixa().getByText("Faltam R$ 6,00")).toBeInTheDocument()
    expect(caixa().getByRole("button", { name: /Finalizar venda/ })).toBeDisabled()

    await usuario.click(caixa().getByRole("button", { name: "R$ 50" }))
    expect(caixa().getByText("Troco: R$ 14,00")).toBeInTheDocument()
  })

  test("finalizar mostra o ticket, limpa a caixa e entra nas últimas vendas", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    await usuario.click(caixa().getByRole("radio", { name: "Pix" }))
    await usuario.click(caixa().getByRole("button", { name: /Finalizar venda/ }))

    const ticket = await screen.findByRole("dialog", { name: /^Venda #\d+/ })
    expect(ticket).toHaveTextContent(simples.nome)
    const numero = within(ticket).getByRole("heading").textContent?.match(/#\d+/)?.[0]

    await usuario.click(within(ticket).getByRole("button", { name: "Nova venda" }))
    expect(caixa().getByText("Nenhum item na venda.")).toBeInTheDocument()
    expect(await screen.findByRole("row", { name: new RegExp(`${numero}`) })).toBeInTheDocument()
  })

  test("venda não concluída vai para a fila", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.click(botao(simples.nome))
    await usuario.click(caixa().getByRole("radio", { name: "Pix" }))
    await usuario.click(caixa().getByRole("switch", { name: "Venda concluída no balcão" }))
    await usuario.click(caixa().getByRole("button", { name: /Mandar para a fila/ }))

    await screen.findByRole("dialog", { name: /^Venda #\d+/ })
    const [ultima] = await servidorDo("pizzaria").pdv.ultimasVendas()
    expect(ultima.status).toBe("recebido")
  })

  test("atalhos: / vai para a busca e F9 finaliza", async () => {
    const usuario = await abrir()
    const { simples } = await produtos()
    await usuario.keyboard("/")
    expect(screen.getByRole("searchbox", { name: "Buscar no cardápio" })).toHaveFocus()

    await usuario.click(botao(simples.nome))
    await usuario.click(caixa().getByRole("radio", { name: "Pix" }))
    await usuario.keyboard("{F9}")
    expect(await screen.findByRole("dialog", { name: /^Venda #\d+/ })).toBeInTheDocument()
  })
})
