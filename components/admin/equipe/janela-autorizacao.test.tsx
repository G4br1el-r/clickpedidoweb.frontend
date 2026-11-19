import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { JanelaAutorizacao } from "./janela-autorizacao"

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

async function abrir(aoAutorizar: (a: { membroId: string; pin: string }) => Promise<void>) {
  const aoFechar = vi.fn()
  const usuario = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JanelaAutorizacao aberta acao="sangria" aoFechar={aoFechar} aoAutorizar={aoAutorizar} />
    </QueryClientProvider>,
  )
  const janela = await screen.findByRole("dialog", { name: "Autorização do gerente" })
  await within(janela).findAllByRole("radio", {}, { timeout: 5000 })
  return { usuario, janela, aoFechar }
}

describe("JanelaAutorizacao", () => {
  test("a autorização lista só gerente e dono", async () => {
    const { janela } = await abrir(async () => {})
    expect(within(janela).getByText("A sangria precisa do PIN de um gerente.")).toBeInTheDocument()
    expect(
      within(janela)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label")),
    ).toEqual(["Carla N. Dono", "Rafael M. Gerente"])
  })

  test("a autorização devolve membro e PIN", async () => {
    const aoAutorizar = vi.fn(async () => {})
    const { usuario, janela, aoFechar } = await abrir(aoAutorizar)
    await usuario.click(within(janela).getByRole("radio", { name: "Rafael M. Gerente" }))
    await usuario.type(within(janela).getByLabelText("PIN do gerente"), "2580")
    await usuario.click(within(janela).getByRole("button", { name: "Autorizar" }))
    expect(aoAutorizar).toHaveBeenCalledWith({ membroId: "eq-gerente", pin: "2580" })
    expect(aoFechar).toHaveBeenCalled()
  })

  test("se recusar, mostra o erro e limpa o PIN", async () => {
    const aoAutorizar = vi.fn(async () => {
      throw new Error("PIN do gerente errado.")
    })
    const { usuario, janela, aoFechar } = await abrir(aoAutorizar)
    await usuario.click(within(janela).getByRole("radio", { name: "Rafael M. Gerente" }))
    await usuario.type(within(janela).getByLabelText("PIN do gerente"), "0000{Enter}")
    expect(await within(janela).findByText("PIN do gerente errado.")).toBeInTheDocument()
    expect(within(janela).getByLabelText("PIN do gerente")).toHaveValue("")
    expect(aoFechar).not.toHaveBeenCalled()
  })
})
