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

describe("PaginaLoja: fila e pedidos", () => {
  test("aceite manual, limite do aceite e a sirene como som da loja", async () => {
    const usuario = await abrir()
    const fila = secao("Fila e pedidos")
    const aceite = fila.getByRole("switch", { name: "Aceitar cada pedido do site na Fila" })
    expect(aceite).toBeChecked()

    const limite = fila.getByRole("spinbutton", { name: "Minutos até o alerta de atraso" })
    await usuario.clear(limite)
    await usuario.type(limite, "8")
    await usuario.click(secao("Alerta sonoro").getByRole("combobox", { name: "Som da loja" }))
    await usuario.click(await screen.findByRole("option", { name: "Sirene" }))
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () =>
      expect(await api().loja()).toMatchObject({ limiteAceiteMin: 8, som: "sirene" }),
    )

    await usuario.click(aceite)
    expect(limite).toBeDisabled()
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () => expect((await api().loja()).aceiteManual).toBe(false))
  })

  test("avisos ao cliente: editar o texto da saída para entrega e desligar", async () => {
    const usuario = await abrir()
    const fila = secao("Fila e pedidos")
    const avisar = fila.getByRole("switch", { name: "Avisar o cliente no WhatsApp" })
    expect(avisar).toBeChecked()
    const saiu = fila.getByRole("textbox", { name: "Saiu para entrega" })
    expect(saiu).toHaveValue(
      "Olá, {nome}! Seu pedido #{numero} saiu para entrega. Acompanhe: {link}",
    )

    await usuario.clear(saiu)
    await usuario.type(saiu, "Já vai, {{nome}!")
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () =>
      expect((await api().loja()).avisosCliente?.textos?.saiu).toBe("Já vai, {nome}!"),
    )

    await usuario.click(avisar)
    expect(saiu).toBeDisabled()
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(async () => expect((await api().loja()).avisosCliente?.ligado).toBe(false))
  })

  test("limite fora de 1 a 30 minutos mostra o erro no campo", async () => {
    const usuario = await abrir()
    const limite = secao("Fila e pedidos").getByRole("spinbutton", {
      name: "Minutos até o alerta de atraso",
    })
    await usuario.clear(limite)
    await usuario.type(limite, "45")
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }))

    expect(await screen.findByText("Entre 1 e 30 minutos.")).toBeInTheDocument()
    expect((await api().loja()).limiteAceiteMin).toBe(5)
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
