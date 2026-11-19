import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { servidorDo } from "@/lib/admin/dados/consultas"
import { PaginaPdv } from "../pagina-pdv"

/** Os provedores do painel nos testes do PDV: endereço, React Query, dicas e avisos. */
export function Provedores({
  children,
  endereco = "",
}: {
  children: ReactNode
  endereco?: string
}) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter searchParams={endereco} hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

/** Abre o PDV no endereço dado e espera o título da tela. */
export async function abrirPdv(titulo: string | RegExp, endereco = "") {
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={endereco}>
      <PaginaPdv />
    </Provedores>,
  )
  await screen.findByRole("heading", { level: 1, name: titulo }, { timeout: 8000 })
  return usuario
}

/** Venda de balcão feita pela Marina direto no servidor da pizzaria. */
export const venderNoServidor = (preco: number, pagamento: "dinheiro" | "pix" = "dinheiro") =>
  servidorDo("pizzaria").pdv.finalizar({
    operadorId: "eq-marina",
    itens: [{ avulso: { nome: "Água", preco }, quantidade: 1 }],
    pagamento,
    desconto: { modo: "reais", valor: 0 },
    concluida: true,
  })
