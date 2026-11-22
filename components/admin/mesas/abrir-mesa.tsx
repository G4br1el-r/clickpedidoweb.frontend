"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { normalizar } from "@/lib/admin/regras/filtro-pedidos"
import { plural } from "@/lib/formato"

/**
 * Abre a mesa livre (Q6): pessoas (obrigatório, de 1 a 99), garçom da lista e o cliente,
 * se quiser. Mais pessoas que lugares só avisa (Q17).
 */
export function AbrirMesa({ mesa }: { mesa: Mesa }) {
  const { data: salao } = useConfigSalao()
  const doAparelho = useGarcom((estado) => estado.nome)
  const abrir = useAbrirMesa()
  const garcons = salao?.garcons.filter((garcom) => garcom.ativo) ?? []
  const [pessoas, setPessoas] = useState("")
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  // Sem escolha, vale o garçom deste aparelho quando ele está na lista.
  const garcom =
    escolhido ??
    garcons.find((item) => normalizar(item.nome) === normalizar(doAparelho.trim()))?.nome ??
    null
  const quantas = Number(pessoas)
  const pessoasValidas =
    pessoas !== "" && Number.isInteger(quantas) && quantas >= 1 && quantas <= 99
  const faltaGarcom = garcons.length > 0 && !garcom
  const passaDosLugares = pessoasValidas && quantas > mesa.lugares

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!pessoasValidas || faltaGarcom) return
        abrir.mutate(
          {
            mesaId: mesa.id,
            pessoas: quantas,
            ...(garcom ? { garcom } : {}),
            ...(cliente.trim() ? { clienteNome: cliente } : {}),
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
          <Field>
            <FieldLabel htmlFor="abrir-pessoas">Pessoas</FieldLabel>
            <Input
              id="abrir-pessoas"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              required
              value={pessoas}
              aria-describedby={passaDosLugares ? "abrir-pessoas-aviso" : undefined}
              onChange={(evento) => setPessoas(evento.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="abrir-garcom">Garçom</FieldLabel>
            <Select value={garcom ?? ""} onValueChange={setEscolhido}>
              <SelectTrigger id="abrir-garcom" aria-label="Garçom" className="w-full">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {garcons.map((item) => (
                  <SelectItem key={item.id} value={item.nome}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {passaDosLugares && (
          <FieldDescription id="abrir-pessoas-aviso" className="-mt-2">
            A mesa {mesa.numero} tem {plural(mesa.lugares, "lugar", "lugares")}.
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="abrir-cliente">Cliente (opcional)</FieldLabel>
          <Input
            id="abrir-cliente"
            maxLength={60}
            value={cliente}
            onChange={(evento) => setCliente(evento.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button
        type="submit"
        className="self-start"
        disabled={!pessoasValidas || faltaGarcom || abrir.isPending}
      >
        Abrir mesa
      </Button>
    </form>
  )
}
