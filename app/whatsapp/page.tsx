import type { Metadata } from "next"
import { ConversaSimulada } from "@/components/whatsapp/conversa-simulada"
import { clienteAtual } from "@/lib/cliente"

export const metadata: Metadata = {
  title: `Conversa simulada · ${clienteAtual.nome}`,
}

export default function Page() {
  return <ConversaSimulada />
}
