"use client"

import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLancarNaMesa } from "@/lib/admin/dados/consultas-mesas"
import type { LancamentoMesa } from "@/lib/admin/dados/servidor"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { Bandeja, useRodada } from "../garcom/montar-rodada"
import { CatalogoBalcao } from "../pdv/catalogo-balcao"

/**
 * Lança na comanda aberta, pela bandeja ou pelo item avulso: vai com o garçom da comanda,
 * assinado por quem está no aparelho (ou pelo garçom), e avisa quando a rodada desfaz o
 * "Pediu a conta" (Q23).
 */
export function useLancarNaComanda(mesa: Mesa, comanda: Pedido) {
  const lancar = useLancarNaMesa()
  const doAparelho = useGarcom((estado) => estado.nome)
  const garcom = comanda.mesa?.garcom
  return {
    enviando: lancar.isPending,
    lancar(lancamento: Pick<LancamentoMesa, "itens" | "enviarParaCozinha">, aoLancar: () => void) {
      lancar.mutate(
        {
          mesaId: mesa.id,
          ...lancamento,
          ...(garcom ? { garcom } : {}),
          ...autorDaAcao(doAparelho, garcom),
        },
        {
          onSuccess: () => {
            aoLancar()
            if (comanda.contaPedidaEm) {
              toast.info(`A mesa ${mesa.numero} tinha pedido a conta e voltou para Ocupada.`)
            }
          },
          onError: (erro) => toast.error(erro.message),
        },
      )
    },
  }
}

/** "Adicionar itens" da comanda: o catálogo e a bandeja do Garçom, para a mesa aberta (Q15). */
export function AdicionarItens({
  mesa,
  comanda,
  aberta,
  aoMudar,
}: {
  mesa: Mesa
  comanda: Pedido
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  const rodada = useRodada()
  const naComanda = useLancarNaComanda(mesa, comanda)

  const aoLancar = (enviarParaCozinha: boolean) =>
    naComanda.lancar({ enviarParaCozinha, itens: rodada.lancados() }, () => {
      toast.success(
        `Mesa ${mesa.numero}: ${enviarParaCozinha ? "enviado para a cozinha" : "lançado na comanda"}.`,
      )
      rodada.limpar()
      aoMudar(false)
    })

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Adicionar itens · Mesa {mesa.numero}</DialogTitle>
          <DialogDescription>
            Monte a rodada e envie para a cozinha ou lance na mesa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <CatalogoBalcao quantidadeNa={rodada.quantidadeNa} aoTocar={rodada.tocarProduto} />
          <aside className="lg:border-l lg:border-border/70 lg:pl-6">
            <Bandeja
              itens={rodada.itens}
              mesa={mesa}
              enviando={naComanda.enviando}
              aviso={rodada.aviso}
              mudarQuantidade={rodada.mudarQuantidade}
              remover={rodada.remover}
              aoLancar={aoLancar}
            />
          </aside>
        </div>
        {rodada.janela}
      </DialogContent>
    </Dialog>
  )
}
