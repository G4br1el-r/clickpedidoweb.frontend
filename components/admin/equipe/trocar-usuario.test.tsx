import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test } from "vitest"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { TrocarUsuario } from "./trocar-usuario"

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
})

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrocarUsuario />
    </QueryClientProvider>,
  )
  await screen.findByRole("button", { name: /Carla N\. · Dono/ }, { timeout: 5000 })
  return usuario
}

describe("TrocarUsuario", () => {
  test("Ctrl+U abre Trocar usuário; Marina + 1111 entra e o topo mostra Marina S. · Caixa", async () => {
    const usuario = await abrir()
    await usuario.keyboard("{Control>}u{/Control}")
    const janela = await screen.findByRole("dialog", { name: "Trocar usuário" })
    await usuario.click(within(janela).getByRole("radio", { name: "Marina S. Caixa" }))
    await usuario.type(within(janela).getByLabelText("PIN"), "1111")
    await usuario.click(within(janela).getByRole("button", { name: "Entrar" }))

    expect(await screen.findByRole("button", { name: /Marina S\. · Caixa/ })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useUsuarioSalvo.getState().porSegmento.pizzaria).toBe("eq-marina")
  })

  test("PIN errado mostra 'PIN errado.' e limpa", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: /Carla N\. · Dono/ }))
    const janela = await screen.findByRole("dialog", { name: "Trocar usuário" })
    await usuario.click(within(janela).getByRole("radio", { name: "João P. Caixa" }))
    await usuario.type(within(janela).getByLabelText("PIN"), "9999{Enter}")

    expect(await within(janela).findByText("PIN errado.")).toBeInTheDocument()
    expect(within(janela).getByLabelText("PIN")).toHaveValue("")
    expect(useUsuarioSalvo.getState().porSegmento.pizzaria).toBeUndefined()
  })

  test("Entrar só com a pessoa escolhida e o PIN completo", async () => {
    const usuario = await abrir()
    await usuario.keyboard("{Control>}u{/Control}")
    const janela = await screen.findByRole("dialog", { name: "Trocar usuário" })
    const entrar = within(janela).getByRole("button", { name: "Entrar" })
    expect(entrar).toBeDisabled()
    await usuario.click(within(janela).getByRole("radio", { name: "Rafael M. Gerente" }))
    await usuario.type(within(janela).getByLabelText("PIN"), "258")
    expect(entrar).toBeDisabled()
    await usuario.type(within(janela).getByLabelText("PIN"), "0")
    expect(entrar).toBeEnabled()
  })
})
