"use client"

import { format } from "date-fns"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAgora } from "@/hooks/use-agora"
import {
  useConfigSalao,
  useCriarReserva,
  useEditarReserva,
  useMesas,
  useReservas,
} from "@/lib/admin/dados/consultas-mesas"
import type { Reserva } from "@/lib/admin/dados/tipos"
import { conferirReserva, type ErrosReserva, sugerirMesa } from "@/lib/admin/regras/reservas"
import { plural } from "@/lib/formato"
import { devolverFocoA } from "./devolver-foco"

const SEM_MESA = "sem-mesa"

/** Os campos, com a reserva que está sendo editada (ou nenhuma, na nova). */
function Campos({ reserva, aoFechar }: { reserva?: Reserva; aoFechar: () => void }) {
  const { data: mesas = [] } = useMesas()
  const { data: reservas = [] } = useReservas()
  const { data: salao } = useConfigSalao()
  const agora = useAgora(30_000)
  const criar = useCriarReserva()
  const editar = useEditarReserva()
  const [nome, setNome] = useState(reserva?.nome ?? "")
  const [telefone, setTelefone] = useState(reserva?.telefone ?? "")
  const [horario, setHorario] = useState(reserva ? format(new Date(reserva.inicio), "HH:mm") : "")
  const [pessoas, setPessoas] = useState(reserva ? String(reserva.pessoas) : "")
  const [mesaId, setMesaId] = useState(reserva?.mesaId ?? SEM_MESA)
  const [tentou, setTentou] = useState(false)

  // Editando, o horário que não mudou não é conferido de novo (a reserva pode estar atrasada).
  const mesmoHorario =
    reserva !== undefined && horario === format(new Date(reserva.inicio), "HH:mm")
  const referencia =
    agora && reserva && mesmoHorario
      ? new Date(Math.min(Date.parse(reserva.inicio), agora.getTime()))
      : agora
  const conferida = referencia
    ? conferirReserva({ nome, telefone, horario, pessoas }, referencia)
    : { erros: {} as ErrosReserva }
  const erros: ErrosReserva = tentou ? conferida.erros : {}
  // A sugestão sai com o horário e as pessoas já certos.
  const quantas = Number(pessoas)
  const horarioCerto = referencia && !conferida.erros.horario
  const inicio = horarioCerto
    ? new Date(`${format(referencia, "yyyy-MM-dd")}T${horario}:00`)
    : undefined
  const sugestao =
    agora && salao && inicio && Number.isInteger(quantas) && quantas >= 1
      ? sugerirMesa(quantas, mesas, reservas, {
          agora,
          config: salao.reservas,
          inicio,
          ...(reserva ? { ignorar: reserva.id } : {}),
        })
      : undefined
  const pendente = criar.isPending || editar.isPending

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        const dados = conferida.reserva
        if (!dados) return
        const comMesa = { ...dados, ...(mesaId !== SEM_MESA ? { mesaId } : {}) }
        const aoSalvar = {
          onSuccess: () => {
            toast.success(`Reserva de ${dados.nome} salva.`)
            aoFechar()
          },
          onError: (erro: Error) => toast.error(erro.message),
        }
        if (reserva) editar.mutate({ id: reserva.id, ...comMesa }, aoSalvar)
        else criar.mutate(comMesa, aoSalvar)
      }}
    >
      <DialogHeader>
        <DialogTitle>{reserva ? "Editar reserva" : "Nova reserva"}</DialogTitle>
        <DialogDescription>
          Reserva para hoje. A mesa fica guardada perto da hora.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={Boolean(erros.nome)}>
          <FieldLabel htmlFor="reserva-nome">Nome</FieldLabel>
          <Input
            id="reserva-nome"
            maxLength={80}
            autoComplete="off"
            value={nome}
            aria-invalid={Boolean(erros.nome)}
            aria-describedby={erros.nome ? "reserva-nome-erro" : undefined}
            onChange={(evento) => setNome(evento.target.value)}
          />
          {erros.nome && <FieldError id="reserva-nome-erro">{erros.nome}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(erros.telefone)}>
          <FieldLabel htmlFor="reserva-telefone">Telefone (opcional)</FieldLabel>
          <Input
            id="reserva-telefone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(12) 99123-4567"
            value={telefone}
            aria-invalid={Boolean(erros.telefone)}
            aria-describedby={erros.telefone ? "reserva-telefone-erro" : undefined}
            onChange={(evento) => setTelefone(evento.target.value)}
          />
          {erros.telefone && <FieldError id="reserva-telefone-erro">{erros.telefone}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={Boolean(erros.horario)}>
            <FieldLabel htmlFor="reserva-horario">Horário</FieldLabel>
            <Input
              id="reserva-horario"
              type="time"
              value={horario}
              aria-invalid={Boolean(erros.horario)}
              aria-describedby={erros.horario ? "reserva-horario-erro" : undefined}
              onChange={(evento) => setHorario(evento.target.value)}
            />
            {erros.horario && <FieldError id="reserva-horario-erro">{erros.horario}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(erros.pessoas)}>
            <FieldLabel htmlFor="reserva-pessoas">Pessoas</FieldLabel>
            <Input
              id="reserva-pessoas"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={pessoas}
              aria-invalid={Boolean(erros.pessoas)}
              aria-describedby={erros.pessoas ? "reserva-pessoas-erro" : undefined}
              onChange={(evento) => setPessoas(evento.target.value)}
            />
            {erros.pessoas && <FieldError id="reserva-pessoas-erro">{erros.pessoas}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="reserva-mesa">Mesa</FieldLabel>
          <Select value={mesaId} onValueChange={setMesaId}>
            <SelectTrigger
              id="reserva-mesa"
              aria-label="Mesa"
              aria-describedby={sugestao ? "reserva-sugestao" : undefined}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_MESA}>Sem mesa</SelectItem>
              {mesas
                .filter((mesa) => !mesa.bloqueio)
                .map((mesa) => (
                  <SelectItem key={mesa.id} value={mesa.id}>
                    Mesa {mesa.numero} · {plural(mesa.lugares, "lugar", "lugares")}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {sugestao && sugestao.id !== mesaId && (
            <div className="flex flex-wrap items-center gap-2">
              <FieldDescription id="reserva-sugestao">
                Sugestão: mesa {sugestao.numero}, {plural(sugestao.lugares, "lugar", "lugares")}.
              </FieldDescription>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMesaId(sugestao.id)}
              >
                Usar a mesa {sugestao.numero}
              </Button>
            </div>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          Salvar reserva
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Nova reserva ou editar a reserva marcada (Q11): nome, telefone, horário, pessoas e mesa. */
export function FormularioReserva({
  reserva,
  aberto,
  aoMudar,
  focoAoFechar,
}: {
  reserva?: Reserva
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Para onde o foco volta quando a janela fecha (o botão ou o ⋯ que a abriu). */
  focoAoFechar?: HTMLElement | null
}) {
  return (
    <Dialog open={aberto} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        {aberto && <Campos reserva={reserva} aoFechar={() => aoMudar(false)} />}
      </DialogContent>
    </Dialog>
  )
}
