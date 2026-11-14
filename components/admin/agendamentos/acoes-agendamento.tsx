"use client"

import { format } from "date-fns"
import { CalendarClockIcon, PrinterIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
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
import { useAgora } from "@/hooks/use-agora"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useRemarcar } from "@/lib/admin/dados/consultas-agenda"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { emReais } from "@/lib/formato"
import { EscolhaHorario, textoDoHorario, textoDuracao } from "./escolha-horario"

function Remarcar({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const { data: loja } = useLoja()
  const agora = useAgora(60_000)
  const remarcar = useRemarcar()
  const [inicio, setInicio] = useState<string | null>(null)
  const servicos = pedido.itens.flatMap((item) => (item.produtoId ? [item.produtoId] : []))

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Remarcar o agendamento #{pedido.numero}</DialogTitle>
          <DialogDescription>
            Hoje está para {textoDoHorario(new Date(pedido.agendamento?.inicio ?? pedido.criadoEm))}
            .
          </DialogDescription>
        </DialogHeader>
        {loja && agora && (
          <EscolhaHorario
            servicos={servicos}
            ignorarId={pedido.id}
            diaInicial={new Date(pedido.agendamento?.inicio ?? agora)}
            agora={agora}
            horarios={loja.horarios}
            valor={inicio}
            aoMudar={setInicio}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            disabled={!inicio || remarcar.isPending}
            onClick={() =>
              inicio &&
              remarcar.mutate(
                { id: pedido.id, inicio },
                {
                  onSuccess: () => {
                    toast.success(`Marcado para ${textoDoHorario(new Date(inicio))}.`)
                    aoFechar()
                  },
                  onError: (erro) => {
                    toast.error(erro.message)
                    setInicio(null)
                  },
                },
              )
            }
          >
            Remarcar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Comprovante de 80 mm do agendamento. Fica fora da tela e só aparece na impressão. */
function Comprovante({
  pedido,
  loja,
  ref,
}: {
  pedido: Pedido
  loja: string | undefined
  ref: React.Ref<HTMLDivElement>
}) {
  const inicio = new Date(pedido.agendamento?.inicio ?? pedido.criadoEm)
  return (
    <div className="hidden">
      <div ref={ref} className="flex flex-col gap-2 p-2 font-mono text-xs text-black">
        <p className="text-center font-bold">{loja}</p>
        <p className="text-center">Agendamento #{pedido.numero}</p>
        <p className="text-center">{format(inicio, "dd/MM/yyyy 'às' HH:mm")}</p>
        <hr className="border-dashed border-black" />
        <p>Cliente: {pedido.cliente.nome}</p>
        {pedido.itens.map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <span>{item.nome}</span>
            <span>{emReais(item.total)}</span>
          </div>
        ))}
        <hr className="border-dashed border-black" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{emReais(pedido.total)}</span>
        </div>
        <p>
          Duração: {textoDuracao(pedido.agendamento?.duracaoMin ?? 60)} ·{" "}
          {rotuloPagamento(pedido.pagamento)}
          {pedido.situacaoPagamento === "pago" ? " · PAGO" : " · a pagar no salão"}
        </p>
      </div>
    </div>
  )
}

/** Nos detalhes de um agendamento: imprimir o comprovante e remarcar antes de começar. */
export function AcoesAgendamento({ pedido }: { pedido: Pedido }) {
  const { data: loja } = useLoja()
  const [remarcando, setRemarcando] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: area,
    documentTitle: `Agendamento ${pedido.numero}`,
    pageStyle:
      "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px }",
  })

  return (
    <div className="flex flex-wrap gap-2">
      {pedido.status === "recebido" && (
        <Button type="button" variant="outline" size="sm" onClick={() => setRemarcando(true)}>
          <CalendarClockIcon data-icon="inline-start" />
          Remarcar
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => imprimir()}>
        <PrinterIcon data-icon="inline-start" />
        Imprimir comprovante
      </Button>
      <Comprovante pedido={pedido} loja={loja?.nome} ref={area} />
      {remarcando && <Remarcar pedido={pedido} aoFechar={() => setRemarcando(false)} />}
    </div>
  )
}
