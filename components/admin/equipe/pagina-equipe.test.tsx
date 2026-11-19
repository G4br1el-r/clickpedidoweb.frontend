import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, test } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaEquipe } from "./pagina-equipe"

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

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaEquipe />
    </Provedores>,
  )
  await screen.findByRole("table", { name: "Equipe" }, { timeout: 5000 })
  return usuario
}

const linha = (nome: string) => screen.getByRole("row", { name: new RegExp(`^${nome}`) })

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

describe("PaginaEquipe", () => {
  test("lista a equipe com o perfil", async () => {
    await abrir()
    expect(screen.getByRole("heading", { level: 1, name: "Equipe" })).toBeInTheDocument()
    expect(screen.getByText("4 pessoas · 1 dono, 1 gerente, 2 no caixa")).toBeInTheDocument()
    expect(within(linha("Carla N.")).getByText("Dono")).toBeInTheDocument()
    expect(within(linha("Rafael M.")).getByText("Gerente")).toBeInTheDocument()
    expect(within(linha("Marina S.")).getByText("Caixa")).toBeInTheDocument()
    expect(
      within(linha("Marina S.")).getByRole("switch", { name: "Marina S. ativa" }),
    ).toBeChecked()
  })

  test("Mostrar revela o PIN", async () => {
    const usuario = await abrir()
    expect(within(linha("Marina S.")).queryByText("1111")).not.toBeInTheDocument()
    await usuario.click(
      within(linha("Marina S.")).getByRole("button", { name: "Mostrar PIN de Marina S." }),
    )
    expect(within(linha("Marina S.")).getByText("1111")).toBeInTheDocument()
    await usuario.click(
      within(linha("Marina S.")).getByRole("button", { name: "Esconder PIN de Marina S." }),
    )
    expect(within(linha("Marina S.")).queryByText("1111")).not.toBeInTheDocument()
  })

  test("adiciona Bia, caixa, PIN 3333", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Adicionar pessoa" }))
    const janela = await screen.findByRole("dialog", { name: "Nova pessoa" })
    await usuario.type(within(janela).getByLabelText("Nome"), "Bia L.")
    await usuario.click(within(janela).getByRole("radio", { name: "Caixa" }))
    await usuario.type(within(janela).getByLabelText("PIN"), "3333")
    await usuario.click(within(janela).getByRole("button", { name: "Salvar" }))

    expect(await screen.findByRole("row", { name: /^Bia L\./ })).toBeInTheDocument()
    expect(screen.getByText("5 pessoas · 1 dono, 1 gerente, 3 no caixa")).toBeInTheDocument()
    const bia = (await servidorDo("pizzaria").equipe.listar()).at(-1)
    expect(bia).toMatchObject({ nome: "Bia L.", perfil: "caixa", pin: "3333", ativo: true })
  })

  test("editar troca o perfil e um PIN curto mostra o erro do servidor", async () => {
    const usuario = await abrir()
    await usuario.click(within(linha("João P.")).getByRole("button", { name: "Editar João P." }))
    const janela = await screen.findByRole("dialog", { name: "Editar João P." })
    expect(within(janela).getByLabelText("Nome")).toHaveValue("João P.")
    await usuario.click(within(janela).getByRole("radio", { name: "Gerente" }))
    const pin = within(janela).getByLabelText("PIN")
    await usuario.clear(pin)
    await usuario.type(pin, "12")
    await usuario.click(within(janela).getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("O PIN tem de 4 a 6 números.")).toBeInTheDocument()

    await usuario.type(pin, "34")
    await usuario.click(within(janela).getByRole("button", { name: "Salvar" }))
    expect(await within(linha("João P.")).findByText("Gerente")).toBeInTheDocument()
  })

  test("desativar o único dono mostra o erro do servidor", async () => {
    const usuario = await abrir()
    await usuario.click(within(linha("Carla N.")).getByRole("switch", { name: "Carla N. ativa" }))
    expect(await screen.findByText("O painel precisa de um Dono ativo.")).toBeInTheDocument()
    expect(within(linha("Carla N.")).getByRole("switch", { name: "Carla N. ativa" })).toBeChecked()
  })
})
