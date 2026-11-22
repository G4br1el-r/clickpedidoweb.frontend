"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAbrirMesa, useConfigSalao } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { conferirAbertura, garcomDoAparelho } from "@/lib/admin/regras/abrir-mesa"

/**
 * Abre a mesa livre (Q6): pessoas (obrigatório, de 1 a 99), garçom da lista e o cliente,
 * se quiser. Mais pessoas que lugares só avisa (Q17). O que falta aparece ao tentar abrir.
 */
export function AbrirMesa({ mesa }: { mesa: Mesa }) {
  const { data: salao } = useConfigSalao()
  const doAparelho = useGarcom((estado) => estado.nome)
  const abrir = useAbrirMesa()
  const garcons = salao?.garcons.filter((garcom) => garcom.ativo).map((item) => item.nome) ?? []
  const [pessoas, setPessoas] = useState("")
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  const [tentou, setTentou] = useState(false)
  // Sem escolha, vale o garçom deste aparelho quando ele está na lista.
  const garcom = escolhido ?? garcomDoAparelho(garcons, doAparelho)
  const conferida = conferirAbertura({ mesa, pessoas, garcom, garcons })
  const erros = tentou ? conferida.erros : {}

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        if (conferida.pessoas === undefined || Object.keys(conferida.erros).length > 0) return
        abrir.mutate(
          {
            mesaId: mesa.id,
            pessoas: conferida.pessoas,
            ...(garcom ? { garcom } : {}),
            ...(cliente.trim() ? { clienteNome: cliente } : {}),
            ...(doAparelho.trim() ? { por: doAparelho } : {}),
          },
          {
            onSuccess: () => toast.success(`Mesa ${mesa.numero} aberta.`),
            onError: (erro) => toast.error(erro.message),
          },
        )
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={Boolean(erros.pessoas)}>
            <FieldLabel htmlFor="abrir-pessoas">Pessoas</FieldLabel>
            <Input
              id="abrir-pessoas"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={pessoas}
              aria-invalid={Boolean(erros.pessoas)}
              aria-describedby={
                [
                  erros.pessoas ? "abrir-pessoas-erro" : null,
                  conferida.aviso ? "abrir-pessoas-aviso" : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              onChange={(evento) => setPessoas(evento.target.value)}
            />
            {erros.pessoas && <FieldError id="abrir-pessoas-erro">{erros.pessoas}</FieldError>}
          </Field>
          {/* Sem garçom cadastrado no salão, a mesa abre sem garçom. */}
          {garcons.length > 0 && (
            <Field data-invalid={Boolean(erros.garcom)}>
              <FieldLabel htmlFor="abrir-garcom">Garçom</FieldLabel>
              <Select value={garcom ?? ""} onValueChange={setEscolhido}>
                <SelectTrigger
                  id="abrir-garcom"
                  aria-label="Garçom"
                  aria-invalid={Boolean(erros.garcom)}
                  aria-describedby={erros.garcom ? "abrir-garcom-erro" : undefined}
                  className="w-full"
                >
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {garcons.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.garcom && <FieldError id="abrir-garcom-erro">{erros.garcom}</FieldError>}
            </Field>
          )}
        </div>
        {conferida.aviso && (
          <FieldDescription id="abrir-pessoas-aviso" className="-mt-2">
            {conferida.aviso}
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="abrir-cliente">Cliente (opcional)</FieldLabel>
          <Input
            id="abrir-cliente"
            maxLength={80}
            value={cliente}
            onChange={(evento) => setCliente(evento.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={abrir.isPending}>
        Abrir mesa
      </Button>
    </form>
  )
}
