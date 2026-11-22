import type { Metadata } from "next"
import { PainelChamada } from "@/components/admin/chamada/painel-chamada"

export const metadata: Metadata = { title: "Painel de chamada · ClickPedido" }

/** Para a TV virada ao cliente: o shell do painel some nesta rota (ver `ShellAdmin`). */
export default function ChamadaPage() {
  return <PainelChamada />
}
