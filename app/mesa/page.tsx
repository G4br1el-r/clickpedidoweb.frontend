import type { Metadata } from "next"
import { VitrineMesa } from "@/components/mesa/vitrine-mesa"

export const metadata: Metadata = {
  title: "Pedido na mesa",
}

type Parametros = { [chave: string]: string | string[] | undefined }

const texto = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor : "")

/**
 * A vitrine em modo mesa, aberta pelo QR: `/mesa?loja=pizzaria&mesa=mesa-7`. A loja é o
 * segmento do painel e a mesa vai pelo id. Os parâmetros são lidos na requisição (rota dinâmica).
 */
export default async function Page({ searchParams }: { searchParams: Promise<Parametros> }) {
  const { loja, mesa } = await searchParams
  return <VitrineMesa segmento={texto(loja)} mesaId={texto(mesa)} />
}
