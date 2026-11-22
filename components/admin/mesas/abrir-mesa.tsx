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
import { useAbrirMesa, useConfigSalao, useSentarReserva } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { conferirAbertura, garcomDoAparelho } from "@/lib/admin/regras/abrir-mesa"
import { AvisoReserva, useReservaDaVez } from "./aviso-reserva"

/**
 * Abre a mesa livre (Q6): pessoas (obrigatório, de 1 a 99), garçom da lista e o cliente,
 * se quiser. Mais pessoas que lugares só avisa (Q17). O que falta aparece ao tentar abrir.
 * Na mesa reservada agora, avisa a reserva: "Abrir mesmo assim" confirma, e "Sentar" senta quem
 * reservou, com o nome e as pessoas da reserva.
 */
export function AbrirMesa({ mesa }: { mesa: Mesa }) {
  const { data: salao } = useConfigSalao()
  const doAparelho = useGarcom((estado) => estado.nome)
  const abrir = useAbrirMesa()
  const sentar = useSentarReserva()
  const reservaDa = useReservaDaVez()
  const reserva = reservaDa(mesa)
  // Com duas na janela, sentar a primeira pede a confirmação da outra, como no servidor.
  const outra = reserva ? reservaDa(mesa, reserva.id) : undefined
  const garcons = salao?.garcons.filter((garcom) => garcom.ativo).map((item) => item.nome) ?? []
  const [pessoas, setPessoas] = useState("")
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  const [tentou, setTentou] = useState(false)
  // Sentar a reserva só pede o garçom: as pessoas vêm da reserva.
  const [tentouSentar, setTentouSentar] = useState(false)
  // Sem escolha, vale o garçom deste aparelho quando ele está na lista.
  const garcom = escolhido ?? garcomDoAparelho(garcons, doAparelho)
  const conferida = conferirAbertura({ mesa, pessoas, garcom, garcons })
  const erros = tentou
    ? conferida.erros
    : tentouSentar && conferida.erros.garcom
      ? { garcom: conferida.erros.garcom }
      : {}
  const por = doAparelho.trim() ? { por: doAparelho } : {}

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
            ...(reserva ? { confirmarReserva: true } : {}),
            ...por,
          },
          {
            onSuccess: () => toast.success(`Mesa ${mesa.numero} aberta.`),
            onError: (erro) => toast.error(erro.message),
          },
        )
      }}
    >
      {reserva && <AvisoReserva reserva={reserva} />}
      {outra && <AvisoReserva reserva={outra} />}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={abrir.isPending}>
          {reserva ? "Abrir mesmo assim" : "Abrir mesa"}
        </Button>
        {reserva && (
          <Button
            type="button"
            variant="outline"
            disabled={sentar.isPending}
            onClick={() => {
              setTentouSentar(true)
              if (conferida.erros.garcom) return
              sentar.mutate(
                {
                  id: reserva.id,
                  mesaId: mesa.id,
                  ...(garcom ? { garcom } : {}),
                  ...(outra ? { confirmarReserva: true } : {}),
                  ...por,
                },
                {
                  onSuccess: () => toast.success(`${reserva.nome} na mesa ${mesa.numero}.`),
                  onError: (erro) => toast.error(erro.message),
                },
              )
            }}
          >
            Sentar {reserva.nome}
          </Button>
        )}
      </div>
    </form>
  )
}
