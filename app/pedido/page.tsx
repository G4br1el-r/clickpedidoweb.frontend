import type { Metadata } from "next"
import { Acompanhamento } from "@/components/pedido/acompanhamento"
import { clienteAtual } from "@/lib/cliente"

export const metadata: Metadata = {
  title: `Seu pedido · ${clienteAtual.nome}`,
}

export default function Page() {
  return <Acompanhamento />
}
