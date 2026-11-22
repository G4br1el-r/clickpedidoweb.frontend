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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMesas, useTransferirItens } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao, itensEmTexto } from "@/lib/admin/regras/historico"
import { porQueNaoTransfere } from "@/lib/admin/regras/movimentacoes"
import { useAvisoComDesfazer } from "./aviso-desfazer"
import { AvisoReserva, nomeNaLista, useReservaDaVez } from "./aviso-reserva"

/** O motivo curto, ao lado do item que não pode sair agora. */
const travado = (motivo: string) => (motivo.startsWith("A cozinha") ? "Na cozinha" : "Pago")

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
  const transferir = useTransferirItens()
  const avisar = useAvisoComDesfazer()
  const por = useGarcom((estado) => estado.nome)
  const [quantas, setQuantas] = useState<Record<string, number>>({})
  const [destino, setDestino] = useState("")
  const [tentou, setTentou] = useState(false)
  const reservaDa = useReservaDaVez()
  // A própria mesa e as juntas a ela não recebem; a bloqueada também não.
  const doGrupo = [mesa.id, ...(comanda.mesa?.juntadas ?? []).map((junta) => junta.id)]
  const destinos = (mesas ?? []).filter((outra) => !doGrupo.includes(outra.id) && !outra.bloqueio)
  const escolhidos = comanda.itens.flatMap((item) =>
    quantas[item.id] ? [{ item, quantidade: quantas[item.id] }] : [],
  )
  const reserva = reservaDa(mesas?.find((outra) => outra.id === destino))
  const erros = {
    itens: tentou && escolhidos.length === 0 ? "Escolha os itens." : null,
    mesa: tentou && !destino ? "Escolha a mesa." : null,
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        if (escolhidos.length === 0 || !destino) return
        const numero = mesas?.find((outra) => outra.id === destino)?.numero
        const texto = itensEmTexto(
          escolhidos.map(({ item, quantidade }) => ({ nome: item.nome, quantidade })),
        )
        const unidades = escolhidos.reduce((soma, { quantidade }) => soma + quantidade, 0)
        transferir.mutate(
          {
            pedidoId: comanda.id,
            mesaDestinoId: destino,
            itens: escolhidos.map(({ item, quantidade }) => ({ itemId: item.id, quantidade })),
            ...(reserva ? { confirmarReserva: true } : {}),
            ...autorDaAcao(por, comanda.mesa?.garcom),
          },
          {
            onSuccess: ({ desfazer }) => {
              avisar(`${texto} ${unidades > 1 ? "foram" : "foi"} para a mesa ${numero}.`, desfazer)
              aoFechar()
            },
            onError: (falha) => toast.error(falha.message),
          },
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Transferir itens da mesa {mesa.numero}</DialogTitle>
        <DialogDescription>
          Diga quantos de cada item vão. A mesa livre abre com eles; a aberta recebe na conta dela.
        </DialogDescription>
      </DialogHeader>
      <fieldset aria-describedby={erros.itens ? "transferir-itens-erro" : undefined}>
        <legend className="sr-only">Itens</legend>
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {comanda.itens.map((item) => {
            const motivo = porQueNaoTransfere(comanda, item)
            // A mesma coisa em mais de uma linha (rodadas diferentes): a rodada separa as duas.
            const repetido = comanda.itens.some(
              (outro) => outro.id !== item.id && outro.nome === item.nome,
            )
            const rotulo = `${item.quantidade}× ${item.nome}${repetido ? ` · rodada ${item.rodada ?? 1}` : ""}`
            const idMotivo = `transferir-${item.id}-motivo`
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`transferir-${item.id}`} className="min-w-0 flex-1 truncate">
                  {rotulo}
                </label>
                {motivo && (
                  <span id={idMotivo} className="text-xs text-muted-foreground">
                    {travado(motivo)}
                  </span>
                )}
                <Input
                  id={`transferir-${item.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={item.quantidade}
                  className="w-20"
                  disabled={motivo !== null}
                  aria-describedby={motivo ? idMotivo : undefined}
                  value={quantas[item.id] ?? ""}
                  placeholder="0"
                  onChange={(evento) => {
                    const valor = Math.trunc(Number(evento.target.value))
                    setQuantas((atuais) => ({
                      ...atuais,
                      [item.id]: Number.isFinite(valor)
                        ? Math.min(Math.max(valor, 0), item.quantidade)
                        : 0,
                    }))
                  }}
                />
              </li>
            )
          })}
        </ul>
        {erros.itens && (
          <FieldError id="transferir-itens-erro" className="mt-2">
            {erros.itens}
          </FieldError>
        )}
      </fieldset>
      <Field data-invalid={Boolean(erros.mesa)}>
        <FieldLabel htmlFor="transferir-itens-destino">Para a mesa</FieldLabel>
        <Select value={destino} onValueChange={setDestino}>
          <SelectTrigger
            id="transferir-itens-destino"
            aria-label="Para a mesa"
            aria-invalid={Boolean(erros.mesa)}
            aria-describedby={erros.mesa ? "transferir-itens-destino-erro" : undefined}
            className="w-full"
          >
            <SelectValue placeholder="Escolha a mesa" />
          </SelectTrigger>
          <SelectContent>
            {destinos.map((outra) => (
              <SelectItem key={outra.id} value={outra.id}>
                {nomeNaLista(outra, reservaDa(outra))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erros.mesa && <FieldError id="transferir-itens-destino-erro">{erros.mesa}</FieldError>}
      </Field>
      {reserva && <AvisoReserva reserva={reserva} />}
      <DialogFooter>
        <Button type="submit" disabled={transferir.isPending}>
          {reserva ? "Transferir mesmo assim" : "Transferir"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Transferir itens (Q7), com quantidade parcial: a linha se divide. Com "Desfazer". */
export function TransferirItens({
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
      <DialogContent className="sm:max-w-md">
        {aberta && <Campos mesa={mesa} comanda={comanda} aoFechar={() => aoMudar(false)} />}
      </DialogContent>
    </Dialog>
  )
}
