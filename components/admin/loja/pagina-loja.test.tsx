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
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { PaginaLoja } from "./pagina-loja"

const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

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
      <PaginaLoja />
    </Provedores>,
  )
  await screen.findByRole("textbox", { name: "Nome da loja" }, { timeout: 8000 })
  return usuario
}

const secao = (nome: string) => within(screen.getByRole("region", { name: nome }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  imprimir.mockClear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  localStorage.clear()
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
  // Fora do ShellAdmin ninguém lê o navegador: o teste começa com ele já lido.
  useUsuarioSalvo.setState({ hidratado: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PaginaLoja", () => {
  test("salvar aparece só com alteração; descartar volta e salvar grava", async () => {
    const usuario = await abrir()
    expect(screen.queryByRole("region", { name: "Alterações não salvas" })).not.toBeInTheDocument()

    const nome = screen.getByRole("textbox", { name: "Nome da loja" })
    await usuario.clear(nome)
    await usuario.type(nome, "Pizzaria Nova")
    const barra = within(await screen.findByRole("region", { name: "Alterações não salvas" }))
    await usuario.click(barra.getByRole("button", { name: "Descartar" }))
    expect(nome).toHaveValue("Casa da Pizza")

    await usuario.clear(nome)
    await usuario.type(nome, "Pizzaria Nova")
    await usuario.click(
      within(screen.getByRole("region", { name: "Alterações não salvas" })).getByRole("button", {
        name: "Salvar alterações",
      }),
    )
    expect(await screen.findByText("Configurações salvas.")).toBeInTheDocument()
    expect((await api().loja()).nome).toBe("Pizzaria Nova")
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Alterações não salvas" }),
      ).not.toBeInTheDocument(),
    )
  })

  test("a barra de salvar diz em que seções há alteração", async () => {
    const usuario = await abrir()
    const nome = screen.getByRole("textbox", { name: "Nome da loja" })
    await usuario.type(nome, " Nova")
    const barra = within(await screen.findByRole("region", { name: "Alterações não salvas" }))
    expect(barra.getByText("Em Loja")).toBeInTheDocument()

    await usuario.click(secao("Horários").getByRole("switch", { name: "Aberto no domingo" }))
    expect(barra.getByText("Em Loja e Horários")).toBeInTheDocument()
  })

  test("horários: copiar para todos e o texto montado sozinho", async () => {
    const usuario = await abrir()
    const horarios = secao("Horários")
    const texto = screen.getByRole("textbox", { name: "Texto do horário" })
    await usuario.clear(texto)
    expect(
      screen.getByText("Vazio, aparece: Terça a domingo, das 18h às 23h30"),
    ).toBeInTheDocument()

    await usuario.click(horarios.getByRole("switch", { name: "Aberto no domingo" }))
    expect(screen.getByText("Vazio, aparece: Terça a sábado, das 18h às 23h30")).toBeInTheDocument()

    const abreTerca = horarios.getByLabelText("Abre na terça")
    await usuario.clear(abreTerca)
    await usuario.type(abreTerca, "17:00")
    await usuario.click(
      horarios.getByRole("button", { name: "Copiar o horário de terça para todos" }),
    )
    expect(screen.getByText("Vazio, aparece: Todos os dias, das 17h às 23h30")).toBeInTheDocument()
  })

  test("erros aparecem no campo e nada é salvo", async () => {
    const usuario = await abrir()
    await usuario.clear(screen.getByRole("textbox", { name: "Nome da loja" }))
    const horarios = secao("Horários")
    const fechaTerca = horarios.getByLabelText("Fecha na terça")
    await usuario.clear(fechaTerca)
    await usuario.type(fechaTerca, "18:00")
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))

    expect(await screen.findByText("Informe o nome da loja.")).toBeInTheDocument()
    expect(
      horarios.getByText("O fechamento precisa ser diferente da abertura."),
    ).toBeInTheDocument()
    expect((await api().loja()).nome).toBe("Casa da Pizza")
  })

  test("sem a conta online, Pix e cartão online desligam e ficam bloqueados", async () => {
    const usuario = await abrir()
    const pagamento = secao("Formas de pagamento")
    expect(pagamento.getByRole("switch", { name: "Pix" })).toBeChecked()

    await usuario.click(secao("Pagamento online").getByRole("button", { name: "Desconectar" }))
    await waitFor(() => expect(pagamento.getByRole("switch", { name: "Pix" })).not.toBeChecked())
    expect(pagamento.getByRole("switch", { name: "Pix" })).toBeDisabled()
    expect(pagamento.getByRole("switch", { name: "Cartão online" })).toBeDisabled()
    expect(pagamento.getByRole("switch", { name: "Dinheiro" })).toBeEnabled()
    expect(secao("Pagamento online").getByText("Não conectada")).toBeInTheDocument()
  })

  test("cidades atendidas, cupom de teste e o som da loja", async () => {
    const usuario = await abrir()
    const entrega = secao("Entrega e retirada")
    await usuario.type(entrega.getByRole("textbox", { name: "Nova cidade" }), "Jacareí{Enter}")
    expect(entrega.getByRole("button", { name: "Tirar Jacareí" })).toBeInTheDocument()

    await usuario.click(secao("Impressão").getByRole("button", { name: "Imprimir cupom de teste" }))
    expect(imprimir).toHaveBeenCalled()

    await usuario.click(secao("Alerta sonoro").getByRole("combobox", { name: "Som da loja" }))
    await usuario.click(await screen.findByRole("option", { name: "Suave" }))
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () => expect((await api().loja()).som).toBe("suave"))
    expect((await api().loja()).cidadesAtendidas).toEqual(["São José dos Campos", "Jacareí"])
  })
})

describe("PaginaLoja: por perfil", () => {
  test("o gerente não vê Formas de pagamento nem Pagamento online na loja", async () => {
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-gerente")
    await abrir()
    expect(screen.getByRole("region", { name: "Impressão" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Formas de pagamento" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Pagamento online" })).not.toBeInTheDocument()
  })

  test("o dono vê as duas", async () => {
    await abrir()
    expect(screen.getByRole("region", { name: "Formas de pagamento" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Pagamento online" })).toBeInTheDocument()
  })
})

describe("PaginaLoja: PDV e caixa", () => {
  test("muda o alerta para R$ 800 e salva", async () => {
    const usuario = await abrir()
    const pdv = secao("PDV e caixa")
    expect(pdv.getByLabelText("Fundo de troco sugerido")).toHaveValue("R$ 100,00")
    const alerta = pdv.getByLabelText("Alerta de sangria acima de")
    expect(alerta).toHaveValue("R$ 500,00")
    await usuario.tripleClick(alerta)
    await usuario.keyboard("800")
    expect(alerta).toHaveValue("R$ 800,00")
    await usuario.click(
      within(await screen.findByRole("region", { name: "Alterações não salvas" })).getByRole(
        "button",
        { name: "Salvar alterações" },
      ),
    )
    expect(await screen.findByText("Configurações salvas.")).toBeInTheDocument()
    expect((await api().loja()).pdv).toEqual({ fundoSugerido: 100, alertaSangria: 800 })
  })

  test("lanchonete não tem a seção", async () => {
    useSegmentoAtual.setState({ segmento: "lanchonete" })
    await abrir()
    expect(screen.queryByRole("region", { name: "PDV e caixa" })).not.toBeInTheDocument()
  })
})

describe("PaginaLoja: recursos de cada loja", () => {
  test("açougue: vitrines com título e liga/desliga", async () => {
    useSegmentoAtual.setState({ segmento: "acougue" })
    const usuario = await abrir()
    const vitrines = secao("Vitrines")
    const titulo = vitrines.getByRole("textbox", { name: "Título de Destaques" })
    await usuario.clear(titulo)
    await usuario.type(titulo, "Cortes da semana")
    await usuario.click(vitrines.getByRole("switch", { name: "Mostrar Ofertas" }))
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () =>
      expect((await servidorDo("acougue").loja()).vitrines).toMatchObject({
        destaques: { titulo: "Cortes da semana", ativo: true },
        ofertas: { ativo: false },
      }),
    )
  })

  test("salão: vídeo do banner só com link do YouTube, Shorts ou Reels; sem vitrines", async () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    const usuario = await abrir()
    expect(screen.queryByRole("region", { name: "Vitrines" })).not.toBeInTheDocument()
    const video = screen.getByRole("textbox", { name: "Vídeo do banner" })
    await usuario.type(video, "https://vimeo.com/123")
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    expect(await screen.findByText("Use um link do YouTube, Shorts ou Reels.")).toBeInTheDocument()

    await usuario.clear(video)
    await usuario.type(video, "https://www.youtube.com/shorts/abc123")
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () =>
      expect((await servidorDo("salao").loja()).videoBanner).toBe(
        "https://www.youtube.com/shorts/abc123",
      ),
    )
  })
})
