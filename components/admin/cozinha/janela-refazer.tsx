"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useRefazer } from "@/lib/admin/dados/consultas"
import type { MotivoRefazer } from "@/lib/admin/dados/tipos"
import type { TicketCozinha } from "@/lib/admin/regras/cozinha"
import { NOME_DO_MOTIVO } from "@/lib/admin/regras/refazer"
import { nomeDoTicket } from "./ticket-cozinha"

const MOTIVOS = Object.keys(NOME_DO_MOTIVO) as MotivoRefazer[]

/**
 * Refazer parte de um ticket pronto: os itens (de fábrica, todos, na quantidade pedida) e
 * o motivo. O refazer entra em A fazer; a conta do pedido não muda.
 */
export function JanelaRefazer({
  ticket,
  aoFechar,
}: {
  ticket: TicketCozinha
  aoFechar: () => void
}) {
  const refazer = useRefazer()
  const [quantidades, setQuantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(ticket.itens.map((item) => [item.id, item.quantidade])),
  )
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(ticket.itens.map((item) => item.id)),
  )
  const [motivo, setMotivo] = useState<MotivoRefazer | null>(null)
  const [texto, setTexto] = useState("")
  const [erro, setErro] = useState<string>()
  const idTexto = useId()
  const nome = nomeDoTicket(ticket)

  const enviar = () => {
    if (!motivo) {
      setErro("Escolha o motivo.")
      return
    }
    refazer.mutate(
      {
        id: ticket.pedido.id,
        entrada: {
          rodada: ticket.rodada,
          motivo,
          ...(motivo === "outro" && texto.trim() ? { texto } : {}),
          itens: ticket.itens.map((item) => ({
            itemId: item.id,
            quantidade: marcados.has(item.id) ? (quantidades[item.id] ?? 0) : 0,
          })),
        },
      },
      {
        onSuccess: () => {
          toast(`${nome}: refazer na cozinha.`)
          aoFechar()
        },
        onError: (falha) => setErro(falha.message),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refazer {nome}</DialogTitle>
          <DialogDescription>
            O refazer entra em A fazer, no topo. A conta do pedido não muda.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            enviar()
          }}
        >
          <FieldSet>
            <FieldLegend variant="label">Itens</FieldLegend>
            <ul className="flex flex-col gap-2">
              {ticket.itens.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <Label className="flex min-w-0 flex-1 items-center gap-2 font-normal">
                    <Checkbox
                      checked={marcados.has(item.id)}
                      aria-label={`${item.quantidade}× ${item.nome}`}
                      onCheckedChange={(ligado) =>
                        setMarcados((atuais) => {
                          const novos = new Set(atuais)
                          if (ligado) novos.add(item.id)
                          else novos.delete(item.id)
                          return novos
                        })
                      }
                    />
                    <span className="truncate">
                      {item.quantidade}× {item.nome}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={item.quantidade}
                    aria-label={`Quantidade de ${item.nome}`}
                    className="w-20"
                    disabled={!marcados.has(item.id)}
                    value={quantidades[item.id] ?? ""}
                    onChange={(evento) =>
                      setQuantidades((atuais) => ({
                        ...atuais,
                        [item.id]: Number(evento.target.value),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Motivo</FieldLegend>
            <RadioGroup
              aria-label="Motivo"
              value={motivo ?? ""}
              onValueChange={(valor) => {
                setMotivo(valor as MotivoRefazer)
                setErro(undefined)
              }}
              className="grid grid-cols-2 gap-2"
            >
              {MOTIVOS.map((opcao) => (
                <Label key={opcao} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={opcao} aria-label={NOME_DO_MOTIVO[opcao]} />
                  {NOME_DO_MOTIVO[opcao]}
                </Label>
              ))}
            </RadioGroup>
            {motivo === "outro" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={idTexto}>O que aconteceu (opcional)</Label>
                <Input
                  id={idTexto}
                  maxLength={60}
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                />
              </div>
            )}
          </FieldSet>

          {erro && <FieldError>{erro}</FieldError>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={refazer.isPending}>
              Refazer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
