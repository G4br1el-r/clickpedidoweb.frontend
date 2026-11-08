import { notFound } from "next/navigation"
import { PaginaSecao } from "@/components/admin/pagina-secao"
import { buscarSecao, SECOES } from "@/lib/admin/secoes"

export function generateStaticParams() {
  return SECOES.map((secao) => ({ secao: secao.id }))
}

export default async function SecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao: id } = await params
  const secao = buscarSecao(id)
  if (!secao) notFound()
  return <PaginaSecao id={secao.id} />
}
