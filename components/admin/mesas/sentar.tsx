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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
import type { EntradaEspera, Mesa, Reserva } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { garcomDoAparelho } from "@/lib/admin/regras/abrir-mesa"
import { plural } from "@/lib/formato"
import { AvisoReserva, nomeNaLista, useReservaDaVez } from "./aviso-reserva"

/** Quem vai sentar: a reserva que chegou ou alguém da espera, com a mesa que já vem escolhida. */
export type QuemSenta =
  | { tipo: "reserva"; reserva: Reserva; mesaId?: string }
  | { tipo: "espera"; entrada: EntradaEspera; mesaId?: string }

/** A mesa que pode abrir agora: sem comanda, sem bloqueio e sem estar junto de outra. */
const podeAbrir = (mesa: Mesa) => mesa.status === "livre" && !mesa.bloqueio && !mesa.juntadaCom

function Campos({ quem, aoFechar }: { quem: QuemSenta; aoFechar: () => void }) {
  const { data: mesas = [] } = useMesas()
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
  const mesa = mesas.find((item) => item.id === mesaId)
  // Outra reserva da vez na mesa escolhida pede confirmação; a própria, não.
  const daVez = reservaDa(mesa)
  const outra = quem.tipo === "reserva" && daVez?.id === quem.reserva.id ? undefined : daVez
  const erros = {
    mesa: tentou && !mesaId ? "Escolha a mesa." : null,
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
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={Boolean(erros.mesa)}>
          <FieldLabel htmlFor="sentar-mesa">Mesa</FieldLabel>
          <Select value={mesaId} onValueChange={setMesaId}>
            <SelectTrigger
              id="sentar-mesa"
              aria-label="Mesa"
              aria-invalid={Boolean(erros.mesa)}
              aria-describedby={erros.mesa ? "sentar-mesa-erro" : undefined}
              className="w-full"
            >
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {mesas.filter(podeAbrir).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {nomeNaLista(item, reservaDa(item))}
                </SelectItem>
              ))}
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
}: {
  quem: QuemSenta | null
  aoMudar: (aberto: boolean) => void
}) {
  return (
    <Dialog open={quem !== null} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md">
        {quem && <Campos quem={quem} aoFechar={() => aoMudar(false)} />}
      </DialogContent>
    </Dialog>
  )
}
