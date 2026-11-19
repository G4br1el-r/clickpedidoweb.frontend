"use client"

import { type ReactNode, useId, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { MotivoCancelamento, MotivoEscolhido } from "@/lib/admin/dados/tipos"
import { motivosDeCancelamento } from "@/lib/admin/regras/aceite"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"

/**
 * Recusar ou cancelar um pedido: a pessoa escolhe o motivo (e escreve, no "Outro") antes
 * de confirmar. Não tem desfazer, por isso a confirmação.
 */
export function ConfirmarComMotivo({
  gatilho,
  titulo,
  descricao,
  confirmar,
  aoConfirmar,
}: {
  gatilho: ReactNode
  titulo: string
  descricao: string
  confirmar: string
  aoConfirmar: (escolhido: MotivoEscolhido) => void
}) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(null)
  const [detalhe, setDetalhe] = useState("")
  const id = useId()
  const pronto = motivo !== null && (motivo !== "outro" || detalhe.trim() !== "")

  return (
    <AlertDialog
      onOpenChange={(aberto) => {
        if (!aberto) return
        setMotivo(null)
        setDetalhe("")
      }}
    >
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <FieldSet>
          <FieldLegend variant="label">Motivo</FieldLegend>
          <RadioGroup
            value={motivo ?? ""}
            onValueChange={(valor) => setMotivo(valor as MotivoCancelamento)}
          >
            {motivosDeCancelamento(segmento).map((opcao) => (
              <Field key={opcao.id} orientation="horizontal">
                <RadioGroupItem id={`${id}-${opcao.id}`} value={opcao.id} />
                <FieldLabel htmlFor={`${id}-${opcao.id}`} className="font-normal">
                  {opcao.rotulo}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          {motivo === "outro" && (
            <Field>
              <FieldLabel htmlFor={`${id}-detalhe`}>Qual o motivo?</FieldLabel>
              <Textarea
                id={`${id}-detalhe`}
                value={detalhe}
                onChange={(evento) => setDetalhe(evento.target.value)}
                rows={2}
                autoFocus
              />
            </Field>
          )}
        </FieldSet>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!pronto}
            onClick={() => {
              if (!motivo) return
              aoConfirmar(motivo === "outro" ? { motivo, detalhe } : { motivo })
            }}
          >
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
