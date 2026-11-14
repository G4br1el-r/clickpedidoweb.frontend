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
import { PaginaBairros } from "./pagina-bairros"

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
      <PaginaBairros />
    </Provedores>,
  )
  await screen.findByRole("table", { name: "Bairros" }, { timeout: 8000 })
  return usuario
}

const linha = (nome: string) =>
  within(screen.getByRole("row", { name: new RegExp(`^Selecionar ${nome}\\b`) }))
const taxaNoServidor = async (nome: string) =>
  (await api().bairros.listar()).find((bairro) => bairro.nome === nome)?.taxa

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

describe("PaginaBairros", () => {
  test("busca pelo nome e filtra pela cidade", async () => {
    await api().bairros.salvar({ cidade: "Lorena", nome: "Vila Nunes", taxa: 9, ativo: true })
    const usuario = await abrir()

    await usuario.click(screen.getByRole("combobox", { name: "Cidade" }))
    await usuario.click(await screen.findByRole("option", { name: "Lorena" }))
    const linhas = within(screen.getByRole("table", { name: "Bairros" })).getAllByRole("row")
    // Cabeçalho e o bairro de Lorena.
    expect(linhas).toHaveLength(2)
    expect(linhas[1]).toHaveTextContent("Vila Nunes")

    await usuario.click(screen.getByRole("combobox", { name: "Cidade" }))
    await usuario.click(await screen.findByRole("option", { name: "Todas as cidades" }))
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar bairro" }), "nunes")
    expect(within(screen.getByRole("table", { name: "Bairros" })).getAllByRole("row")).toHaveLength(
      2,
    )
  })

  test("novo bairro; repetido na mesma cidade mostra o erro", async () => {
    const [existente] = await api().bairros.listar()
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Novo bairro" }))
    const janela = within(screen.getByRole("dialog", { name: "Novo bairro" }))
    await usuario.type(janela.getByRole("textbox", { name: "Cidade" }), existente.cidade)
    await usuario.type(janela.getByRole("textbox", { name: "Bairro" }), "Jardim Novo")
    await usuario.type(janela.getByRole("textbox", { name: "Taxa" }), "7")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByRole("row", { name: /^Selecionar Jardim Novo/ })).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Novo bairro" }))
    const outra = within(screen.getByRole("dialog", { name: "Novo bairro" }))
    await usuario.type(outra.getByRole("textbox", { name: "Cidade" }), existente.cidade)
    await usuario.type(outra.getByRole("textbox", { name: "Bairro" }), existente.nome.toUpperCase())
    await usuario.type(outra.getByRole("textbox", { name: "Taxa" }), "7")
    await usuario.click(outra.getByRole("button", { name: "Salvar" }))
    expect(
      await screen.findByText(`Já existe o bairro ${existente.nome} em ${existente.cidade}.`),
    ).toBeInTheDocument()
  })

  test("a taxa muda na própria linha", async () => {
    const [bairro] = await api().bairros.listar()
    const usuario = await abrir()
    const taxa = linha(bairro.nome).getByRole("textbox", { name: `Taxa de ${bairro.nome}` })
    await usuario.clear(taxa)
    await usuario.type(taxa, "11{Enter}")
    await waitFor(async () => expect(await taxaNoServidor(bairro.nome)).toBe(11))
  })

  test("selecionar vários e mudar a taxa ou desativar de uma vez", async () => {
    const [primeiro, segundo] = await api().bairros.listar()
    const usuario = await abrir()
    await usuario.click(linha(primeiro.nome).getByRole("checkbox"))
    await usuario.click(linha(segundo.nome).getByRole("checkbox"))
    const acoes = within(screen.getByRole("toolbar", { name: "2 bairros selecionados" }))

    await usuario.click(acoes.getByRole("button", { name: "Mudar taxa" }))
    const janela = within(screen.getByRole("dialog", { name: "Mudar a taxa de 2 bairros" }))
    await usuario.type(janela.getByRole("textbox", { name: "Nova taxa" }), "12")
    await usuario.click(janela.getByRole("button", { name: "Aplicar" }))
    await waitFor(async () => expect(await taxaNoServidor(primeiro.nome)).toBe(12))
    expect(await taxaNoServidor(segundo.nome)).toBe(12)

    // Depois de aplicar, a seleção limpa: escolhe de novo só o segundo.
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument()
    await usuario.click(linha(segundo.nome).getByRole("checkbox"))
    await usuario.click(
      within(screen.getByRole("toolbar", { name: "1 bairro selecionado" })).getByRole("button", {
        name: "Desativar",
      }),
    )
    await waitFor(async () =>
      expect((await api().bairros.listar()).find((item) => item.id === segundo.id)?.ativo).toBe(
        false,
      ),
    )
  })

  test("excluir pede confirmação", async () => {
    const [bairro] = await api().bairros.listar()
    const usuario = await abrir()
    await usuario.click(linha(bairro.nome).getByRole("button", { name: `Excluir ${bairro.nome}` }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: `Excluir ${bairro.nome}?` })).getByRole(
        "button",
        { name: "Excluir" },
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("row", { name: new RegExp(`^Selecionar ${bairro.nome}\\b`) }),
      ).not.toBeInTheDocument(),
    )
  })
})
