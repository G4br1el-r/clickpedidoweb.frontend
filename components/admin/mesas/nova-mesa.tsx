"use client"

import { PlusIcon } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useCriarMesa } from "@/lib/admin/dados/consultas-mesas"

/** Botão e janela de mesa nova: número único e, se quiser, um nome. */
export function NovaMesa() {
  const [aberta, setAberta] = useState(false)
  const [numero, setNumero] = useState("")
  const [nome, setNome] = useState("")
  const criar = useCriarMesa()

  return (
    <Dialog
      open={aberta}
      onOpenChange={(valor) => {
        setAberta(valor)
        if (!valor) {
          setNumero("")
          setNome("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <PlusIcon data-icon="inline-start" />
          Nova mesa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            criar.mutate(
              { numero: Number(numero), ...(nome.trim() ? { nome } : {}) },
              {
                onSuccess: () => {
                  toast.success(`Mesa ${numero} criada.`)
                  setAberta(false)
                  setNumero("")
                  setNome("")
                },
                onError: (erro) => toast.error(erro.message),
              },
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>Nova mesa</DialogTitle>
            <DialogDescription>O número aparece na comanda e na cozinha.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="mesa-numero">Número</FieldLabel>
              <Input
                id="mesa-numero"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                required
                value={numero}
                onChange={(evento) => setNumero(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mesa-nome">Nome (opcional)</FieldLabel>
              <Input
                id="mesa-nome"
                maxLength={40}
                placeholder="Varanda, Balcão…"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={criar.isPending}>
              Criar mesa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
