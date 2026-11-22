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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useConfigSalao,
  useMesas,
  useSentarDaEspera,
  useSentarReserva,
} from "@/lib/admin/dados/consultas-mesas"
import type { EntradaEspera, Reserva } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { conferirAbertura, garcomDoAparelho } from "@/lib/admin/regras/abrir-mesa"
import { porQueNaoSenta } from "@/lib/admin/regras/reservas"
import { plural } from "@/lib/formato"
import { AvisoReserva, rotuloDaReserva, useReservaDaVez } from "./aviso-reserva"
import { devolverFocoA } from "./devolver-foco"

/** Quem vai sentar: a reserva que chegou ou alguém da espera, com a mesa que já vem escolhida. */
export type QuemSenta =
  | { tipo: "reserva"; reserva: Reserva; mesaId?: string }
  | { tipo: "espera"; entrada: EntradaEspera; mesaId?: string }

function Campos({ quem, aoFechar }: { quem: QuemSenta; aoFechar: () => void }) {
  const { data: mesas } = useMesas()
  const { data: salao } = useConfigSalao()
  const doAparelho = useGarcom((estado) => estado.nome)
  const reservaDa = useReservaDaVez()
  const sentarReserva = useSentarReserva()
  const sentarEspera = useSentarDaEspera()
  const garcons = salao?.garcons.filter((garcom) => garcom.ativo).map((item) => item.nome) ?? []
  const [mesaId, setMesaId] = useState(quem.mesaId ?? "")
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [tentou, setTentou] = useState(false)
  const garcom = escolhido ?? garcomDoAparelho(garcons, doAparelho)
  const { nome, pessoas } = quem.tipo === "reserva" ? quem.reserva : quem.entrada
  const propria = quem.tipo === "reserva" ? quem.reserva.id : undefined
  // A lista traz só as mesas que recebem agora: livres (mesmo em limpeza), sem bloqueio e soltas.
  const abertas = (mesas ?? []).filter((item) => !porQueNaoSenta(item.id, mesas ?? []))
  const mesa = abertas.find((item) => item.id === mesaId)
  // A mesa da reserva que não pode abrir (ocupada, juntada, bloqueada, excluída) diz o porquê.
  const semAMesaDela =
    mesas && quem.tipo === "reserva" && quem.reserva.mesaId
      ? porQueNaoSenta(quem.reserva.mesaId, mesas)
      : undefined
  // Outra reserva da vez na mesa escolhida pede confirmação; a própria, não (como o servidor).
  const outra = reservaDa(mesa, propria)
  const lugares = mesa
    ? conferirAbertura({ mesa, pessoas: String(pessoas), garcom, garcons }).aviso
    : undefined
  const erros = {
    mesa: tentou && !mesa ? "Escolha a mesa." : null,
    garcom: tentou && garcons.length > 0 && !garcom ? "Escolha o garçom." : null,
  }
  const pendente = sentarReserva.isPending || sentarEspera.isPending
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        if (!mesa || (garcons.length > 0 && !garcom)) return
        const sentada = {
          mesaId: mesa.id,
          ...(garcom ? { garcom } : {}),
          ...(outra ? { confirmarReserva: true } : {}),
          ...(doAparelho.trim() ? { por: doAparelho } : {}),
        }
        const aoSentar = {
          onSuccess: () => {
            toast.success(`${nome} na mesa ${mesa.numero}.`)
            aoFechar()
          },
          onError: (erro: Error) => toast.error(erro.message),
        }
        if (quem.tipo === "reserva") {
          sentarReserva.mutate({ id: quem.reserva.id, ...sentada }, aoSentar)
        } else sentarEspera.mutate({ id: quem.entrada.id, ...sentada }, aoSentar)
      }}
    >
      <DialogHeader>
        <DialogTitle>Sentar {nome}</DialogTitle>
        <DialogDescription>
          A mesa abre para {plural(pessoas, "pessoa", "pessoas")}, no nome de {nome}.
        </DialogDescription>
      </DialogHeader>
      {semAMesaDela && (
        <p className="rounded-lg bg-(--tom-espera)/10 px-3 py-2 text-sm">{semAMesaDela}</p>
      )}
      {/* Um campo por linha: "Mesa 13 · 2 lugares · reservada 20:50" não cabe em meia janela. */}
      <div className="grid gap-3">
        <Field data-invalid={Boolean(erros.mesa)}>
          <FieldLabel htmlFor="sentar-mesa">Mesa</FieldLabel>
          <Select value={mesa ? mesaId : ""} onValueChange={setMesaId}>
            <SelectTrigger
              id="sentar-mesa"
              aria-label="Mesa"
              aria-invalid={Boolean(erros.mesa)}
              aria-describedby={
                [erros.mesa ? "sentar-mesa-erro" : null, lugares ? "sentar-mesa-aviso" : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className="w-full"
            >
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {abertas.map((item) => {
                const reserva = reservaDa(item, propria)
                return (
                  <SelectItem key={item.id} value={item.id}>
                    Mesa {item.numero} · {plural(item.lugares, "lugar", "lugares")}
                    {reserva && ` · ${rotuloDaReserva(reserva)}`}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {erros.mesa && <FieldError id="sentar-mesa-erro">{erros.mesa}</FieldError>}
        </Field>
        {garcons.length > 0 && (
          <Field data-invalid={Boolean(erros.garcom)}>
            <FieldLabel htmlFor="sentar-garcom">Garçom</FieldLabel>
            <Select value={garcom ?? ""} onValueChange={setEscolhido}>
              <SelectTrigger
                id="sentar-garcom"
                aria-label="Garçom"
                aria-invalid={Boolean(erros.garcom)}
                aria-describedby={erros.garcom ? "sentar-garcom-erro" : undefined}
                className="w-full"
              >
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {garcons.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.garcom && <FieldError id="sentar-garcom-erro">{erros.garcom}</FieldError>}
          </Field>
        )}
      </div>
      {/* Mais pessoas que lugares só avisa (Q17), como em Abrir mesa. */}
      {lugares && (
        <FieldDescription id="sentar-mesa-aviso" className="-mt-2">
          {lugares}
        </FieldDescription>
      )}
      {outra && <AvisoReserva reserva={outra} />}
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {outra ? "Sentar mesmo assim" : "Sentar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Sentar quem reservou ou esperava (Q11, Q24): abre a mesa com o nome e as pessoas. */
export function Sentar({
  quem,
  aoMudar,
  focoAoFechar,
}: {
  quem: QuemSenta | null
  aoMudar: (aberto: boolean) => void
  /** Para onde o foco volta quando a janela fecha (o botão que a abriu). */
  focoAoFechar?: HTMLElement | null
}) {
  return (
    <Dialog open={quem !== null} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        {quem && <Campos quem={quem} aoFechar={() => aoMudar(false)} />}
      </DialogContent>
    </Dialog>
  )
}
