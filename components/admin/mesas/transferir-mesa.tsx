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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMesas, useTransferirMesa } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { useAvisoComDesfazer } from "./aviso-desfazer"

/** Mesa que pode receber a comanda inteira: livre, sem bloqueio e sem estar junto de outra. */
export const recebeComanda = (mesa: Mesa) =>
  mesa.status === "livre" && !mesa.bloqueio && !mesa.juntadaCom

function Campos({
  mesa,
  comanda,
  aoFechar,
}: {
  mesa: Mesa
  comanda: Pedido
  aoFechar: () => void
}) {
  const { data: mesas } = useMesas()
  const transferir = useTransferirMesa()
  const avisar = useAvisoComDesfazer()
  const por = useGarcom((estado) => estado.nome)
  const [destino, setDestino] = useState("")
  const [tentou, setTentou] = useState(false)
  const livres = (mesas ?? []).filter((outra) => outra.id !== mesa.id && recebeComanda(outra))
  const numero = mesas?.find((outra) => outra.id === destino)?.numero
  const erro = tentou && !destino ? "Escolha a mesa." : null
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        if (!destino) return
        transferir.mutate(
          {
            pedidoId: comanda.id,
            mesaDestinoId: destino,
            ...autorDaAcao(por, comanda.mesa?.garcom),
          },
          {
            onSuccess: ({ desfazer }) => {
              avisar(`Mesa ${mesa.numero} transferida para a mesa ${numero}.`, desfazer)
              aoFechar()
            },
            onError: (falha) => toast.error(falha.message),
          },
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Transferir a mesa {mesa.numero}</DialogTitle>
        <DialogDescription>
          A comanda vai inteira para a mesa livre, e a mesa {mesa.numero} fica livre.
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={Boolean(erro)}>
        <FieldLabel htmlFor="transferir-destino">Para a mesa</FieldLabel>
        <Select value={destino} onValueChange={setDestino}>
          <SelectTrigger
            id="transferir-destino"
            aria-label="Para a mesa"
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? "transferir-destino-erro" : undefined}
            className="w-full"
          >
            <SelectValue placeholder="Escolha a mesa livre" />
          </SelectTrigger>
          <SelectContent>
            {livres.map((outra) => (
              <SelectItem key={outra.id} value={outra.id}>
                Mesa {outra.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erro && <FieldError id="transferir-destino-erro">{erro}</FieldError>}
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={transferir.isPending}>
          Transferir
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Transferir a mesa (Q7): a comanda inteira vai para uma mesa livre, com "Desfazer". */
export function TransferirMesa({
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
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm">
        <Campos mesa={mesa} comanda={comanda} aoFechar={() => aoMudar(false)} />
      </DialogContent>
    </Dialog>
  )
}
