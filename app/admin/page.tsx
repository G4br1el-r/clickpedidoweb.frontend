import { CabecalhoAdmin } from "@/components/admin/cabecalho-admin"
import { PaginaModulo } from "@/components/admin/pagina-modulo"

/** Início do painel: a visão geral do segmento escolhido. */
export default function AdminPage() {
  return (
    <>
      <CabecalhoAdmin trilha={[{ titulo: "Visão geral" }]} />
      <PaginaModulo id="visao-geral" />
    </>
  )
}
