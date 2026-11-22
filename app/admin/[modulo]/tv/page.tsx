import { notFound } from "next/navigation"
import { Suspense } from "react"
import { TvCozinha } from "@/components/admin/cozinha/tv-cozinha"

// Só a cozinha tem modo TV.
export function generateStaticParams() {
  return [{ modulo: "cozinha" }]
}

export const dynamicParams = false

export default async function TvPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params
  if (modulo !== "cozinha") notFound()
  return (
    // A praça mora na URL: sem o Suspense, o build não consegue gerar a página.
    <Suspense>
      <TvCozinha />
    </Suspense>
  )
}
