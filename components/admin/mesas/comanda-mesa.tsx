"use client"

import NumberFlow from "@number-flow/react"
import { format } from "date-fns"
import {
  BanknoteIcon,
  CreditCardIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  QrCodeIcon,
  ReceiptIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useRef, useState } from "react"
import { NumericFormat } from "react-number-format"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useLoja, usePedido, useServirRodada } from "@/lib/admin/dados/consultas"
import {
  useAlterarQuantidade,
  useExcluirMesa,
  useFecharConta,
  useLancarNaMesa,
  useLiberarMesa,
  useRemoverItem,
} from "@/lib/admin/dados/consultas-mesas"
import type { PagamentoMesa } from "@/lib/admin/dados/servidor"
import type { ItemPedido, Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { cozinhaJaPreparou, prontosParaServir } from "@/lib/admin/regras/cozinha"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { emReais, formatoMoeda } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

const PAGAMENTOS: { valor: PagamentoMesa; rotulo: string; icone: typeof BanknoteIcon }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro", icone: BanknoteIcon },
  { valor: "pix", rotulo: "Pix", icone: QrCodeIcon },
  { valor: "cartao-na-entrega", rotulo: "Cartão", icone: CreditCardIcon },
]

/** Conta no formato do cupom de 80 mm. Fica fora da tela e só aparece na impressão. */
function ContaImpressa({
  pedido,
  mesa,
  loja,
  ref,
}: {
  pedido: Pedido
  mesa: Mesa
  loja: string | undefined
  ref: React.Ref<HTMLDivElement>
}) {
  return (
    <div className="hidden">
      <div ref={ref} className="flex flex-col gap-2 p-2 font-mono text-xs text-black">
        <p className="text-center font-bold">{loja}</p>
        <p className="text-center">
          Mesa {mesa.numero} · {pedido.cliente.nome}
        </p>
        <p className="text-center">Conferência · {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        <hr className="border-dashed border-black" />
        {pedido.itens.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between gap-2">
              <span>
                {item.quantidade}× {item.nome}
              </span>
              <span>{emReais(item.total)}</span>
            </div>
            {item.opcoes.map((opcao) => (
              <p key={opcao} className="pl-3">
                * {opcao}
              </p>
            ))}
          </div>
        ))}
        <hr className="border-dashed border-black" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{emReais(pedido.total)}</span>
        </div>
        <p className="text-center">Não é documento fiscal.</p>
      </div>
    </div>
  )
}

function ItemAvulso({ mesaId }: { mesaId: string }) {
  const [nome, setNome] = useState("")
  const [valor, setValor] = useState<number | undefined>()
  const lancar = useLancarNaMesa()
  return (
    <form
      className="grid grid-cols-[1fr_7rem_auto] items-end gap-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!nome.trim() || !valor) return toast.error("Informe o nome e o valor do item.")
        lancar.mutate(
          {
            mesaId,
            enviarParaCozinha: false,
            itens: [{ avulso: { nome, preco: valor }, quantidade: 1 }],
          },
          {
            onSuccess: () => {
              setNome("")
              setValor(undefined)
            },
            onError: (erro) => toast.error(erro.message),
          },
        )
      }}
    >
      <Field>
        <FieldLabel htmlFor="comanda-avulso">Item avulso</FieldLabel>
        <Input
          id="comanda-avulso"
          maxLength={80}
          placeholder="Couvert, rolha…"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="comanda-avulso-valor">Valor</FieldLabel>
        <NumericFormat
          id="comanda-avulso-valor"
          customInput={Input}
          inputMode="decimal"
          prefix="R$ "
          decimalSeparator=","
          thousandSeparator="."
          decimalScale={2}
          value={valor ?? ""}
          onValueChange={({ floatValue }) => setValor(floatValue)}
        />
      </Field>
      <Button
        type="submit"
        variant="outline"
        aria-label="Incluir item avulso"
        disabled={lancar.isPending}
      >
        <PlusIcon />
      </Button>
    </form>
  )
}

function FecharConta({
  pedido,
  mesa,
  aberta,
  aoMudar,
  aoFechar,
}: {
  pedido: Pedido
  mesa: Mesa
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoFechar: () => void
}) {
  const [pagamento, setPagamento] = useState<PagamentoMesa | null>(null)
  const fechar = useFecharConta()
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fechar a conta da mesa {mesa.numero}</DialogTitle>
          <DialogDescription>
            A comanda é concluída como paga e a mesa fica livre.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Forma de pagamento"
          value={pagamento ?? ""}
          onValueChange={(valor) => setPagamento(valor as PagamentoMesa)}
          className="grid grid-cols-3 gap-0.5 rounded-xl bg-foreground/[0.05] p-0.5"
        >
          {PAGAMENTOS.map(({ valor, rotulo, icone: Icone }) => (
            // Controle segmentado: a forma escolhida vira a etiqueta branca no trilho.
            <Label
              key={valor}
              htmlFor={`conta-pagamento-${valor}`}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium text-muted-foreground",
                "transition-[background-color,color,box-shadow,transform] duration-150 ease-saida hover:text-foreground active:scale-[0.97]",
                "has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              )}
            >
              <RadioGroupItem value={valor} id={`conta-pagamento-${valor}`} className="sr-only" />
              <Icone className="size-4" aria-hidden="true" />
              {rotulo}
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            disabled={!pagamento || fechar.isPending}
            onClick={() =>
              pagamento &&
              fechar.mutate(
                { pedidoId: pedido.id, pagamento },
                {
                  onSuccess: () => {
                    toast.success(`Conta da mesa ${mesa.numero} fechada.`, {
                      description: `${emReais(pedido.total)} · ${rotuloPagamento(pagamento)}`,
                    })
                    aoFechar()
                  },
                  onError: (erro) => toast.error(erro.message),
                },
              )
            }
          >
            Receber {emReais(pedido.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Comanda({ mesa, pedido, aoFechar }: { mesa: Mesa; pedido: Pedido; aoFechar: () => void }) {
  const { data: loja } = useLoja()
  const alterar = useAlterarQuantidade()
  const remover = useRemoverItem()
  const liberar = useLiberarMesa()
  const [fechando, setFechando] = useState(false)
  const conta = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: conta,
    documentTitle: `Conta mesa ${mesa.numero}`,
    pageStyle:
      "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px }",
  })
  const vazia = pedido.itens.length === 0
  const aoErrar = (erro: Error) => toast.error(erro.message)
  // Item que a cozinha já preparou: tirar ou diminuir pergunta antes.
  const [confirmando, setConfirmando] = useState<{ item: ItemPedido; tirar: () => void } | null>(
    null,
  )
  const comConfirmacao = (item: ItemPedido, tirar: () => void) =>
    cozinhaJaPreparou(pedido, item) ? setConfirmando({ item, tirar }) : tirar()
  const diminuir = (item: ItemPedido) =>
    alterar.mutate(
      { pedidoId: pedido.id, itemId: item.id, quantidade: item.quantidade - 1 },
      { onError: aoErrar },
    )
  const tirar = (item: ItemPedido) =>
    remover.mutate({ pedidoId: pedido.id, itemId: item.id }, { onError: aoErrar })
  const semMovimento = useReducedMotion()
  const estado = estadoDaMesa(mesa, pedido)
  const servir = useServirRodada()
  const prontas = prontosParaServir([pedido])

  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border/70">
        <div className="flex items-center gap-3 pr-8">
          <SheetTitle className="text-lg">Mesa {mesa.numero}</SheetTitle>
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Traco tom={estado.tom} />
            {estado.rotulo}
          </span>
        </div>
        <SheetDescription>
          {[
            pedido.cliente.nome,
            `desde ${format(new Date(pedido.criadoEm), "HH:mm")}`,
            pedido.mesa?.garcom ? `Garçom ${pedido.mesa.garcom}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {prontas.length > 0 && (
          <ul aria-label="Prontos para servir" className="flex flex-col gap-2">
            {prontas.map((ticket) => (
              <li
                key={ticket.id}
                aria-label={`${ticket.rodada}ª rodada pronta`}
                className="flex items-center gap-3 rounded-lg bg-(--tom-pronto)/[0.08] py-2 pr-2 pl-3"
              >
                <Traco tom="pronto" />
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-semibold">{ticket.rodada}ª rodada pronta</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {ticket.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    servir.mutate({ id: pedido.id, rodada: ticket.rodada }, { onError: aoErrar })
                  }
                >
                  Servido
                </Button>
              </li>
            ))}
          </ul>
        )}
        {vazia ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-balance text-muted-foreground">
            A comanda está vazia. Libere a mesa ou lance itens pelo Garçom.
          </p>
        ) : (
          <ul
            aria-label="Itens da comanda"
            className="-mt-2 flex flex-col divide-y divide-border/70 border-b border-border/70"
          >
            <AnimatePresence initial={false}>
              {pedido.itens.map((item) => (
                <motion.li
                  key={item.id}
                  aria-label={item.nome}
                  layout={semMovimento ? false : "position"}
                  initial={semMovimento ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="font-medium">{item.nome}</span>
                    {item.opcoes.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.opcoes.join(" · ")}
                      </span>
                    )}
                    {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {emReais(item.precoUnitario)} cada · {emReais(item.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      className="max-md:size-10"
                      variant="outline"
                      aria-label="Menos um"
                      disabled={item.quantidade <= 1}
                      onClick={() => comConfirmacao(item, () => diminuir(item))}
                    >
                      <MinusIcon />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums">
                      {item.quantidade}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      className="max-md:size-10"
                      variant="outline"
                      aria-label="Mais um"
                      disabled={item.quantidade >= 999}
                      onClick={() =>
                        alterar.mutate(
                          { pedidoId: pedido.id, itemId: item.id, quantidade: item.quantidade + 1 },
                          { onError: aoErrar },
                        )
                      }
                    >
                      <PlusIcon />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      className="max-md:size-10"
                      variant="ghost"
                      aria-label="Remover"
                      onClick={() => comConfirmacao(item, () => tirar(item))}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        <ItemAvulso mesaId={mesa.id} />
      </div>

      <SheetFooter className="gap-3 border-t border-border/70">
        {/* O total fica sempre à vista, junto das ações que fecham a mesa. */}
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">Total</span>
          <NumberFlow
            value={pedido.total}
            locales="pt-BR"
            format={formatoMoeda}
            className="text-[28px] leading-none font-semibold tracking-[-0.025em] tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {vazia ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 flex-1"
              disabled={liberar.isPending}
              onClick={() =>
                liberar.mutate(mesa.id, {
                  onSuccess: () => {
                    toast.success(`Mesa ${mesa.numero} liberada.`)
                    aoFechar()
                  },
                  onError: aoErrar,
                })
              }
            >
              Liberar mesa
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 flex-1"
              onClick={() => imprimir()}
            >
              <PrinterIcon data-icon="inline-start" />
              Imprimir conta
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            className="h-11 flex-1"
            disabled={vazia}
            onClick={() => setFechando(true)}
          >
            <ReceiptIcon data-icon="inline-start" />
            Fechar conta
          </Button>
        </div>
      </SheetFooter>

      <ContaImpressa pedido={pedido} mesa={mesa} loja={loja?.nome} ref={conta} />
      <AlertDialog
        open={confirmando !== null}
        onOpenChange={(aberto) => !aberto && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar {confirmando?.item.nome} da comanda?</AlertDialogTitle>
            <AlertDialogDescription>A cozinha já preparou.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                confirmando?.tirar()
                setConfirmando(null)
              }}
            >
              Tirar da comanda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <FecharConta
        pedido={pedido}
        mesa={mesa}
        aberta={fechando}
        aoMudar={setFechando}
        aoFechar={() => {
          setFechando(false)
          aoFechar()
        }}
      />
    </>
  )
}

function MesaLivre({ mesa, aoFechar }: { mesa: Mesa; aoFechar: () => void }) {
  const excluir = useExcluirMesa()
  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border/70">
        <SheetTitle className="text-lg">Mesa {mesa.numero}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5">
          <Traco tom="fim" />
          Mesa livre.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-3 p-4 text-sm text-muted-foreground">
        <p>A comanda abre quando o garçom lança o primeiro item.</p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/admin/garcom">Abrir o Garçom</Link>
        </Button>
      </div>
      <SheetFooter className="border-t border-border/70">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="text-destructive">
              <Trash2Icon data-icon="inline-start" />
              Excluir mesa
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir a mesa {mesa.numero}?</AlertDialogTitle>
              <AlertDialogDescription>
                Ela sai da grade e do Garçom. As contas já fechadas continuam nos pedidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  excluir.mutate(mesa.id, {
                    onSuccess: () => {
                      toast.success(`Mesa ${mesa.numero} excluída.`)
                      aoFechar()
                    },
                    onError: (erro) => toast.error(erro.message),
                  })
                }
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetFooter>
    </>
  )
}

function ConteudoComanda({ mesa, aoFechar }: { mesa: Mesa; aoFechar: () => void }) {
  const { data: pedido } = usePedido(mesa.pedidoAtivoId ?? null)
  if (!mesa.pedidoAtivoId) return <MesaLivre mesa={mesa} aoFechar={aoFechar} />
  if (!pedido) {
    return (
      <SheetHeader>
        <SheetTitle>Mesa {mesa.numero}</SheetTitle>
        <SheetDescription className="sr-only">Carregando a comanda</SheetDescription>
        <Skeleton className="h-64 w-full" />
      </SheetHeader>
    )
  }
  return <Comanda mesa={mesa} pedido={pedido} aoFechar={aoFechar} />
}

/** Painel da mesa: a comanda aberta, ou as ações de uma mesa livre. */
export function ComandaMesa({ mesa, aoFechar }: { mesa: Mesa | null; aoFechar: () => void }) {
  const telaGrande = useTelaGrande()
  return (
    <Sheet open={mesa !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:max-h-[92dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {mesa && <ConteudoComanda key={mesa.id} mesa={mesa} aoFechar={aoFechar} />}
      </SheetContent>
    </Sheet>
  )
}
