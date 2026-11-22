"use client"

import { SmartphoneIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfigSalao } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { urlDaMesa } from "@/lib/admin/regras/qr"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"

/**
 * "Simular cliente na mesa": abre a vitrine da mesa numa aba nova, como o QR abriria. Os dados
 * moram neste navegador, então a demonstração do cliente é aqui mesmo, em outra aba.
 */
export function SimularCliente({ mesa }: { mesa: Mesa }) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: salao } = useConfigSalao()
  if (!salao?.funcoes.qr || mesa.bloqueio) return null
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() =>
        window.open(urlDaMesa(window.location.origin, segmento, mesa.id), "_blank", "noopener")
      }
    >
      <SmartphoneIcon data-icon="inline-start" />
      Simular cliente na mesa
    </Button>
  )
}
