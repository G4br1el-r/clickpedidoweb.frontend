"use client"

import { BanknoteIcon, CreditCardIcon, QrCodeIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { NumericFormat } from "react-number-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { VendaPdv } from "@/lib/admin/dados/servidor"
import {
  bloqueioDaVenda,
  type Desconto,
  type Escolhas,
  type ItemVenda,
  totaisDaVenda,
  troco,
} from "@/lib/admin/regras/pdv"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

export type Pagamento = VendaPdv["pagamento"]

const PAGAMENTOS: { valor: Pagamento; rotulo: string; icone: typeof BanknoteIcon }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro", icone: BanknoteIcon },
  { valor: "pix", rotulo: "Pix", icone: QrCodeIcon },
  { valor: "cartao-na-entrega", rotulo: "Cartão", icone: CreditCardIcon },
]

const dinheiro = {
  customInput: Input,
  inputMode: "decimal" as const,
  prefix: "R$ ",
  decimalSeparator: ",",
  thousandSeparator: ".",
  decimalScale: 2,
}

/**
 * Linha da caixa: o que a tela mostra e as escolhas que vão para o servidor. Do cardápio,
 * o preço é só uma prévia (o servidor recalcula); o avulso (`produtoId: null`) leva o
 * preço digitado.
 */
export type ItemCaixa = ItemVenda & { escolhas: Escolhas }

export type EstadoCaixa = {
  itens: ItemCaixa[]
  desconto: Desconto
  pagamento: Pagamento | null
  recebido: number | undefined
  cliente: string
  observacao: string
  concluida: boolean
}

export const CAIXA_VAZIA: EstadoCaixa = {
  itens: [],
  desconto: { modo: "reais", valor: 0 },
  pagamento: null,
  recebido: undefined,
  cliente: "",
  observacao: "",
  concluida: true,
}

/**
 * Quantidade da linha: enquanto digita, o campo pode ficar vazio; ao sair dele vazio
 * (ou com algo inválido), volta para 1.
 */
function CampoQuantidade({
  quantidade,
  aoMudar,
}: {
  quantidade: number
  aoMudar: (quantidade: number) => void
}) {
  const [texto, setTexto] = useState(String(quantidade))
  const [editando, setEditando] = useState(false)
  const valido = (valor: string) => {
    const numero = Number(valor)
    return valor.trim() !== "" && Number.isFinite(numero) ? Math.round(numero) : null
  }
  return (
    <Input
      type="number"
      aria-label="Quantidade"
      min={1}
      max={999}
      value={editando ? texto : quantidade}
      onFocus={() => {
        setTexto(String(quantidade))
        setEditando(true)
      }}
      onChange={(evento) => {
        setTexto(evento.target.value)
        const numero = valido(evento.target.value)
        if (numero !== null) aoMudar(Math.min(Math.max(numero, 1), 999))
      }}
      onBlur={() => {
        if (valido(texto) === null) aoMudar(1)
        setEditando(false)
      }}
      className="h-8 w-16 text-center tabular-nums"
    />
  )
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div
      className={cn(
        "flex justify-between",
        forte ? "text-lg font-semibold" : "text-sm text-muted-foreground",
      )}
    >
      <span>{rotulo}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  )
}

/** Caixa do PDV: itens, desconto, pagamento com troco e o botão de fechar a venda. */
export function CaixaPdv({
  estado,
  mudar,
  aoFinalizar,
  finalizando,
}: {
  estado: EstadoCaixa
  mudar: (mudanca: Partial<EstadoCaixa>) => void
  aoFinalizar: () => void
  finalizando: boolean
}) {
  const totais = totaisDaVenda(estado.itens, estado.desconto)
  const conta = troco(totais.total, estado.recebido ?? 0)
  const bloqueio = bloqueioDaVenda(estado)
  const trocarItem = (chave: string, mudanca: Partial<ItemCaixa>) =>
    mudar({
      itens: estado.itens.map((item) => (item.chave === chave ? { ...item, ...mudanca } : item)),
    })

  return (
    <section aria-label="Venda" className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Venda</h2>
        {estado.itens.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <Trash2Icon data-icon="inline-start" />
                Limpar venda
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar a venda?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os itens e o pagamento saem da caixa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => mudar(CAIXA_VAZIA)}>
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {estado.itens.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum item na venda.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {estado.itens.map((item) => (
            <li key={item.chave} aria-label={item.nome} className="flex flex-col gap-2 p-3">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{item.nome}</span>
                  {item.opcoes.map((opcao) => (
                    <span key={opcao} className="text-xs text-muted-foreground">
                      {opcao}
                    </span>
                  ))}
                  {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                </div>
                <span className="font-medium tabular-nums">
                  {emReais(item.precoUnitario * item.quantidade)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${item.nome}`}
                  onClick={() =>
                    mudar({ itens: estado.itens.filter((outro) => outro.chave !== item.chave) })
                  }
                >
                  <XIcon />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <CampoQuantidade
                  quantidade={item.quantidade}
                  aoMudar={(quantidade) => trocarItem(item.chave, { quantidade })}
                />
                <span className="text-xs text-muted-foreground">×</span>
                {item.produtoId ? (
                  // Do cardápio: o preço é calculado (balcão, adicionais e grátis), não digitado.
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm tabular-nums">{emReais(item.precoUnitario)}</span>
                    <span className="text-[11px] text-muted-foreground">Preço do cardápio</span>
                  </span>
                ) : (
                  <NumericFormat
                    {...dinheiro}
                    aria-label="Preço unitário"
                    value={item.precoUnitario}
                    onValueChange={({ floatValue }) =>
                      trocarItem(item.chave, { precoUnitario: floatValue ?? 0 })
                    }
                    className="h-8 w-28 text-right tabular-nums"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="pdv-desconto" className="mr-auto">
            Desconto
          </Label>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            aria-label="Desconto em"
            value={estado.desconto.modo}
            onValueChange={(modo) =>
              modo && mudar({ desconto: { modo: modo as Desconto["modo"], valor: 0 } })
            }
          >
            <ToggleGroupItem value="reais">R$</ToggleGroupItem>
            <ToggleGroupItem value="porcento">%</ToggleGroupItem>
          </ToggleGroup>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => mudar({ desconto: { modo: "porcento", valor: 5 } })}
          >
            5%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => mudar({ desconto: { modo: "porcento", valor: 10 } })}
          >
            10%
          </Button>
        </div>
        <NumericFormat
          id="pdv-desconto"
          customInput={Input}
          inputMode="decimal"
          decimalSeparator=","
          thousandSeparator="."
          decimalScale={2}
          {...(estado.desconto.modo === "reais" ? { prefix: "R$ " } : { suffix: "%" })}
          value={estado.desconto.valor || ""}
          onValueChange={({ floatValue }) =>
            mudar({ desconto: { ...estado.desconto, valor: floatValue ?? 0 } })
          }
          placeholder={estado.desconto.modo === "reais" ? "R$ 0,00" : "0%"}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Linha
          rotulo={`Subtotal (${totais.quantidade} ${totais.quantidade === 1 ? "item" : "itens"})`}
          valor={emReais(totais.subtotal)}
        />
        {totais.desconto > 0 && <Linha rotulo="Desconto" valor={`− ${emReais(totais.desconto)}`} />}
        <Linha rotulo="Total" valor={emReais(totais.total)} forte />
      </div>

      <FieldSet>
        <FieldLegend variant="label">Pagamento</FieldLegend>
        <RadioGroup
          value={estado.pagamento ?? ""}
          onValueChange={(valor) => mudar({ pagamento: valor as Pagamento, recebido: undefined })}
          className="grid grid-cols-3 gap-2"
        >
          {PAGAMENTOS.map(({ valor, rotulo, icone: Icone }) => (
            <Label
              key={valor}
              htmlFor={`pdv-pagamento-${valor}`}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-xs has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={valor} id={`pdv-pagamento-${valor}`} className="sr-only" />
              <Icone className="size-4" aria-hidden="true" />
              {rotulo}
            </Label>
          ))}
        </RadioGroup>
      </FieldSet>

      {estado.pagamento === "dinheiro" && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
          <Field>
            <FieldLabel htmlFor="pdv-recebido">Valor recebido</FieldLabel>
            <NumericFormat
              {...dinheiro}
              id="pdv-recebido"
              value={estado.recebido ?? ""}
              onValueChange={({ floatValue }) => mudar({ recebido: floatValue })}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => mudar({ recebido: totais.total })}
            >
              Valor exato
            </Button>
            {[20, 50, 100].map((nota) => (
              <Button
                key={nota}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => mudar({ recebido: nota })}
              >
                R$ {nota}
              </Button>
            ))}
          </div>
          {estado.recebido !== undefined &&
            (conta.falta > 0 ? (
              <p className="text-sm font-medium text-destructive">Faltam {emReais(conta.falta)}</p>
            ) : (
              <p className="text-sm font-medium">Troco: {emReais(conta.troco)}</p>
            ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pdv-cliente">Cliente</FieldLabel>
          <Input
            id="pdv-cliente"
            maxLength={60}
            value={estado.cliente}
            onChange={(evento) => mudar({ cliente: evento.target.value })}
            placeholder="Opcional"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pdv-observacao">Observação no ticket</FieldLabel>
          <Input
            id="pdv-observacao"
            maxLength={140}
            value={estado.observacao}
            onChange={(evento) => mudar({ observacao: evento.target.value })}
            placeholder="Opcional"
          />
        </Field>
      </div>

      <Separator />
      <Field orientation="horizontal">
        <Switch
          id="pdv-concluida"
          checked={estado.concluida}
          onCheckedChange={(concluida) => mudar({ concluida })}
        />
        <FieldLabel htmlFor="pdv-concluida" className="font-normal">
          Venda concluída no balcão
        </FieldLabel>
      </Field>
      <Button
        type="button"
        size="lg"
        disabled={Boolean(bloqueio) || finalizando}
        onClick={aoFinalizar}
      >
        {estado.concluida ? "Finalizar venda" : "Mandar para a fila"}
        <kbd className="ml-2 rounded border px-1 text-[10px] font-normal">F9</kbd>
      </Button>
      {bloqueio && estado.itens.length > 0 && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">{bloqueio}</p>
      )}
    </section>
  )
}
