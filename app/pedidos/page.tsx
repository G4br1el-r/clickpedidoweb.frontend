import type { Metadata } from "next"
import { BuscarPedidos } from "@/components/pedido/buscar-pedidos"
import { clienteAtual } from "@/lib/cliente"

export const metadata: Metadata = {
  title: `Acompanhe seu pedido · ${clienteAtual.nome}`,
}

export default function Page() {
  return <BuscarPedidos />
}
