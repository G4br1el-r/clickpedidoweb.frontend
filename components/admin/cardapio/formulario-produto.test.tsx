import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { FormularioProduto } from "./formulario-produto"

function Provedores({
  children,
  produto,
  aoMudarUrl,
}: {
  children: ReactNode
  produto: string
  aoMudarUrl?: OnUrlUpdateFunction
}) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={{ produto }} onUrlUpdate={aoMudarUrl}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          {/* No app, o Toaster vem dos provedores da raiz. */}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function abrir(segmento: SegmentoPainelId, produto = "novo", aoMudarUrl?: OnUrlUpdateFunction) {
  useSegmentoAtual.setState({ segmento })
  render(
    <Provedores produto={produto} aoMudarUrl={aoMudarUrl}>
      <FormularioProduto />
    </Provedores>,
  )
}

/** O painel abre com o esqueleto; espera o formulário carregar. */
async function formulario() {
  const painel = within(await screen.findByRole("dialog", { name: /produto/i }, { timeout: 8000 }))
  await painel.findByRole("button", { name: "Salvar produto" }, { timeout: 8000 })
  return painel
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
})

describe("FormularioProduto: campos por segmento", () => {
  test("pizzaria: preço de balcão e grupos de opções, sem duração", async () => {
    abrir("pizzaria")
    const campos = await formulario()
    expect(campos.getByLabelText("Preço de balcão")).toBeInTheDocument()
    expect(campos.getByRole("group", { name: "Grupos de opções" })).toBeInTheDocument()
    expect(campos.queryByLabelText("Duração (minutos)")).not.toBeInTheDocument()
  })

  test("salão: duração e vídeo, sem grupos de opções", async () => {
    abrir("salao")
    const campos = await formulario()
    expect(campos.getByLabelText("Duração (minutos)")).toBeInTheDocument()
    expect(campos.getByLabelText("Link do vídeo")).toBeInTheDocument()
    expect(campos.queryByRole("group", { name: "Grupos de opções" })).not.toBeInTheDocument()
  })

  test("açougue escolhe unidade ou quilo; lanchonete não tem balcão", async () => {
    abrir("acougue")
    expect((await formulario()).getByRole("radio", { name: "Por quilo" })).toBeInTheDocument()
  })

  test("lanchonete não tem preço de balcão", async () => {
    abrir("lanchonete")
    expect((await formulario()).queryByLabelText("Preço de balcão")).not.toBeInTheDocument()
  })
})

describe("FormularioProduto: salvar", () => {
  test("sem preencher, mostra o que falta", async () => {
    const usuario = userEvent.setup()
    abrir("pizzaria")
    const campos = await formulario()
    await usuario.click(campos.getByRole("button", { name: "Salvar produto" }))

    expect(await campos.findByText("Informe o nome do produto.")).toBeInTheDocument()
    expect(campos.getByText("Escolha a categoria.")).toBeInTheDocument()
    expect(campos.getByText("Informe o preço.")).toBeInTheDocument()
  })

  test("cria um produto com grupo de opções", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    abrir("pizzaria", "novo", aoMudar)
    const campos = await formulario()

    await usuario.type(campos.getByLabelText("Nome"), "Pizza da casa")
    await usuario.click(campos.getByRole("combobox", { name: "Categoria" }))
    await usuario.click(await screen.findByRole("option", { name: "Tradicionais" }))
    await usuario.type(campos.getByLabelText("Preço"), "59,90")

    await usuario.click(campos.getByRole("button", { name: "Adicionar grupo" }))
    const grupo = within(campos.getByRole("group", { name: "Grupo 1" }))
    await usuario.type(grupo.getByLabelText("Nome do grupo"), "Borda")
    await usuario.type(grupo.getByLabelText("Nome da opção 1"), "Catupiry")
    await usuario.type(grupo.getByLabelText("Preço da opção 1"), "8")

    await usuario.click(campos.getByRole("button", { name: "Salvar produto" }))

    expect(await screen.findByText("Produto salvo.")).toBeInTheDocument()
    expect(aoMudar.mock.lastCall?.[0].searchParams.get("produto")).toBeNull()
    const salvo = (await servidorDo("pizzaria").produtos.listar()).find(
      (p) => p.nome === "Pizza da casa",
    )
    expect(salvo?.preco).toBe(59.9)
    expect(salvo?.grupos[0]).toMatchObject({
      nome: "Borda",
      itens: [{ nome: "Catupiry", precoAdicional: 8 }],
    })
  })

  test("mínimo maior que o máximo avisa no próprio grupo", async () => {
    const usuario = userEvent.setup()
    abrir("pizzaria")
    const campos = await formulario()
    await usuario.click(campos.getByRole("button", { name: "Adicionar grupo" }))
    const grupo = within(campos.getByRole("group", { name: "Grupo 1" }))
    await usuario.clear(grupo.getByLabelText("Mínimo"))
    await usuario.type(grupo.getByLabelText("Mínimo"), "3")
    await usuario.click(campos.getByRole("button", { name: "Salvar produto" }))

    expect(await grupo.findByText("O mínimo não pode passar do máximo.")).toBeInTheDocument()
  })

  test("os grupos sobem e descem com os botões", async () => {
    const usuario = userEvent.setup()
    abrir("pizzaria")
    const campos = await formulario()
    await usuario.click(campos.getByRole("button", { name: "Adicionar grupo" }))
    await usuario.type(
      within(campos.getByRole("group", { name: "Grupo 1" })).getByLabelText("Nome do grupo"),
      "Sabor",
    )
    await usuario.click(campos.getByRole("button", { name: "Adicionar grupo" }))
    await usuario.type(
      within(campos.getByRole("group", { name: "Grupo 2" })).getByLabelText("Nome do grupo"),
      "Borda",
    )

    await usuario.click(
      within(campos.getByRole("group", { name: "Grupo 2" })).getByRole("button", {
        name: "Subir grupo",
      }),
    )
    expect(
      within(campos.getByRole("group", { name: "Grupo 1" })).getByLabelText("Nome do grupo"),
    ).toHaveValue("Borda")
  })

  test("editar carrega o produto", async () => {
    const [primeiro] = await servidorDo("pizzaria").produtos.listar()
    abrir("pizzaria", primeiro.id)
    expect(await (await formulario()).findByDisplayValue(primeiro.nome)).toBeInTheDocument()
  })
})

describe("FormularioProduto: combos da adega", () => {
  const COMBO = "prod-master-black-combo-2-gelo"
  const opcoesDoCombo = async () =>
    (await servidorDo("adega").produtos.listar()).find((produto) => produto.id === COMBO)?.grupos ??
    []

  test("a opção ligada mostra o produto e continua ligada ao salvar", async () => {
    const usuario = userEvent.setup()
    abrir("adega", COMBO)
    const painel = await formulario()
    const gelos = within(painel.getByRole("group", { name: "Grupo 2" }))
    expect(gelos.getByText("Ligada a GELO DE COCO")).toBeInTheDocument()

    await usuario.click(painel.getByRole("button", { name: "Salvar produto" }))
    await screen.findByText("Produto salvo.")
    const coco = (await opcoesDoCombo())[1].itens.find((item) => item.nome === "Gelo de Coco")
    expect(coco?.produtoId).toBe("prod-gelo-de-coco")
  })

  test("adicionar um produto como opção cria a opção já ligada", async () => {
    const usuario = userEvent.setup()
    abrir("adega", COMBO)
    const painel = await formulario()
    const energetico = within(painel.getByRole("group", { name: "Grupo 1" }))
    await usuario.click(energetico.getByRole("button", { name: "Adicionar produto como opção" }))
    await usuario.type(await screen.findByRole("combobox", { name: "Buscar produto" }), "red bull")
    await usuario.click(await screen.findByRole("option", { name: /ENERGETICO RED BULL 250ML/ }))

    expect(energetico.getByDisplayValue("ENERGETICO RED BULL 250ML")).toBeInTheDocument()
    expect(energetico.getByText("Ligada a ENERGETICO RED BULL 250ML")).toBeInTheDocument()
    await usuario.click(painel.getByRole("button", { name: "Salvar produto" }))
    // O aviso de salvo pode ser o do teste anterior: confere no servidor.
    await waitFor(async () =>
      expect((await opcoesDoCombo())[0].itens.at(-1)).toMatchObject({
        nome: "ENERGETICO RED BULL 250ML",
        produtoId: "prod-energetico-red-bull-250ml",
      }),
    )
  })

  test("fora da adega não tem opção ligada a produto", async () => {
    abrir("pizzaria")
    const painel = await formulario()
    await userEvent.setup().click(painel.getByRole("button", { name: "Adicionar grupo" }))
    expect(
      painel.queryByRole("button", { name: "Adicionar produto como opção" }),
    ).not.toBeInTheDocument()
  })
})
