import { CabecalhoAdmin } from "@/components/admin/cabecalho-admin"

/** Início do painel: por enquanto só a estrutura, o conteúdo chega com as próximas áreas. */
export default function AdminPage() {
  return (
    <>
      <CabecalhoAdmin trilha={[{ titulo: "Início" }]} />
      <div className="flex-1" />
    </>
  )
}
