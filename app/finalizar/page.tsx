import type { Metadata } from "next"
import { Finalizar } from "@/components/finalizar/finalizar"
import { clienteAtual } from "@/lib/cliente"

export const metadata: Metadata = {
  title: `Finalizar pedido · ${clienteAtual.nome}`,
}

export default function Page() {
  return <Finalizar />
}
