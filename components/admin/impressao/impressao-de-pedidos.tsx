"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { toast } from "sonner"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { useMarcarImpresso } from "@/lib/admin/dados/consultas-entrega"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { situacaoDaImpressora, textoDaImpressora } from "@/lib/admin/regras/impressora"
import { pedidoComAlcool } from "@/lib/admin/regras/maioridade"
import { type ViaDoCupom, viasDoPedido } from "@/lib/admin/regras/vias"
import { Cupom, useImpressora } from "./cupom"

type Copia = { pedido: Pedido; via: ViaDoCupom; ultima: boolean }

/**
 * Fila de impressão dos cupons: uma cópia de cada vez, nas vias do canal (produção e
 * cliente/entregador, como a loja escolheu), e o pedido marcado como impresso uma vez.
 * `elemento` precisa estar na tela (fica escondido; é dele que sai o cupom).
 */
export function useImpressaoDePedidos() {
  const { data: loja } = useLoja()
  const { data: produtos = [] } = useProdutos()
  const marcar = useMarcarImpresso()
  const { area, imprimir } = useImpressora("Cupom do pedido")
  const [fila, setFila] = useState<Copia[]>([])
  const atual = fila[0]

  // Com a cópia da vez na tela, manda imprimir e passa para a próxima.
  // Só a cópia da vez dispara: cada uma sai uma vez.
  const mandar = useEffectEvent((copia: Copia) => {
    imprimir()
    if (copia.ultima) marcar.mutate(copia.pedido.id)
    setFila((resto) => resto.slice(1))
  })
  useEffect(() => {
    if (atual) mandar(atual)
  }, [atual])

  return {
    /** `automatica`: a fila imprimiu sozinha o pedido que chegou (o aviso de falha diz isso). */
    imprimir: (pedido: Pedido, { automatica = false }: { automatica?: boolean } = {}) => {
      const situacao = situacaoDaImpressora(usePreferenciasFila.getState())
      if (situacao !== "online") {
        toast.error(
          automatica
            ? `A impressão automática falhou: #${pedido.numero} ficou sem cupom. ${textoDaImpressora(situacao)}.`
            : `${textoDaImpressora(situacao)}: o cupom de #${pedido.numero} não saiu.`,
        )
        return
      }
      const vias = viasDoPedido(loja ?? {}, pedido.tipo)
      // Canal sem via escolhida: sai a do cliente, para o pedido nunca ficar sem cupom.
      const escolhidas: ViaDoCupom[] = vias.length > 0 ? vias : ["cliente"]
      setFila((atuais) => [
        ...atuais,
        ...escolhidas.map((via, indice) => ({
          pedido,
          via,
          ultima: indice === escolhidas.length - 1,
        })),
      ])
    },
    elemento:
      atual && loja ? (
        <Cupom
          pedido={atual.pedido}
          loja={loja.nome}
          area={area}
          via={atual.via}
          maioridade={pedidoComAlcool(atual.pedido, produtos)}
        />
      ) : null,
  }
}
