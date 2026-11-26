import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import type { ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { ListaPedidos } from "./lista-pedidos"

function Provedores({
  children,
  aoMudarUrl,
  endereco,
}: {
  children: ReactNode
  aoMudarUrl?: OnUrlUpdateFunction
  endereco?: string
}) {
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={aoMudarUrl} searchParams={endereco}>
      <TooltipProvider>{children}</TooltipProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar(pedidos: Pedido[], aoMudarUrl?: OnUrlUpdateFunction, endereco?: string) {
  return render(
    <Provedores aoMudarUrl={aoMudarUrl} endereco={endereco}>
      <ListaPedidos pedidos={pedidos} />
    </Provedores>,
  )
}

/** Números de pedido na ordem das linhas da tabela. */
const numeros = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((linha) => within(linha).getAllByRole("cell")[0].textContent)

describe("ListaPedidos", () => {
  test("mostra os pedidos do mais novo para o mais antigo, com o total da lista", () => {
    renderizar(PEDIDOS_DE_TESTE)
    expect(numeros()).toEqual(["#6", "#5", "#4", "#3", "#2", "#1", "#7", "#8"])
    expect(screen.getByText("8 pedidos · R$ 330,00 em vendas válidas")).toBeInTheDocument()
  })

  test("a busca reduz a lista", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "guarana")
    expect(numeros()).toEqual(["#5"])
    expect(screen.getByText("1 pedido · R$ 20,00 em vendas válidas")).toBeInTheDocument()
  })

  test("o filtro de status mostra a contagem e reduz a lista", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.click(screen.getByRole("button", { name: /status/i }))
    const cancelado = screen.getByRole("option", { name: /cancelado/i })
    expect(cancelado).toHaveTextContent("1")
    await usuario.click(cancelado)
    await usuario.keyboard("{Escape}")
    expect(numeros()).toEqual(["#3"])
  })

  test("ordena pelo total, do maior para o menor", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.click(screen.getByRole("button", { name: "Ordenar por total" }))
    expect(numeros().slice(0, 3)).toEqual(["#7", "#4", "#8"])
  })

  test("pagina de 20 em 20", async () => {
    const usuario = userEvent.setup()
    const muitos = Array.from({ length: 25 }, (_, indice) => ({
      ...PEDIDOS_DE_TESTE[2],
      id: indice + 1,
      numero: indice + 1,
      criadoEm: new Date(2026, 10, 1, 10, indice).toISOString(),
    }))
    renderizar(muitos)
    expect(numeros()).toHaveLength(20)
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Próxima página" }))
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(numeros()).toEqual(["#5", "#4", "#3", "#2", "#1"])
  })

  test("abrir um pedido guarda o número no endereço", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn<OnUrlUpdateFunction>()
    renderizar(PEDIDOS_DE_TESTE, aoMudar)
    await usuario.click(screen.getByRole("button", { name: "Abrir o pedido #4" }))
    expect(aoMudar.mock.lastCall?.[0].searchParams.get("pedido")).toBe("4")
  })

  test("sem resultado, mostra um aviso e o botão de limpar", async () => {
    const usuario = userEvent.setup()
    renderizar(PEDIDOS_DE_TESTE)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "pizza de abacaxi")
    expect(screen.getByText("Nenhum pedido com esses filtros")).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(numeros()).toHaveLength(8)
  })

  test("a origem vem do endereço, aparece como etiqueta e sai ao tocar nela", async () => {
    const usuario = userEvent.setup()
    const doPdv = { ...PEDIDOS_DE_TESTE[0], id: 50, numero: 50, origem: "pdv" as const }
    renderizar([...PEDIDOS_DE_TESTE, doPdv], undefined, "?origem=pdv")
    expect(numeros()).toEqual(["#50"])
    await usuario.click(
      screen.getByRole("button", { name: "Tirar o filtro Origem: PDV do balcão" }),
    )
    expect(numeros()).toHaveLength(9)
  })

  test("o cliente e o motivo vêm do endereço, como etiquetas que tiram o filtro", async () => {
    const usuario = userEvent.setup()
    const daAna = {
      ...PEDIDOS_DE_TESTE[0],
      id: 60,
      numero: 60,
      cliente: { nome: "Ana", telefone: "12991234567" },
    }
    const { unmount } = renderizar([...PEDIDOS_DE_TESTE, daAna], undefined, "?cliente=12991234567")
    expect(numeros()).toEqual(["#60"])
    await usuario.click(
      screen.getByRole("button", { name: "Tirar o filtro Cliente: (12) 99123-4567" }),
    )
    expect(numeros()).toHaveLength(9)
    unmount()

    // O pedido 3 foi cancelado sem motivo.
    renderizar(PEDIDOS_DE_TESTE, undefined, "?motivo=nao-informado")
    expect(numeros()).toEqual(["#3"])
    expect(
      screen.getByRole("button", { name: "Tirar o filtro Motivo: Não informado" }),
    ).toBeInTheDocument()
  })

  test("o bairro e o motoboy vêm do endereço, com o nome do motoboy na etiqueta", async () => {
    const usuario = userEvent.setup()
    const doLeo: Pedido = {
      ...PEDIDOS_DE_TESTE[2],
      id: 90,
      numero: 90,
      motoboyId: "leo",
      endereco: {
        cep: "12000000",
        logradouro: "Rua A",
        numero: "1",
        bairro: "Centro",
        cidade: "Taubaté",
      },
    }
    const { unmount } = render(
      <Provedores endereco="?bairro=Centro">
        <ListaPedidos pedidos={[...PEDIDOS_DE_TESTE, doLeo]} />
      </Provedores>,
    )
    expect(numeros()).toEqual(["#90"])
    await usuario.click(screen.getByRole("button", { name: "Tirar o filtro Bairro: Centro" }))
    expect(numeros()).toHaveLength(9)
    unmount()

    render(
      <Provedores endereco="?motoboy=leo">
        <ListaPedidos
          pedidos={[...PEDIDOS_DE_TESTE, doLeo]}
          motoboys={[{ id: "leo", nome: "Léo", telefone: "12999990000", ativo: true }]}
        />
      </Provedores>,
    )
    expect(numeros()).toEqual(["#90"])
    expect(screen.getByRole("button", { name: "Tirar o filtro Motoboy: Léo" })).toBeInTheDocument()
  })

  test("o filtro de entregas sem motoboy aparece como Motoboy: Sem motoboy", () => {
    renderizar(PEDIDOS_DE_TESTE, undefined, "?motoboy=sem-motoboy")
    // As entregas 1, 3, 5 e 6, da mais nova para a mais antiga.
    expect(numeros()).toEqual(["#6", "#5", "#3", "#1"])
    expect(
      screen.getByRole("button", { name: "Tirar o filtro Motoboy: Sem motoboy" }),
    ).toBeInTheDocument()
  })
})

describe("ListaPedidos em lote", () => {
  function renderizarEmLote(aoAvancarLote: (pedidos: Pedido[]) => void) {
    return render(
      <Provedores>
        <ListaPedidos pedidos={PEDIDOS_DE_TESTE} aoAvancarLote={aoAvancarLote} />
      </Provedores>,
    )
  }

  test("sem a ação de lote, a lista não mostra caixas de seleção", () => {
    renderizar(PEDIDOS_DE_TESTE)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  test("marcar um pedido abre a barra de lote com a contagem", async () => {
    const usuario = userEvent.setup()
    renderizarEmLote(vi.fn())
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar o pedido #5" }))
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "1 pedido selecionado",
    )
  })

  test("avançar o lote manda só os pedidos que têm próxima etapa e limpa a seleção", async () => {
    const usuario = userEvent.setup()
    const aoAvancarLote = vi.fn()
    renderizarEmLote(aoAvancarLote)
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar o pedido #5" }))
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar o pedido #6" }))
    expect(screen.getByText("1 sem próxima etapa")).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Avançar 1 pedido" }))
    expect(aoAvancarLote).toHaveBeenCalledOnce()
    expect(aoAvancarLote.mock.calls[0][0]).toHaveLength(1)
    expect(aoAvancarLote.mock.calls[0][0][0]).toMatchObject({ numero: 5 })
    // A barra sai com uma animação curta: some do documento quando ela termina.
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument(),
    )
  })

  test("a caixa do cabeçalho marca todos os pedidos da página", async () => {
    const usuario = userEvent.setup()
    renderizarEmLote(vi.fn())
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar todos desta página" }))
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "8 pedidos selecionados",
    )
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar todos desta página" }))
    // A barra sai com uma animação curta: some do documento quando ela termina.
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument(),
    )
  })

  test("clicar na caixa não abre os detalhes do pedido", async () => {
    const usuario = userEvent.setup()
    renderizarEmLote(vi.fn())
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar o pedido #5" }))
    expect(screen.getByRole("checkbox", { name: "Selecionar o pedido #5" })).toBeChecked()
  })
})
