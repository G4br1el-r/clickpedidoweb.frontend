"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { HistoryIcon } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { useResolverEmLote } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { rotuloCanal } from "@/lib/admin/regras/rotulos"
import { plural } from "@/lib/formato"
import { ConfirmarComMotivo } from "../pedidos/confirmar-com-motivo"
import { SeloStatus } from "../pedidos/selos"

/**
 * O que ficou aberto de outro dia não polui as colunas de hoje: fica num aviso, e a loja
 * resolve tudo de uma vez (entregues e cobrados, ou cancelados com um motivo).
 */
export function AvisoDiasAnteriores({ pedidos }: { pedidos: Pedido[] }) {
  const [aberto, setAberto] = useState(false)
  const lote = useResolverEmLote()
  if (pedidos.length === 0) return null
  const ids = pedidos.map((pedido) => pedido.id)
  const feito = (texto: string) => ({
    onSuccess: () => {
      setAberto(false)
      toast.success(texto)
    },
    onError: (erro: Error) => toast.error(erro.message),
  })
  const ocupado = lote.concluir.isPending || lote.cancelar.isPending

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="self-start border-(--atencao)/60 bg-(--atencao)/10"
        >
          <HistoryIcon data-icon="inline-start" />
          {plural(pedidos.length, "pedido", "pedidos")} de dias anteriores
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedidos de dias anteriores</DialogTitle>
          <DialogDescription>
            Ficaram abertos e saíram da fila de hoje. Conclua os que já foram entregues ou cancele
            os que não vão sair.
          </DialogDescription>
        </DialogHeader>
        <ul
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a lista rola e precisa de foco pelo teclado (WCAG, axe scrollable-region-focusable).
          tabIndex={0}
          aria-label="Pedidos esquecidos"
          className="flex max-h-80 flex-col divide-y divide-border/70 overflow-y-auto rounded-md text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          {pedidos.map((pedido) => (
            <li key={pedido.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="font-semibold tabular-nums">#{pedido.numero}</span>
              <span className="min-w-0 flex-1 truncate">{pedido.cliente.nome}</span>
              <SeloStatus pedido={pedido} />
              <span className="w-full text-xs text-muted-foreground first-letter:uppercase">
                {rotuloCanal(pedido.tipo)} ·{" "}
                {format(new Date(pedido.criadoEm), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <ConfirmarComMotivo
            gatilho={
              <Button type="button" variant="ghost" className="text-destructive" disabled={ocupado}>
                Cancelar todos
              </Button>
            }
            titulo={`Cancelar ${plural(pedidos.length, "pedido", "pedidos")}?`}
            descricao="Todos saem com o mesmo motivo. Os que já estavam pagos ficam marcados para devolver."
            confirmar="Sim, cancelar todos"
            aoConfirmar={(escolhido) =>
              lote.cancelar.mutate({ ids, ...escolhido }, feito("Pedidos cancelados."))
            }
          />
          <Button
            type="button"
            disabled={ocupado}
            onClick={() => lote.concluir.mutate(ids, feito("Pedidos concluídos."))}
          >
            Concluir todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
