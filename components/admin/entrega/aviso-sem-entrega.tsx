"use client"

import { InfoIcon } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useLoja } from "@/lib/admin/dados/consultas"

/** Motoboys e bairros continuam editáveis com a entrega desligada; o aviso diz o porquê. */
export function AvisoSemEntrega() {
  const { data: loja } = useLoja()
  if (!loja || loja.aceitaEntrega) return null
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>A loja não está aceitando entregas agora.</AlertTitle>
      <AlertDescription>
        <span>
          Dá para cadastrar e editar à vontade. Para voltar a entregar, ligue a entrega na Fila ou
          em{" "}
          <Link href="/admin/loja" className="underline underline-offset-4">
            Configurações da loja
          </Link>
          .
        </span>
      </AlertDescription>
    </Alert>
  )
}
