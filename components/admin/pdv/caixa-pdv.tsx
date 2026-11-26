"use client"

import NumberFlow from "@number-flow/react"
import { BanknoteIcon, CreditCardIcon, QrCodeIcon, Trash2Icon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
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
import { emReais, formatoMoeda } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { BotaoCarregando } from "../movimento/botao-carregando"

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

/** O último toque: que linha mudou e o que dizer. `vez` faz o realce voltar a cada toque. */
export type AvisoCaixa = { chave: string; texto: string; vez: number }

/** A linha que um toque criou ou fez crescer (PDV e Garçom). */
export function linhaQueMudou<T extends { chave: string; quantidade: number }>(
  antes: T[],
  depois: T[],
): T | undefined {
  return depois.find((item) => {
    const anterior = antes.find((outro) => outro.chave === item.chave)
    return !anterior || anterior.quantidade !== item.quantidade
  })
}

/** Tecla de atalho, no mesmo desenho em todo o PDV. */
export function Tecla({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/25 px-1 font-sans text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </kbd>
  )
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
      className="h-8 w-14 text-center tabular-nums"
    />
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{rotulo}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  )
}

/** Venda vazia: diz o que fazer e mostra os atalhos. */
function VendaVazia() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-7 text-center">
      <p className="text-sm font-medium">Nenhum item na venda.</p>
      <p className="text-[13px] text-balance text-muted-foreground">
        Toque num produto do cardápio para começar a venda.
      </p>
      <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground max-lg:hidden">
        <span className="flex items-center gap-1.5">
          <Tecla>/</Tecla> busca
        </span>
        <span className="flex items-center gap-1.5">
          <Tecla>F9</Tecla> finaliza
        </span>
      </p>
    </div>
  )
}

/** Caixa do PDV: itens, desconto, pagamento com troco e o botão de fechar a venda. */
export function CaixaPdv({
  estado,
  mudar,
  aoFinalizar,
  finalizando,
  aviso = null,
}: {
  estado: EstadoCaixa
  mudar: (mudanca: Partial<EstadoCaixa>) => void
  aoFinalizar: () => void
  finalizando: boolean
  aviso?: AvisoCaixa | null
}) {
  const semMovimento = useReducedMotion()
  const totais = totaisDaVenda(estado.itens, estado.desconto)
  const conta = troco(totais.total, estado.recebido ?? 0)
  const bloqueio = bloqueioDaVenda(estado)
  const trocarItem = (chave: string, mudanca: Partial<ItemCaixa>) =>
    mudar({
      itens: estado.itens.map((item) => (item.chave === chave ? { ...item, ...mudanca } : item)),
    })

  return (
    <section aria-label="Venda" className="flex h-full flex-col gap-5">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold">
          Venda
          {totais.quantidade > 0 && (
            <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
              <NumberFlow value={totais.quantidade} /> {totais.quantidade === 1 ? "item" : "itens"}
            </span>
          )}
        </h2>
        {estado.itens.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
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

      {/* O que o último toque fez, para quem usa leitor de tela. */}
      <p role="status" className="sr-only">
        {aviso?.texto}
      </p>

      {estado.itens.length === 0 ? (
        <VendaVazia />
      ) : (
        <ul className="-mt-2 flex flex-col divide-y divide-border/70 border-b border-border/70">
          <AnimatePresence initial={false}>
            {estado.itens.map((item) => (
              <motion.li
                key={item.chave}
                aria-label={item.nome}
                layout={semMovimento ? false : "position"}
                initial={semMovimento ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="relative flex flex-col gap-2 py-3"
              >
                {/* Realce do toque: a linha que acabou de mudar acende e apaga sozinha. */}
                {aviso?.chave === item.chave && (
                  <motion.span
                    key={aviso.vez}
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-x-2 inset-y-0 rounded-lg bg-foreground"
                    initial={{ opacity: 0.07 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  />
                )}
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{item.nome}</span>
                    {item.opcoes.map((opcao) => (
                      <span key={opcao} className="text-xs text-muted-foreground">
                        {opcao}
                      </span>
                    ))}
                    {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                  </div>
                  <span className="pt-px text-sm font-semibold tabular-nums">
                    {emReais(item.precoUnitario * item.quantidade)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-0.5 -mr-1 text-muted-foreground"
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
              </motion.li>
            ))}
          </AnimatePresence>
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
            variant="segmento"
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
            variant="ghost"
            onClick={() => mudar({ desconto: { modo: "porcento", valor: 5 } })}
          >
            5%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
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

      <div className="flex flex-col gap-1.5 border-t border-border/70 pt-4">
        <Linha
          rotulo={`Subtotal (${totais.quantidade} ${totais.quantidade === 1 ? "item" : "itens"})`}
        >
          {emReais(totais.subtotal)}
        </Linha>
        {totais.desconto > 0 && <Linha rotulo="Desconto">− {emReais(totais.desconto)}</Linha>}
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[15px] font-semibold">Total</span>
          <NumberFlow
            value={totais.total}
            locales="pt-BR"
            format={formatoMoeda}
            className="text-[28px] leading-none font-semibold tracking-[-0.025em] tabular-nums"
          />
        </div>
      </div>

      <FieldSet className="gap-2">
        <FieldLegend variant="label">Pagamento</FieldLegend>
        {/* Controle segmentado: a forma escolhida vira a etiqueta branca no trilho. */}
        <RadioGroup
          value={estado.pagamento ?? ""}
          onValueChange={(valor) => mudar({ pagamento: valor as Pagamento, recebido: undefined })}
          className="grid grid-cols-3 gap-0.5 rounded-xl bg-foreground/[0.05] p-0.5"
        >
          {PAGAMENTOS.map(({ valor, rotulo, icone: Icone }) => (
            <Label
              key={valor}
              htmlFor={`pdv-pagamento-${valor}`}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium text-muted-foreground",
                "transition-[background-color,color,box-shadow,transform] duration-150 ease-saida hover:text-foreground active:scale-[0.97]",
                "has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              )}
            >
              <RadioGroupItem value={valor} id={`pdv-pagamento-${valor}`} className="sr-only" />
              <Icone className="size-4" aria-hidden="true" />
              {rotulo}
            </Label>
          ))}
        </RadioGroup>
      </FieldSet>

      {estado.pagamento === "dinheiro" && (
        <div className="-mt-2 flex flex-col gap-2.5 rounded-xl bg-foreground/[0.03] p-3">
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
              <p className="text-sm font-semibold tabular-nums">Troco: {emReais(conta.troco)}</p>
            ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

      <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
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
        <BotaoCarregando
          type="button"
          size="lg"
          className="h-11 text-[15px]"
          carregando={finalizando}
          rotuloCarregando="Finalizando a venda"
          disabled={Boolean(bloqueio)}
          onClick={aoFinalizar}
        >
          {estado.concluida ? "Finalizar venda" : "Mandar para a fila"}
          <Tecla className="ml-1.5 text-primary-foreground/80">F9</Tecla>
        </BotaoCarregando>
        {bloqueio && estado.itens.length > 0 && (
          <p className="-mt-1 text-center text-xs text-muted-foreground">{bloqueio}</p>
        )}
      </div>
    </section>
  )
}
