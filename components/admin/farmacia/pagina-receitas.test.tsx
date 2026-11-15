import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaReceitas } from "./pagina-receitas"

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
      <PaginaReceitas />
    </Provedores>,
  )
  await screen.findByRole("article", { name: /Ana Paula Ferreira/ }, { timeout: 8000 })
  return usuario
}

const receitaDe = (paciente: string) =>
  within(screen.getByRole("article", { name: new RegExp(paciente) }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
  useFarmacia.setState(useFarmacia.getInitialState(), true)
})

describe("PaginaReceitas", () => {
  test("mostra a responsável técnica e as receitas aguardando conferência", async () => {
    await abrir()
    expect(screen.getByRole("heading", { level: 1, name: "Receitas" })).toBeInTheDocument()
    expect(screen.getByText(/Dra\. Camila Rocha/)).toBeInTheDocument()
    expect(screen.getByText(/CRF-SP 45\.812/)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Aguardando 7/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )

    const ana = receitaDe("Ana Paula Ferreira")
    expect(ana.getByText("Receita de antimicrobiano")).toBeInTheDocument()
    expect(ana.getByText(/Dr\. Paulo Mendes · CRM 143278\/SP/)).toBeInTheDocument()
    expect(ana.getByText("Amoxicilina 500 mg")).toBeInTheDocument()
    expect(ana.getByText("Tarja vermelha · retém receita")).toBeInTheDocument()
    expect(ana.getByText("Válida até 21/11/2026")).toBeInTheDocument()
  })

  test("receita com pendência mostra o motivo e não deixa aprovar", async () => {
    await abrir()
    const camila = receitaDe("Camila Rocha Lima")
    expect(camila.getByText("Receita vencida em 09/11/2026.")).toBeInTheDocument()
    expect(camila.getByRole("button", { name: "Aprovar" })).toBeDisabled()

    const daniel = receitaDe("Daniel Souza")
    expect(daniel.getByText("Zolpidem 10 mg exige Notificação de receita B.")).toBeInTheDocument()
    expect(daniel.getByText("Tarja preta")).toBeInTheDocument()
  })

  test("com retenção, só aprova depois de marcar a via retida", async () => {
    const usuario = await abrir()
    const ana = receitaDe("Ana Paula Ferreira")
    const aprovar = ana.getByRole("button", { name: "Aprovar" })
    expect(aprovar).toBeDisabled()

    await usuario.click(ana.getByRole("checkbox", { name: "Via da receita retida na farmácia" }))
    await usuario.click(aprovar)

    expect(useFarmacia.getState().decisoes["rec-1001"]).toMatchObject({
      situacao: "aprovada",
      retida: true,
    })
    expect(screen.queryByRole("article", { name: /Ana Paula Ferreira/ })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole("tab", { name: /Aprovadas 1/ }))
    expect(receitaDe("Ana Paula Ferreira").getByText("Aprovada")).toBeInTheDocument()
    const aprovada = screen.getByRole("article", { name: /Ana Paula Ferreira/ })
    expect(aprovada.querySelector("[data-traco]")).toHaveAttribute("data-tom", "pronto")
  })

  test("recusa com um motivo e dá para desfazer", async () => {
    const usuario = await abrir()
    await usuario.click(receitaDe("Camila Rocha Lima").getByRole("button", { name: "Recusar" }))
    const janela = await screen.findByRole("dialog", { name: /Recusar a receita/ })
    await usuario.click(within(janela).getByRole("radio", { name: "Receita vencida" }))
    await usuario.click(within(janela).getByRole("button", { name: "Recusar receita" }))

    expect(useFarmacia.getState().decisoes["rec-1003"]).toMatchObject({
      situacao: "recusada",
      motivo: "Receita vencida",
    })
    await usuario.click(screen.getByRole("tab", { name: /Recusadas 1/ }))
    const camila = receitaDe("Camila Rocha Lima")
    expect(camila.getByText("Recusada: Receita vencida")).toBeInTheDocument()
    expect(
      screen.getByRole("article", { name: /Camila Rocha Lima/ }).querySelector("[data-traco]"),
    ).toHaveAttribute("data-tom", "cancelado")
    await usuario.click(camila.getByRole("button", { name: "Desfazer" }))
    expect(useFarmacia.getState().decisoes["rec-1003"]).toBeUndefined()
  })
})
