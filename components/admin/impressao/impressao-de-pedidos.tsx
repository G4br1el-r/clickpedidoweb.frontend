"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useMarcarImpresso } from "@/lib/admin/dados/consultas-entrega"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { Cupom, useImpressora } from "./cupom"

/**
 * Fila de impressão dos cupons: um de cada vez, e cada um marcado como impresso.
 * `elemento` precisa estar na tela (fica escondido; é dele que sai o cupom).
 */
export function useImpressaoDePedidos() {
  const { data: loja } = useLoja()
  const marcar = useMarcarImpresso()
  const { area, imprimir } = useImpressora("Cupom do pedido")
  const [fila, setFila] = useState<Pedido[]>([])
  const atual = fila[0]

  // Com o cupom do primeiro da fila na tela, manda imprimir e passa para o próximo.
  // Só o pedido da vez dispara: cada cupom sai uma vez.
  const mandar = useEffectEvent((pedido: Pedido) => {
    imprimir()
    marcar.mutate(pedido.id)
    setFila((resto) => resto.slice(1))
  })
  useEffect(() => {
    if (atual) mandar(atual)
  }, [atual])

  return {
    imprimir: (pedido: Pedido) => setFila((atuais) => [...atuais, pedido]),
    elemento: atual && loja ? <Cupom pedido={atual} loja={loja.nome} area={area} /> : null,
  }
}
