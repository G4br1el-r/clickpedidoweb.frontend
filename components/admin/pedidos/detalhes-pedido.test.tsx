import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { DetalhesPedido } from "./detalhes-pedido"

function Provedores({
  children,
  busca,
}: {
  children: ReactNode
  busca: string | Record<string, string>
}) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={busca}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar(id: number) {
  return render(
    <Provedores busca={{ pedido: String(id) }}>
      <DetalhesPedido />
    </Provedores>,
  )
}

async function umPedido(condicao: (pedido: Pedido) => boolean) {
  const pedidos = await servidorDo(useSegmentoAtual.getState().segmento).pedidos.listar()
  const pedido = pedidos.find(condicao)
  if (!pedido) throw new Error("Nenhum pedido de demonstração com essa condição")
  return pedido
}

const painel = async (pedido: Pedido) =>
  within(await screen.findByRole("dialog", { name: `Pedido #${pedido.numero}` }, { timeout: 5000 }))

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

describe("DetalhesPedido", () => {
  test("mostra o caminho do pedido: o que já passou, a etapa atual e o que falta", async () => {
    const pedido = await umPedido((p) => p.tipo === "entrega" && p.status === "em-preparo")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    const caminho = within(detalhes.getByRole("list", { name: "Caminho do pedido" }))
    const etapas = caminho.getAllByRole("listitem")
    expect(etapas.map((etapa) => etapa.textContent)).toEqual([
      "Novo",
      "Em preparo",
      "Pronto",
      "Saiu para entrega",
      "Entregue",
    ])
    expect(etapas[1]).toHaveAttribute("aria-current", "step")
    expect(etapas[0]).toHaveAttribute("data-feita")
    expect(etapas[2]).not.toHaveAttribute("data-feita")
  })

  test("entrega: itens, endereço com mapa e WhatsApp do cliente", async () => {
    const pedido = await umPedido((p) => p.tipo === "entrega" && p.status === "em-preparo")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    expect(detalhes.getByText(pedido.itens[0].nome)).toBeInTheDocument()
    expect(detalhes.getByRole("link", { name: "Abrir no mapa" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://www.google.com/maps/search/"),
    )
    expect(detalhes.getByRole("link", { name: "Avisar no WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining(`https://wa.me/55${pedido.cliente.telefone}`),
    )
  })

  test("o botão principal diz a próxima etapa e avança", async () => {
    const usuario = userEvent.setup()
    const pedido = await umPedido((p) => p.tipo === "entrega" && p.status === "em-preparo")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    await usuario.click(detalhes.getByRole("button", { name: "Marcar como pronto" }))
    expect(await detalhes.findByRole("button", { name: "Saiu para entrega" })).toBeInTheDocument()
  })

  test("cancelar pede confirmação antes", async () => {
    const usuario = userEvent.setup()
    const pedido = await umPedido((p) => p.status === "recebido")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    await usuario.click(detalhes.getByRole("button", { name: "Cancelar pedido" }))
    const confirmacao = screen.getByRole("alertdialog", {
      name: `Cancelar o pedido #${pedido.numero}?`,
    })
    await usuario.click(within(confirmacao).getByRole("button", { name: "Sim, cancelar" }))

    expect(await detalhes.findByText("Cancelado")).toBeInTheDocument()
    expect(detalhes.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument()
  })

  test("ao cancelar dá para escolher o motivo, que fica guardado e aparece no pedido", async () => {
    const usuario = userEvent.setup()
    const pedido = await umPedido((p) => p.status === "recebido")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    await usuario.click(detalhes.getByRole("button", { name: "Cancelar pedido" }))
    const confirmacao = within(screen.getByRole("alertdialog"))
    const motivos = confirmacao.getByRole("radiogroup", { name: "Motivo (opcional)" })
    await usuario.click(within(motivos).getByRole("radio", { name: "Fora da área de entrega" }))
    await usuario.click(confirmacao.getByRole("button", { name: "Sim, cancelar" }))

    expect(await detalhes.findByText("Motivo: Fora da área de entrega")).toBeInTheDocument()
    const guardado = await servidorDo(useSegmentoAtual.getState().segmento).pedidos.buscar(
      pedido.id,
    )
    expect(guardado?.motivoCancelamento).toBe("fora-da-area")
  })

  test("a comanda cancelada pela mesa mostra o motivo escrito", async () => {
    const api = servidorDo(useSegmentoAtual.getState().segmento)
    const mesa = await api.mesas.criar({ numero: 90 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.cancelarComanda(comanda.id, { motivo: "Cliente foi embora" })
    renderizar(comanda.id)
    const detalhes = await painel(comanda)

    expect(detalhes.getByText("Motivo: Outro · Cliente foi embora")).toBeInTheDocument()
  })

  test("a comanda de mesa aberta não se cancela aqui: o painel leva para a mesa", async () => {
    const api = servidorDo(useSegmentoAtual.getState().segmento)
    const mesa = await api.mesas.criar({ numero: 90 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    renderizar(comanda.id)
    const detalhes = await painel(comanda)

    expect(detalhes.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument()
    expect(detalhes.getByText(/Cancele pela tela de Mesas\./)).toBeInTheDocument()
    expect(detalhes.getByRole("link", { name: "Abrir a mesa 90" })).toHaveAttribute(
      "href",
      "/admin/mesas?mesa=90",
    )
  })

  test("cancelado sem motivo mostra Não informado", async () => {
    const pedido = await umPedido((p) => p.status === "cancelado" && !p.motivoCancelamento)
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    expect(detalhes.getByText("Motivo: Não informado")).toBeInTheDocument()
  })

  test("marcar como pago some depois de pago", async () => {
    const usuario = userEvent.setup()
    const pedido = await umPedido(
      (p) => p.situacaoPagamento === "na-entrega" && p.status !== "cancelado",
    )
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    await usuario.click(detalhes.getByRole("button", { name: "Marcar como pago" }))
    expect(await detalhes.findByText("Pago")).toBeInTheDocument()
    expect(await screen.findByText("Pagamento registrado.")).toBeInTheDocument()
    expect(detalhes.queryByRole("button", { name: "Marcar como pago" })).not.toBeInTheDocument()
  })

  test("escolher o motoboy prepara a mensagem para ele", async () => {
    const usuario = userEvent.setup()
    const pedido = await umPedido((p) => p.tipo === "entrega" && p.status === "pronto")
    const [motoboy] = await servidorDo("pizzaria").motoboys.listar()
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    await usuario.click(detalhes.getByRole("combobox", { name: "Motoboy" }))
    await usuario.click(await screen.findByRole("option", { name: motoboy.nome }))

    expect(await detalhes.findByRole("link", { name: `Chamar ${motoboy.nome}` })).toHaveAttribute(
      "href",
      expect.stringContaining(`https://wa.me/55${motoboy.telefone}`),
    )
  })

  test("mesa mostra a mesa e o garçom; mesa pronta não tem próxima etapa", async () => {
    const pedido = await umPedido((p) => p.tipo === "mesa" && p.status === "pronto")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    expect(detalhes.getByText(`Mesa ${pedido.mesa?.numero}`)).toBeInTheDocument()
    expect(detalhes.getByText(`Garçom: ${pedido.mesa?.garcom}`)).toBeInTheDocument()
    expect(detalhes.getByText("A comanda fecha em Mesas")).toBeInTheDocument()
  })

  test("no salão, mostra quando o atendimento está marcado", async () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    const pedido = await umPedido((p) => p.status === "recebido")
    renderizar(pedido.id)
    const detalhes = await painel(pedido)

    expect(detalhes.getByText(/^Marcado para /)).toBeInTheDocument()
    expect(detalhes.getByRole("button", { name: "Iniciar atendimento" })).toBeInTheDocument()
  })
})
