import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ComponentProps, useState } from "react"
import { describe, expect, test, vi } from "vitest"
import type { Mesa } from "@/lib/admin/dados/tipos"
import type { EstadoMesa } from "@/lib/admin/regras/mesas"
import { pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { CartaoMesa } from "./cartao-mesa"

const AGORA = new Date(2026, 10, 13, 20, 30)

const mesaLivre: Mesa = {
  id: "mesa-7",
  numero: 7,
  nome: "Mesa 07",
  status: "livre",
  areaId: "area-salao",
  lugares: 4,
  forma: "quadrada",
  posicao: { x: 1, y: 1 },
}

type Props = ComponentProps<typeof CartaoMesa>

/** Júlia na mesa 7 desde 20:05, com o Rafa: 3 itens, R$ 13,50. */
const ocupada: Partial<Props> = {
  mesa: {
    ...mesaLivre,
    status: "ocupada",
    pedidoAtivoId: 41,
    clienteNome: "Júlia",
    ocupadaEm: new Date(2026, 10, 13, 20, 5).toISOString(),
  },
  comanda: pedidoDeTeste(41, new Date(2026, 10, 13, 20, 5), 13.5, {
    tipo: "mesa",
    status: "recebido",
    mesa: { id: "mesa-7", numero: 7, garcom: "Rafa", pessoas: 3 },
    itens: [
      {
        id: "a",
        produtoId: "a",
        nome: "Água",
        quantidade: 1,
        precoUnitario: 4,
        opcoes: [],
        total: 4,
      },
      {
        id: "s",
        produtoId: "s",
        nome: "Suco",
        quantidade: 2,
        precoUnitario: 4.75,
        opcoes: [],
        total: 9.5,
      },
    ],
  }),
  estado: { estado: "ocupada", rotulo: "Ocupada", tom: "caminho" },
}

function Provedores({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(() => new QueryClient())
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

function desenhar(props: Partial<Props> = {}) {
  render(
    <Provedores>
      <CartaoMesa
        mesa={mesaLivre}
        estado={{ estado: "livre", rotulo: "Livre", tom: "fim" }}
        alertas={[]}
        agora={AGORA}
        aoAbrir={vi.fn()}
        aoEditar={vi.fn()}
        aoBloquear={vi.fn()}
        {...props}
      />
    </Provedores>,
  )
  return screen.getByRole("button", { name: /^Mesa 7\b/ })
}

describe("CartaoMesa", () => {
  test("livre: o nome é Mesa N e mostra e fala os lugares", () => {
    const cartao = desenhar()
    expect(cartao).toHaveAccessibleName("Mesa 7")
    expect(cartao).toHaveAccessibleDescription("Livre, 4 lugares")
    expect(cartao).toHaveTextContent("4 lugares")
  })

  test("com nome próprio: mostra e fala o nome logo depois do estado", () => {
    const livre = desenhar({ mesa: { ...mesaLivre, nome: "Janela" } })
    expect(livre).toHaveTextContent("Janela")
    expect(livre).toHaveAccessibleDescription("Livre, Janela, 4 lugares")
  })

  test("limpeza: mostra há quanto tempo espera ser limpa", () => {
    const cartao = desenhar({
      mesa: { ...mesaLivre, limpezaDesde: new Date(2026, 10, 13, 20, 25).toISOString() },
      estado: { estado: "limpeza", rotulo: "Limpeza", tom: "espera" },
    })
    expect(cartao).toHaveTextContent("Limpeza há 5 min")
    // O resumo já diz o estado: a descrição não repete "Limpeza".
    expect(cartao).toHaveAccessibleDescription("Limpeza há 5 min")
    expect(cartao).not.toHaveTextContent("lugares")
  })

  test("bloqueada: mostra e fala o motivo", () => {
    const bloqueada = { estado: "bloqueada", rotulo: "Bloqueada", tom: "cancelado" } as const
    const comMotivo = desenhar({
      mesa: { ...mesaLivre, bloqueio: { motivo: "Em manutenção" } },
      estado: bloqueada,
    })
    expect(comMotivo).toHaveTextContent("Em manutenção")
    expect(comMotivo).toHaveAccessibleDescription("Bloqueada, Em manutenção")
  })

  test("bloqueada sem motivo diz Sem motivo", () => {
    const cartao = desenhar({
      mesa: { ...mesaLivre, bloqueio: {} },
      estado: { estado: "bloqueada", rotulo: "Bloqueada", tom: "cancelado" },
    })
    expect(cartao).toHaveTextContent("Sem motivo")
    expect(cartao).toHaveAccessibleDescription("Bloqueada, Sem motivo")
    expect(cartao).not.toHaveTextContent("lugares")
  })

  test("ocupada: cliente, tempo, garçom, pessoas, itens e total", () => {
    const cartao = desenhar(ocupada)
    // Dinheiro do Intl vem com espaço não separável, que a descrição acessível mantém.
    expect(cartao).toHaveAccessibleDescription("Ocupada, Júlia, Garçom Rafa, 3 pessoas, R$ 13,50")
    expect(cartao).toHaveTextContent("Júlia")
    expect(cartao).toHaveTextContent("25 min")
    expect(cartao).toHaveTextContent("Garçom Rafa")
    expect(cartao).toHaveTextContent("3 pessoas")
    expect(cartao).toHaveTextContent("3 itens")
    expect(cartao).toHaveTextContent("R$ 13,50")
    expect(cartao).not.toHaveAttribute("data-alerta")
  })

  test("com alerta: mostra o mais urgente, fica marcado e a descrição traz todos", () => {
    const cartao = desenhar({
      ...ocupada,
      estado: { estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" },
      alertas: [
        { tipo: "conta-pedida", texto: "Pediu a conta há 12 min" },
        { tipo: "aberta", texto: "Aberta há 2 h 30" },
      ],
    })
    expect(cartao).toHaveAttribute("data-alerta", "conta-pedida")
    expect(within(cartao).getByText("Pediu a conta há 12 min")).toBeVisible()
    expect(within(cartao).queryByText("Aberta há 2 h 30")).not.toBeInTheDocument()
    expect(cartao).toHaveAccessibleDescription(
      "Pediu a conta, Júlia, Garçom Rafa, 3 pessoas, R$ 13,50, Pediu a conta há 12 min, Aberta há 2 h 30",
    )
  })

  // A tabela do menu ⋯ nas decisões de detalhe da Fase 2; a Fase 3 põe "Marcar servido" em Servir
  // e a Fase 5, "Transferir" e "Juntar mesas" na mesa aberta ("Separar" só com mesas juntadas).
  test.each<[EstadoMesa, string[]]>([
    ["livre", ["Abrir comanda", "Editar", "Bloquear", "Excluir"]],
    ["reservada", ["Abrir comanda", "Editar", "Bloquear", "Excluir"]],
    ["limpeza", ["Marcar limpa", "Editar", "Bloquear", "Excluir"]],
    ["ocupada", ["Abrir comanda", "Transferir", "Juntar mesas", "Editar"]],
    ["na-cozinha", ["Abrir comanda", "Transferir", "Juntar mesas", "Editar"]],
    ["servir", ["Marcar servido", "Abrir comanda", "Transferir", "Juntar mesas", "Editar"]],
    ["conta-pedida", ["Abrir comanda", "Transferir", "Juntar mesas", "Editar"]],
    ["bloqueada", ["Desbloquear", "Editar", "Excluir"]],
    ["juntada", ["Abrir comanda"]],
  ])("menu ⋯ da mesa %s: %j", async (estado, itens) => {
    const usuario = userEvent.setup()
    desenhar({ estado: { estado, rotulo: "Qualquer", tom: "fim" } })
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    const menu = await screen.findByRole("menu")
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(itens)
  })

  test("com mesas juntadas na comanda, a aberta e a juntada oferecem Separar", async () => {
    const usuario = userEvent.setup()
    const comanda = ocupada.comanda as NonNullable<Props["comanda"]>
    const junta = {
      ...comanda,
      mesa: { id: "mesa-7", numero: 7, juntadas: [{ id: "mesa-8", numero: 8 }] },
    }
    desenhar({ ...ocupada, comanda: junta })
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    expect(await screen.findByRole("menuitem", { name: "Separar" })).toBeInTheDocument()
    cleanup()

    desenhar({
      comanda: junta,
      estado: { estado: "juntada", rotulo: "Com a mesa 7", tom: "caminho" },
    })
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    expect(
      within(await screen.findByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Abrir comanda", "Separar"])
  })

  // jsdom não mede layout: a classe é o que garante que o ⋯ flutua no canto, fora do fluxo.
  test("o ⋯ flutua no canto do cartão, sem perder o absolute para a área de toque", () => {
    desenhar()
    const botao = screen.getByRole("button", { name: "Ações da mesa 7" })
    expect(botao).toHaveClass("absolute", "top-2", "right-2", "after:absolute", "after:-inset-2")
    expect(botao).not.toHaveClass("relative")
  })

  test("Abrir comanda abre a mesa", async () => {
    const usuario = userEvent.setup()
    const aoAbrir = vi.fn()
    desenhar({ aoAbrir })
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Abrir comanda" }))
    expect(aoAbrir).toHaveBeenCalledOnce()
  })

  test("Editar e Bloquear chamam a página com o botão ⋯, para onde o foco volta", async () => {
    const usuario = userEvent.setup()
    const aoEditar = vi.fn()
    const aoBloquear = vi.fn()
    desenhar({ aoEditar, aoBloquear })
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Editar" }))
    await usuario.click(screen.getByRole("button", { name: "Ações da mesa 7" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Bloquear" }))
    const botao = screen.getByRole("button", { name: "Ações da mesa 7" })
    expect(aoEditar).toHaveBeenCalledExactlyOnceWith(botao)
    expect(aoBloquear).toHaveBeenCalledExactlyOnceWith(botao)
  })
})
