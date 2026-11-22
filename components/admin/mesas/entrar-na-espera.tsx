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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useEntrarNaEspera } from "@/lib/admin/dados/consultas-mesas"
import { conferirEspera } from "@/lib/admin/regras/reservas"
import { devolverFocoA } from "./devolver-foco"

function Campos({ aoFechar }: { aoFechar: () => void }) {
  const entrar = useEntrarNaEspera()
  const [nome, setNome] = useState("")
  const [pessoas, setPessoas] = useState("")
  const [telefone, setTelefone] = useState("")
  const [tentou, setTentou] = useState(false)
  const conferida = conferirEspera({ nome, pessoas, telefone })
  const erros = tentou ? conferida.erros : {}
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        const { entrada } = conferida
        if (!entrada) return
        entrar.mutate(entrada, {
          onSuccess: () => {
            toast.success(`${entrada.nome} entrou na espera.`)
            aoFechar()
          },
          onError: (erro) => toast.error(erro.message),
        })
      }}
    >
      <DialogHeader>
        <DialogTitle>Entrar na espera</DialogTitle>
        <DialogDescription>
          Com telefone, dá para chamar pelo WhatsApp quando a mesa liberar.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field data-invalid={Boolean(erros.nome)}>
            <FieldLabel htmlFor="espera-nome">Nome</FieldLabel>
            <Input
              id="espera-nome"
              maxLength={80}
              autoComplete="off"
              value={nome}
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={erros.nome ? "espera-nome-erro" : undefined}
              onChange={(evento) => setNome(evento.target.value)}
            />
            {erros.nome && <FieldError id="espera-nome-erro">{erros.nome}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(erros.pessoas)}>
            <FieldLabel htmlFor="espera-pessoas">Pessoas</FieldLabel>
            <Input
              id="espera-pessoas"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={pessoas}
              aria-invalid={Boolean(erros.pessoas)}
              aria-describedby={erros.pessoas ? "espera-pessoas-erro" : undefined}
              onChange={(evento) => setPessoas(evento.target.value)}
            />
            {erros.pessoas && <FieldError id="espera-pessoas-erro">{erros.pessoas}</FieldError>}
          </Field>
        </div>
        <Field data-invalid={Boolean(erros.telefone)}>
          <FieldLabel htmlFor="espera-telefone">Telefone (opcional)</FieldLabel>
          <Input
            id="espera-telefone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(12) 99123-4567"
            value={telefone}
            aria-invalid={Boolean(erros.telefone)}
            aria-describedby={erros.telefone ? "espera-telefone-erro" : undefined}
            onChange={(evento) => setTelefone(evento.target.value)}
          />
          {erros.telefone && <FieldError id="espera-telefone-erro">{erros.telefone}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={entrar.isPending}>
          Pôr na fila
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Entrar na lista de espera (Q24): nome, pessoas e o telefone, se quiser. */
export function EntrarNaEspera({
  aberto,
  aoMudar,
  focoAoFechar,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Para onde o foco volta quando a janela fecha (o botão que a abriu). */
  focoAoFechar?: HTMLElement | null
}) {
  return (
    <Dialog open={aberto} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        {aberto && <Campos aoFechar={() => aoMudar(false)} />}
      </DialogContent>
    </Dialog>
  )
}
