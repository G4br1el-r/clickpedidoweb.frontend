"use client"

import { useId, useState } from "react"
import { NumericFormat } from "react-number-format"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useMovimentarCaixa } from "@/lib/admin/dados/consultas-caixa"
import { usePerfilAtual } from "@/lib/admin/dados/consultas-equipe"
import type { Autorizacao } from "@/lib/admin/dados/tipos"
import { errosDoMovimentoCaixa } from "@/lib/admin/regras/caixa"
import { precisaAutorizacao } from "@/lib/admin/regras/equipe"
import { emReais } from "@/lib/formato"
import { JanelaAutorizacao } from "../../equipe/janela-autorizacao"

type Tipo = "sangria" | "suprimento"

const dinheiro = {
  customInput: Input,
  inputMode: "decimal" as const,
  prefix: "R$ ",
  decimalSeparator: ",",
  thousandSeparator: ".",
  decimalScale: 2,
  fixedDecimalScale: true,
}

/**
 * Sangria (retirada) ou suprimento (reforço) no turno. Confere antes de enviar; a
 * sangria de quem é Caixa pede o PIN de um gerente.
 */
export function JanelaMovimento({
  dinheiroNaGaveta,
  aoFechar,
}: {
  dinheiroNaGaveta: number
  aoFechar: () => void
}) {
  const id = useId()
  const perfil = usePerfilAtual()
  const movimentar = useMovimentarCaixa()
  const [tipo, setTipo] = useState<Tipo>("sangria")
  const [valor, setValor] = useState(0)
  const [motivo, setMotivo] = useState("")
  const [erro, setErro] = useState<string>()
  const [autorizando, setAutorizando] = useState(false)

  const enviar = (autorizacao?: Autorizacao) =>
    movimentar.mutateAsync({ tipo, valor, motivo, ...(autorizacao ? { autorizacao } : {}) })

  const concluir = () => {
    toast.success(tipo === "sangria" ? "Sangria registrada." : "Suprimento registrado.")
    aoFechar()
  }

  function registrar() {
    const problema = errosDoMovimentoCaixa({ tipo, valor, motivo }, dinheiroNaGaveta)
    setErro(problema)
    if (problema) return
    if (tipo === "sangria" && perfil && precisaAutorizacao(perfil, "sangria")) {
      setAutorizando(true)
      return
    }
    enviar().then(concluir, (falha: Error) => setErro(falha.message))
  }

  if (autorizando) {
    return (
      <JanelaAutorizacao
        aberta
        acao="sangria"
        aoFechar={() => setAutorizando(false)}
        aoAutorizar={async (autorizacao) => {
          await enviar(autorizacao)
          concluir()
        }}
      />
    )
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            registrar()
          }}
        >
          <DialogHeader>
            <DialogTitle>Sangria ou suprimento</DialogTitle>
            <DialogDescription className="tabular-nums">
              Na gaveta agora: {emReais(dinheiroNaGaveta)}.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <ToggleGroup
              type="single"
              variant="segmento"
              aria-label="Tipo"
              value={tipo}
              onValueChange={(novo) => novo && setTipo(novo as Tipo)}
            >
              <ToggleGroupItem value="sangria">Sangria</ToggleGroupItem>
              <ToggleGroupItem value="suprimento">Suprimento</ToggleGroupItem>
            </ToggleGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-valor`}>Valor</FieldLabel>
              <NumericFormat
                {...dinheiro}
                id={`${id}-valor`}
                className="tabular-nums"
                value={valor}
                onValueChange={({ floatValue }) => setValor(floatValue ?? 0)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-motivo`}>Motivo</FieldLabel>
              <Input
                id={`${id}-motivo`}
                maxLength={140}
                autoComplete="off"
                placeholder={tipo === "sangria" ? "Retirada para o cofre" : "Reforço de moedas"}
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
              />
            </Field>
          </FieldGroup>
          {erro && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={movimentar.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
