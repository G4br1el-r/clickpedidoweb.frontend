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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useConfigSalao, useCriarMesa, useEditarMesa } from "@/lib/admin/dados/consultas-mesas"
import { FORMAS_MESA, type FormaMesa, type Mesa } from "@/lib/admin/dados/tipos"
import { nomePadraoDaMesa } from "@/lib/admin/regras/mesas"

const ROTULO_FORMA: Record<FormaMesa, string> = {
  quadrada: "Quadrada",
  redonda: "Redonda",
  retangular: "Retangular",
}

function Campos({ mesa, aoFechar }: { mesa?: Mesa; aoFechar: () => void }) {
  const { data: salao } = useConfigSalao()
  const criar = useCriarMesa()
  const editar = useEditarMesa()
  const salvando = criar.isPending || editar.isPending
  const areas = (salao?.areas ?? []).toSorted((a, b) => a.ordem - b.ordem)
  const [numero, setNumero] = useState(mesa ? String(mesa.numero) : "")
  const [nome, setNome] = useState(
    mesa && mesa.nome !== nomePadraoDaMesa(mesa.numero) ? mesa.nome : "",
  )
  const [area, setArea] = useState<string | null>(mesa?.areaId ?? null)
  const [lugares, setLugares] = useState(String(mesa?.lugares ?? 4))
  const [forma, setForma] = useState<FormaMesa>(mesa?.forma ?? "quadrada")
  // Sem área ainda (o salão não carregou), o servidor põe a mesa na primeira.
  const areaId = area ?? areas[0]?.id

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        const dados = {
          numero: Number(numero),
          ...(nome.trim() ? { nome } : {}),
          ...(areaId ? { areaId } : {}),
          lugares: Number(lugares),
          forma,
        }
        const opcoes = {
          onSuccess: () => {
            toast.success(`Mesa ${numero} ${mesa ? "salva" : "criada"}.`)
            aoFechar()
          },
          onError: (erro: Error) => toast.error(erro.message),
        }
        if (mesa)
          editar.mutate({ id: mesa.id, dados: { ...dados, areaId: areaId ?? mesa.areaId } }, opcoes)
        else criar.mutate(dados, opcoes)
      }}
    >
      <DialogHeader>
        <DialogTitle>{mesa ? `Editar mesa ${mesa.numero}` : "Nova mesa"}</DialogTitle>
        <DialogDescription>
          {mesa
            ? "Mudar a área ou o tamanho pode levar a mesa para outra posição do mapa."
            : "O número aparece na comanda e na cozinha."}
        </DialogDescription>
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
        <Field>
          <FieldLabel htmlFor="mesa-area">Área</FieldLabel>
          <Select value={areaId ?? ""} onValueChange={setArea}>
            <SelectTrigger id="mesa-area" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {areas.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="mesa-lugares">Lugares</FieldLabel>
            <Input
              id="mesa-lugares"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              value={lugares}
              onChange={(evento) => setLugares(evento.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mesa-forma">Forma</FieldLabel>
            <Select value={forma} onValueChange={(valor) => setForma(valor as FormaMesa)}>
              <SelectTrigger id="mesa-forma" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_MESA.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROTULO_FORMA[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={salvando}>
          {mesa ? "Salvar" : "Criar mesa"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A janela da mesa, usada para criar e, com `mesa`, para editar. */
export function FormularioMesa({
  mesa,
  aberta,
  aoMudar,
}: {
  mesa?: Mesa
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm">
        <Campos mesa={mesa} aoFechar={() => aoMudar(false)} />
      </DialogContent>
    </Dialog>
  )
}
