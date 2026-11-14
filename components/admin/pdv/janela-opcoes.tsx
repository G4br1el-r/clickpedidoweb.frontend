"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { Produto } from "@/lib/admin/dados/tipos"
import {
  type Escolhas,
  errosDasEscolhas,
  type ItemVenda,
  precoComOpcoes,
  resumoDasOpcoes,
} from "@/lib/admin/regras/pdv"
import { emReais } from "@/lib/formato"

function regra(minimo: number, maximo: number) {
  if (minimo === 1 && maximo === 1) return "Escolha 1"
  if (minimo === 0) return `Até ${maximo}`
  return `De ${minimo} a ${maximo}`
}

/** Janela das opções do produto no PDV e no Garçom: escolhas, observação e quantidade. */
export function JanelaOpcoes({
  produto,
  precoBase,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto | null
  precoBase: number
  aoFechar: () => void
  /** Recebe também as escolhas: PDV e Garçom as mandam para o servidor calcular o preço. */
  aoAdicionar: (item: Omit<ItemVenda, "chave">, escolhas: Escolhas) => void
}) {
  const grupos = (produto?.grupos ?? [])
    .filter((grupo) => grupo.ativo)
    .toSorted((a, b) => a.ordem - b.ordem)
  // Começa sem nada marcado: o caixa escolhe de propósito (nada de borda cobrada por engano).
  const [escolhas, setEscolhas] = useState<Escolhas>({})
  const [tentou, setTentou] = useState(false)
  const [observacao, setObservacao] = useState("")
  const [quantidade, setQuantidade] = useState(1)

  if (!produto) return null
  const unitario = precoComOpcoes(precoBase, grupos, escolhas)
  const erros = errosDasEscolhas(grupos, escolhas)

  const adicionar = () => {
    setTentou(true)
    if (Object.keys(erros).length > 0) return
    aoAdicionar(
      {
        produtoId: produto.id,
        nome: produto.nome,
        quantidade,
        precoUnitario: unitario,
        opcoes: resumoDasOpcoes(grupos, escolhas),
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      },
      escolhas,
    )
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Opções de {produto.nome}</DialogTitle>
          <DialogDescription>A partir de {emReais(precoBase)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 overflow-y-auto p-4">
          {grupos.map((grupo) => {
            const itens = grupo.itens.filter((item) => item.ativo)
            const marcados = escolhas[grupo.id] ?? []
            const erro = tentou ? erros[grupo.id] : undefined
            const rotulo = (nome: string, preco: number) =>
              `${nome}${preco > 0 ? ` +${emReais(preco)}` : ""}`
            return (
              <FieldSet key={grupo.id} data-invalid={Boolean(erro)}>
                <FieldLegend variant="label" className="flex w-full justify-between">
                  {grupo.nome}
                  <span className="text-xs font-normal text-muted-foreground">
                    {regra(grupo.minimo, grupo.maximo)}
                    {grupo.gratisAte > 0 ? ` · ${grupo.gratisAte} grátis` : ""}
                  </span>
                </FieldLegend>
                {grupo.maximo === 1 ? (
                  <RadioGroup
                    value={marcados[0] ?? ""}
                    onValueChange={(valor) => setEscolhas({ ...escolhas, [grupo.id]: [valor] })}
                  >
                    {itens.map((item) => (
                      <Field key={item.id} orientation="horizontal">
                        <RadioGroupItem value={item.id} id={`${grupo.id}-${item.id}`} />
                        <FieldLabel htmlFor={`${grupo.id}-${item.id}`} className="font-normal">
                          {rotulo(item.nome, item.precoAdicional)}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="flex flex-col gap-2">
                    {itens.map((item) => (
                      <Field key={item.id} orientation="horizontal">
                        <Checkbox
                          id={`${grupo.id}-${item.id}`}
                          checked={marcados.includes(item.id)}
                          onCheckedChange={(marcado) =>
                            setEscolhas({
                              ...escolhas,
                              [grupo.id]: marcado
                                ? [...marcados, item.id]
                                : marcados.filter((id) => id !== item.id),
                            })
                          }
                        />
                        <FieldLabel htmlFor={`${grupo.id}-${item.id}`} className="font-normal">
                          {rotulo(item.nome, item.precoAdicional)}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                )}
                {erro && <FieldError>{erro}</FieldError>}
              </FieldSet>
            )
          })}
          <Field>
            <FieldLabel htmlFor="pdv-observacao-item">Observação</FieldLabel>
            <Textarea
              id="pdv-observacao-item"
              rows={2}
              maxLength={140}
              value={observacao}
              onChange={(evento) => setObservacao(evento.target.value)}
              placeholder="Ex.: sem cebola"
            />
          </Field>
        </div>
        <DialogFooter className="flex-row items-center gap-2 border-t p-4">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Diminuir"
              disabled={quantidade <= 1}
              onClick={() => setQuantidade(quantidade - 1)}
            >
              <MinusIcon />
            </Button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">
              {quantidade}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Aumentar"
              onClick={() => setQuantidade(quantidade + 1)}
            >
              <PlusIcon />
            </Button>
          </div>
          <Button type="button" className="flex-1" onClick={adicionar}>
            Adicionar · {emReais(unitario * quantidade)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
