import { notFound } from "next/navigation"
import { ChamadaCozinha } from "@/components/admin/cozinha/chamada-cozinha"

// Só a cozinha tem painel de chamada.
export function generateStaticParams() {
  return [{ modulo: "cozinha" }]
}

export const dynamicParams = false

export default async function ChamadaPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params
  if (modulo !== "cozinha") notFound()
  return <ChamadaCozinha />
}
