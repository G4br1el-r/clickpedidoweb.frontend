"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { useEditarItem } from "@/lib/admin/dados/consultas-mesas"
import type { ItemPedido, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { precoDeBalcao } from "@/lib/admin/regras/pdv"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { JanelaOpcoes } from "../pdv/janela-opcoes"

/**
 * Edita o item enquanto a cozinha não preparou (Q29). O item do cardápio com as escolhas
 * guardadas abre a janela de opções já marcada; o resto (avulso, item antigo sem escolhas,
 * produto sem opções) troca só a observação.
 */
export function EditarItem({
  pedido,
  item,
  aoFechar,
}: {
  pedido: Pedido
  item: ItemPedido | null
  aoFechar: () => void
}) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: produtos } = useProdutos()
  const editar = useEditarItem()
  const doAparelho = useGarcom((estado) => estado.nome)
  const produto = item?.produtoId
    ? produtos?.find((atual) => atual.id === item.produtoId)
    : undefined
  const comOpcoes = item?.escolhas && produto?.grupos.some((grupo) => grupo.ativo)

  const salvar = (mudanca: { observacao: string; escolhas?: Record<string, string[]> }) =>
    item &&
    editar.mutate(
      {
        pedidoId: pedido.id,
        itemId: item.id,
        ...mudanca,
        ...autorDaAcao(doAparelho, pedido.mesa?.garcom),
      },
      { onSuccess: aoFechar, onError: (erro) => toast.error(erro.message) },
    )

  if (item && produto && comOpcoes) {
    return (
      <JanelaOpcoes
        key={item.id}
        produto={produto}
        precoBase={precoDeBalcao(produto, segmento)}
        inicial={{
          escolhas: item.escolhas ?? {},
          ...(item.observacao ? { observacao: item.observacao } : {}),
        }}
        aoFechar={aoFechar}
        aoAdicionar={(editado, escolhas) =>
          salvar({ observacao: editado.observacao ?? "", escolhas })
        }
      />
    )
  }
  return (
    <Dialog open={item !== null} onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        {item && (
          <Observacao
            key={item.id}
            item={item}
            enviando={editar.isPending}
            aoSalvar={(observacao) => salvar({ observacao })}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Observacao({
  item,
  enviando,
  aoSalvar,
}: {
  item: ItemPedido
  enviando: boolean
  aoSalvar: (observacao: string) => void
}) {
  const [observacao, setObservacao] = useState(item.observacao ?? "")
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        aoSalvar(observacao)
      }}
    >
      <DialogHeader>
        <DialogTitle>Editar {item.nome}</DialogTitle>
        <DialogDescription>
          {item.opcoes.length > 0 ? item.opcoes.join(" · ") : "A cozinha ainda não preparou."}
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="editar-item-observacao">Observação</FieldLabel>
        <Textarea
          id="editar-item-observacao"
          rows={2}
          maxLength={140}
          placeholder="Ex.: sem cebola"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={enviando}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
