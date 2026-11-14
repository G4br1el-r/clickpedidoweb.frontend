import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaCategorias } from "./pagina-categorias"

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

const nomes = () => screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))

async function abrir() {
  render(
    <Provedores>
      <PaginaCategorias />
    </Provedores>,
  )
  await screen.findByRole("listitem", { name: "Pastéis" }, { timeout: 8000 })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "lanchonete" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PaginaCategorias", () => {
  test("cria uma categoria no fim e sobe ela com o botão", async () => {
    const usuario = userEvent.setup()
    await abrir()
    await usuario.type(screen.getByLabelText("Nova categoria"), "Promoções{Enter}")
    expect((await screen.findAllByRole("listitem")).at(-1)).toHaveAccessibleName("Promoções")

    const antes = nomes()
    const promocoes = within(screen.getByRole("listitem", { name: "Promoções" }))
    await usuario.click(promocoes.getByRole("button", { name: "Subir" }))
    expect(nomes()).toEqual([...antes.slice(0, -2), "Promoções", antes.at(-2)])
  })

  test("renomeia na linha e oculta pela chave", async () => {
    const usuario = userEvent.setup()
    await abrir()
    const pasteis = within(screen.getByRole("listitem", { name: "Pastéis" }))
    const nome = pasteis.getByRole("textbox", { name: "Nome da categoria" })
    await usuario.clear(nome)
    await usuario.type(nome, "Pastéis fritos{Enter}")
    expect(await screen.findByText("Categoria salva.")).toBeInTheDocument()

    const visivel = within(screen.getByRole("listitem", { name: "Pastéis fritos" })).getByRole(
      "switch",
      {
        name: "Visível",
      },
    )
    await usuario.click(visivel)
    expect(visivel).not.toBeChecked()
  })

  test("só exclui categoria vazia, com confirmação", async () => {
    const usuario = userEvent.setup()
    await abrir()
    expect(
      within(screen.getByRole("listitem", { name: "Pastéis" })).getByRole("button", {
        name: "Excluir",
      }),
    ).toBeDisabled()

    await usuario.type(screen.getByLabelText("Nova categoria"), "Vazia{Enter}")
    const vazia = within(await screen.findByRole("listitem", { name: "Vazia" }))
    await usuario.click(vazia.getByRole("button", { name: "Excluir" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Excluir a categoria Vazia?" })).getByRole(
        "button",
        {
          name: "Sim, excluir",
        },
      ),
    )
    expect(await screen.findByText("Categoria excluída.")).toBeInTheDocument()
    expect(screen.queryByRole("listitem", { name: "Vazia" })).not.toBeInTheDocument()
  })
})
