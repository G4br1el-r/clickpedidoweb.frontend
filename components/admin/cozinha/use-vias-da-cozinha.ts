"use client"

import { useEffect, useRef } from "react"
import { useMarcarVia } from "@/lib/admin/dados/consultas"
import type { Pedido, Praca, Produto } from "@/lib/admin/dados/tipos"
import type { ConfigCozinha } from "@/lib/admin/regras/cozinha"
import { type ViaDaCozinha, viasAImprimir } from "@/lib/admin/regras/pracas"

/**
 * Imprime sozinho a via da rodada que chega em A fazer, com a chave do aparelho ligada.
 * Antes de imprimir, marca a via no servidor: só o primeiro aparelho a marcar imprime.
 * Na primeira leitura não há via nova: o que já estava na tela não sai de novo.
 */
export function useViasDaCozinha({
  pedidos,
  agora,
  tempos,
  produtos,
  pracas,
  viaDaCozinha,
  pracaDoAparelho,
  ligado,
  imprimir,
}: {
  pedidos: Pedido[] | undefined
  agora: Date | null
  tempos: ConfigCozinha
  produtos: Produto[] | undefined
  pracas: Praca[]
  viaDaCozinha: boolean | undefined
  pracaDoAparelho: string
  ligado: boolean
  imprimir: (vias: ViaDaCozinha[]) => void
}) {
  const marcar = useMarcarVia()
  const vistas = useRef<Set<string> | null>(null)
  const atuais = useRef({ tempos, produtos, pracas, viaDaCozinha, pracaDoAparelho, ligado })
  atuais.current = { tempos, produtos, pracas, viaDaCozinha, pracaDoAparelho, ligado }
  // mutateAsync: cada via espera a sua resposta.
  const aoMarcar = useRef({ marcar: marcar.mutateAsync, imprimir })
  aoMarcar.current = { marcar: marcar.mutateAsync, imprimir }

  useEffect(() => {
    const { tempos, produtos, pracas, viaDaCozinha, pracaDoAparelho, ligado } = atuais.current
    if (!pedidos || !agora || !produtos) return
    const vias = viasAImprimir(pedidos, {
      agora,
      tempos,
      produtos,
      pracas,
      viaDaCozinha,
      pracaDoAparelho,
    })
    const antes = vistas.current
    vistas.current = new Set([...(antes ?? []), ...vias.map((via) => via.chave)])
    if (!antes || !ligado) return
    const novas = vias.filter((nova) => !antes.has(nova.chave))
    // Uma de cada vez: duas marcas no mesmo pedido ao mesmo tempo, uma apagaria a outra.
    void (async () => {
      for (const via of novas) {
        const [id, ...resto] = via.chave.split(":")
        try {
          const { nova } = await aoMarcar.current.marcar({ id: Number(id), via: resto.join(":") })
          if (nova) aoMarcar.current.imprimir([via])
        } catch {
          // Sem marcar, não imprime; a próxima leitura tenta de novo.
          vistas.current?.delete(via.chave)
        }
      }
    })()
  }, [pedidos, agora])
}
