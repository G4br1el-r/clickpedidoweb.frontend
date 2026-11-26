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
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMotoboys } from "./pagina-motoboys"

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

const api = () => servidorDo("pizzaria")

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaMotoboys />
    </Provedores>,
  )
  await screen.findByRole("row", { name: /Diego Ramos/ }, { timeout: 8000 })
  return usuario
}

const linha = (nome: string) => within(screen.getByRole("row", { name: new RegExp(nome) }))

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

describe("PaginaMotoboys", () => {
  test("lista com WhatsApp, entregas de hoje e o link para chamar", async () => {
    const [entrega] = (await api().pedidos.listar({ status: ["concluido"] })).filter(
      (pedido) => pedido.tipo === "entrega",
    )
    await api().pedidos.atribuirMotoboy(entrega.id, "moto-2")
    await abrir()
    const thiago = linha("Thiago Neves")
    expect(thiago.getByText("(12) 99231-8844")).toBeInTheDocument()
    expect(thiago.getByRole("link", { name: "Chamar Thiago Neves no WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/5512992318844"),
    )
    expect(thiago.getByRole("cell", { name: /^\d+$/ })).toBeInTheDocument()
  })

  test("novo motoboy e editar o nome", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Novo motoboy" }))
    const janela = within(screen.getByRole("dialog", { name: "Novo motoboy" }))
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Davi Souza")
    await usuario.type(janela.getByRole("textbox", { name: "WhatsApp" }), "12992220000")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByRole("row", { name: /Davi Souza/ })).toBeInTheDocument()

    await usuario.click(linha("Davi Souza").getByRole("button", { name: "Editar Davi Souza" }))
    const editar = within(screen.getByRole("dialog", { name: "Editar motoboy" }))
    const nome = editar.getByRole("textbox", { name: "Nome" })
    await usuario.clear(nome)
    await usuario.type(nome, "Davi Lima")
    await usuario.click(editar.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByRole("row", { name: /Davi Lima/ })).toBeInTheDocument()
  })

  test("desativar pela chave e não excluir quem tem entrega em andamento", async () => {
    const naRua = (
      await api().pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
    ).find((pedido) => pedido.tipo === "entrega")
    if (!naRua) throw new Error("A demonstração devia ter uma entrega em andamento")
    await api().pedidos.atribuirMotoboy(naRua.id, "moto-1")
    const usuario = await abrir()

    const chave = linha("Diego Ramos").getByRole("switch", { name: "Diego Ramos ativo" })
    await usuario.click(chave)
    expect(chave).not.toBeChecked()

    await usuario.click(linha("Diego Ramos").getByRole("button", { name: "Excluir Diego Ramos" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Excluir Diego Ramos?" })).getByRole(
        "button",
        {
          name: "Excluir",
        },
      ),
    )
    expect(
      await screen.findByText("Diego Ramos tem entrega em andamento. Desative em vez de excluir."),
    ).toBeInTheDocument()
    expect(screen.getByRole("row", { name: /Diego Ramos/ })).toBeInTheDocument()
  })

  test("excluir sai da lista e o desfazer do aviso traz o motoboy de volta", async () => {
    const usuario = await abrir()
    await usuario.click(linha("Thiago Neves").getByRole("button", { name: "Excluir Thiago Neves" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Excluir Thiago Neves?" })).getByRole(
        "button",
        { name: "Excluir" },
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Thiago Neves/ })).not.toBeInTheDocument(),
    )
    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    expect(await screen.findByRole("row", { name: /Thiago Neves/ })).toBeInTheDocument()
    const [thiago] = (await api().motoboys.listar()).filter((item) => item.nome === "Thiago Neves")
    expect(thiago).toMatchObject({ id: "moto-2", telefone: "12992318844" })
  })

  test("sem motoboy, o vazio ensina e cadastra dali", async () => {
    // Quem tem entrega em andamento não sai: cancela essas entregas antes.
    const naRua = (await api().pedidos.listar({})).filter(
      (pedido) => pedido.motoboyId && !["concluido", "cancelado"].includes(pedido.status),
    )
    for (const pedido of naRua) await api().pedidos.cancelar(pedido.id, pedido.status)
    for (const motoboy of await api().motoboys.listar()) await api().motoboys.excluir(motoboy.id)
    const usuario = userEvent.setup()
    render(
      <Provedores>
        <PaginaMotoboys />
      </Provedores>,
    )
    expect(
      await screen.findByText("Nenhum motoboy cadastrado", {}, { timeout: 8000 }),
    ).toBeVisible()
    await usuario.click(screen.getByRole("button", { name: "Cadastrar o primeiro motoboy" }))
    expect(screen.getByRole("dialog", { name: "Novo motoboy" })).toBeInTheDocument()
  })

  test("avisa quando a loja não está aceitando entregas", async () => {
    await api().definirEntrega(false)
    await abrir()
    expect(screen.getByText("A loja não está aceitando entregas agora.")).toBeInTheDocument()
  })
})

describe("PaginaMotoboys: carregamento", () => {
  test("enquanto carrega, mostra o esqueleto com a forma da lista", async () => {
    render(
      <Provedores>
        <PaginaMotoboys />
      </Provedores>,
    )
    expect(screen.getByRole("status", { name: "Carregando os motoboys" })).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-linha")).toHaveLength(4)
    await screen.findByRole("row", { name: /Diego Ramos/ }, { timeout: 8000 })
    expect(screen.queryByRole("status", { name: "Carregando os motoboys" })).not.toBeInTheDocument()
  })

  test("salvar um motoboy mostra o botão ocupado até o servidor responder", async () => {
    let terminar: () => void = () => {}
    const salvar = vi.spyOn(api().motoboys, "salvar").mockImplementation(
      () =>
        new Promise((resolver) => {
          terminar = () =>
            resolver({ id: "novo", nome: "Caio Lima", telefone: "12991110000", ativo: true })
        }),
    )
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Novo motoboy" }))
    const janela = within(screen.getByRole("dialog", { name: "Novo motoboy" }))
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Caio Lima")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))

    expect(await janela.findByRole("status", { name: "Salvando o motoboy" })).toBeInTheDocument()
    expect(janela.getByRole("button", { name: /Salvar/ })).toHaveAttribute("aria-busy", "true")
    terminar()
    salvar.mockRestore()
  })
})
