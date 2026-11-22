"use client"

import { type ReactNode, useRef, useState } from "react"
import { NumericFormat } from "react-number-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { DescontoConta } from "@/lib/admin/dados/tipos"

/**
 * Janela que pede o motivo de uma mudança na conta (cortesia, tirar taxa ou couvert, estorno).
 * Fecha só quando o servidor aceita: se ele recusar, o que foi digitado continua ali.
 */
export function MotivoConta({
  aberta,
  titulo,
  descricao,
  acao,
  pronto = true,
  aoMudar,
  aoConfirmar,
  children,
}: {
  aberta: boolean
  titulo: string
  descricao: string
  /** O texto do botão que confirma. */
  acao: string
  /** Os outros campos estão preenchidos. */
  pronto?: boolean
  aoMudar: (aberta: boolean) => void
  /** Rejeita se o servidor recusar (o aviso de erro fica com quem chama). */
  aoConfirmar: (motivo: string) => Promise<unknown>
  /** Campos antes do motivo (o valor do desconto). */
  children?: ReactNode
}) {
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLTextAreaElement>(null)
  return (
    <AlertDialog
      open={aberta}
      onOpenChange={(aberto) => {
        if (!aberto) setMotivo("")
        aoMudar(aberto)
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(evento) => {
          // Sem outros campos, quem abriu veio dizer o motivo: o foco vai direto para ele.
          if (children) return
          evento.preventDefault()
          campo.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <Field>
          <FieldLabel htmlFor="conta-motivo">Motivo</FieldLabel>
          <Textarea
            ref={campo}
            id="conta-motivo"
            rows={2}
            maxLength={140}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!motivo.trim() || !pronto || enviando}
            onClick={(evento) => {
              evento.preventDefault()
              setEnviando(true)
              aoConfirmar(motivo.trim())
                .then(() => setMotivo(""))
                .catch(() => {})
                .finally(() => setEnviando(false))
            }}
          >
            {acao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Desconto da conta: em reais ou em %, com o motivo. */
export function DescontoNaConta({
  aberta,
  numero,
  aoMudar,
  aoAplicar,
}: {
  aberta: boolean
  numero: number
  aoMudar: (aberta: boolean) => void
  aoAplicar: (desconto: DescontoConta) => Promise<unknown>
}) {
  const [modo, setModo] = useState<DescontoConta["modo"]>("reais")
  const [valor, setValor] = useState<number | undefined>()
  return (
    <MotivoConta
      aberta={aberta}
      titulo={`Desconto na conta da mesa ${numero}`}
      descricao="O desconto vale sobre os itens e nunca passa do valor deles. A taxa é refeita."
      acao="Aplicar desconto"
      pronto={valor !== undefined && valor > 0}
      aoMudar={(aberto) => {
        if (!aberto) setValor(undefined)
        aoMudar(aberto)
      }}
      aoConfirmar={(motivo) => aoAplicar({ modo, valor: valor ?? 0, motivo })}
    >
      <RadioGroup
        aria-label="Desconto em"
        value={modo}
        onValueChange={(escolhido) => setModo(escolhido as DescontoConta["modo"])}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="reais" id="desconto-reais" />
          <Label htmlFor="desconto-reais">Em reais</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="percentual" id="desconto-percentual" />
          <Label htmlFor="desconto-percentual">Em %</Label>
        </div>
      </RadioGroup>
      <Field>
        <FieldLabel htmlFor="desconto-valor">Valor do desconto</FieldLabel>
        <NumericFormat
          id="desconto-valor"
          customInput={Input}
          inputMode="decimal"
          {...(modo === "reais" ? { prefix: "R$ " } : { suffix: " %" })}
          decimalSeparator=","
          thousandSeparator="."
          decimalScale={2}
          value={valor ?? ""}
          onValueChange={({ floatValue }) => setValor(floatValue)}
        />
      </Field>
    </MotivoConta>
  )
}
