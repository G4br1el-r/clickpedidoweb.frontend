import { Suspense } from "react"
import { CabecalhoAdmin } from "@/components/admin/cabecalho-admin"
import { CarregandoModulo, PaginaModulo } from "@/components/admin/pagina-modulo"

/** Início do painel: a visão geral do segmento escolhido. */
export default function AdminPage() {
  return (
    <>
      <CabecalhoAdmin trilha={[{ titulo: "Visão geral" }]} />
      {/* Os filtros moram na URL: sem o Suspense, o build não consegue gerar a página. */}
      <Suspense fallback={<CarregandoModulo />}>
        <PaginaModulo id="visao-geral" />
      </Suspense>
    </>
  )
}
