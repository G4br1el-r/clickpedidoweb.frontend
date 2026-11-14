import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CabecalhoAdmin } from "@/components/admin/cabecalho-admin"
import { CarregandoModulo, PaginaModulo } from "@/components/admin/pagina-modulo"
import { buscarModulo, MODULOS_PAINEL } from "@/lib/admin/segmentos-painel"

// A visão geral mora em /admin; "configuracoes" tem rota própria e vence a dinâmica.
export function generateStaticParams() {
  return MODULOS_PAINEL.filter((modulo) => modulo.id !== "visao-geral").map((modulo) => ({
    modulo: modulo.id,
  }))
}

export const dynamicParams = false

export default async function ModuloPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo: id } = await params
  const modulo = buscarModulo(id)
  if (!modulo || modulo.id === "visao-geral") notFound()
  return (
    <>
      <CabecalhoAdmin trilha={[{ titulo: modulo.titulo, modulo: modulo.id }]} />
      {/* Os filtros moram na URL: sem o Suspense, o build não consegue gerar a página. */}
      <Suspense fallback={<CarregandoModulo />}>
        <PaginaModulo id={modulo.id} />
      </Suspense>
    </>
  )
}
