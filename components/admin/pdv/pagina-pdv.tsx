"use client"

import NumberFlow from "@number-flow/react"
import { format } from "date-fns"
import { PlusIcon, PrinterIcon, ShoppingBasketIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { NumericFormat } from "react-number-format"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useFinalizarVenda, useLoja, useUltimasVendas } from "@/lib/admin/dados/consultas"
import type { Pedido, Produto } from "@/lib/admin/dados/tipos"
import {
  adicionarItem,
  bloqueioDaVenda,
  precoDeBalcao,
  totaisDaVenda,
  troco,
} from "@/lib/admin/regras/pdv"
import { rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { BlocoSecao } from "../bloco-secao"
import { CabecalhoPagina } from "../cabecalho-pagina"
import {
  type AvisoCaixa,
  CAIXA_VAZIA,
  CaixaPdv,
  type EstadoCaixa,
  type ItemCaixa,
  linhaQueMudou,
  Tecla,
} from "./caixa-pdv"
import { CatalogoBalcao } from "./catalogo-balcao"
import { JanelaOpcoes } from "./janela-opcoes"

/** Ticket da venda, no formato do cupom de 80 mm, pronto para imprimir. */
function Ticket({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const { data: loja } = useLoja()
  const area = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: area,
    documentTitle: `Venda ${pedido.numero}`,
    pageStyle:
      "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px }",
  })
  const recebido = pedido.trocoPara

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Venda #{pedido.numero}</DialogTitle>
          <DialogDescription>
            {pedido.status === "concluido" ? "Concluída e paga." : "Paga e enviada para a fila."}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={area}
          className="flex flex-col gap-2 rounded-lg border bg-card p-4 font-mono text-xs"
        >
          <p className="text-center font-bold">{loja?.nome}</p>
          <p className="text-center">
            Venda #{pedido.numero} · {format(new Date(pedido.criadoEm), "dd/MM/yyyy HH:mm")}
          </p>
          <hr className="border-dashed" />
          {pedido.itens.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between gap-2">
                <span>
                  {item.quantidade}× {item.nome}
                </span>
                <span>{emReais(item.total)}</span>
              </div>
              {item.opcoes.map((opcao) => (
                <p key={opcao} className="pl-3 opacity-80">
                  * {opcao}
                </p>
              ))}
            </div>
          ))}
          <hr className="border-dashed" />
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{emReais(pedido.subtotal)}</span>
          </div>
          {pedido.desconto > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>− {emReais(pedido.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{emReais(pedido.total)}</span>
          </div>
          <p>
            {rotuloPagamento(pedido.pagamento)} · PAGO
            {recebido
              ? ` · recebido ${emReais(recebido)} · troco ${emReais(troco(pedido.total, recebido).troco)}`
              : ""}
          </p>
          {pedido.observacao && <p>Obs.: {pedido.observacao}</p>}
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => imprimir()}>
            <PrinterIcon data-icon="inline-start" />
            Imprimir
          </Button>
          <Button type="button" className="flex-1" onClick={aoFechar} autoFocus>
            Nova venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemAvulso({ aoAdicionar }: { aoAdicionar: (item: Omit<ItemCaixa, "chave">) => void }) {
  const [nome, setNome] = useState("")
  const [quantidade, setQuantidade] = useState(1)
  const [valor, setValor] = useState<number | undefined>()
  return (
    <form
      className="grid grid-cols-[1fr_4rem_7rem_auto] items-end gap-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!nome.trim() || !valor) return toast.error("Informe o nome e o valor do item.")
        aoAdicionar({
          produtoId: null,
          nome: nome.trim(),
          quantidade,
          precoUnitario: valor,
          opcoes: [],
          escolhas: {},
        })
        setNome("")
        setQuantidade(1)
        setValor(undefined)
      }}
    >
      <Field>
        <FieldLabel htmlFor="avulso-nome">Item avulso</FieldLabel>
        <Input
          id="avulso-nome"
          maxLength={80}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="avulso-qtd">Qtd.</FieldLabel>
        <Input
          id="avulso-qtd"
          type="number"
          min={1}
          max={999}
          value={quantidade}
          onChange={(evento) => setQuantidade(Math.max(Number(evento.target.value) || 1, 1))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="avulso-valor">Valor</FieldLabel>
        <NumericFormat
          id="avulso-valor"
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
      <Button type="submit" variant="outline" aria-label="Incluir item avulso">
        <PlusIcon />
      </Button>
    </form>
  )
}

/** PDV: vender no balcão com o catálogo de um lado e a caixa do outro. */
export function PaginaPdv() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const telaGrande = useTelaGrande()
  const { data: ultimas = [] } = useUltimasVendas()
  const finalizar = useFinalizarVenda()
  const [caixa, setCaixa] = useState<EstadoCaixa>(CAIXA_VAZIA)
  const [comOpcoes, setComOpcoes] = useState<Produto | null>(null)
  const [ticket, setTicket] = useState<Pedido | null>(null)
  const [caixaAberta, setCaixaAberta] = useState(false)
  const campoBusca = useRef<HTMLInputElement>(null)

  const [aviso, setAviso] = useState<AvisoCaixa | null>(null)

  const mudar = (mudanca: Partial<EstadoCaixa>) => setCaixa((atual) => ({ ...atual, ...mudanca }))
  const incluir = (item: Omit<ItemCaixa, "chave">) => {
    const itens = adicionarItem<ItemCaixa>(caixa.itens, item)
    setCaixa({ ...caixa, itens })
    // A linha que entrou ou cresceu: acende na caixa e é anunciada.
    const linha = linhaQueMudou(caixa.itens, itens)
    if (linha) {
      setAviso((atual) => ({
        chave: linha.chave,
        texto: `${linha.nome}: ${linha.quantidade} na venda`,
        vez: (atual?.vez ?? 0) + 1,
      }))
    }
  }

  const tocarProduto = (produto: Produto) => {
    if (produto.grupos.some((grupo) => grupo.ativo)) return setComOpcoes(produto)
    incluir({
      produtoId: produto.id,
      nome: produto.nome,
      quantidade: 1,
      precoUnitario: precoDeBalcao(produto, segmento),
      opcoes: [],
      escolhas: {},
    })
  }

  const fechar = () => {
    if (bloqueioDaVenda(caixa) || finalizar.isPending) return
    finalizar.mutate(
      {
        // Do cardápio vão só as escolhas: o preço é do servidor. O avulso leva o digitado.
        itens: caixa.itens.map((item) => ({
          ...(item.produtoId
            ? { produtoId: item.produtoId, escolhas: item.escolhas }
            : { avulso: { nome: item.nome, preco: item.precoUnitario } }),
          quantidade: item.quantidade,
          ...(item.observacao ? { observacao: item.observacao } : {}),
        })),
        pagamento: caixa.pagamento ?? "pix",
        desconto: caixa.desconto,
        ...(caixa.pagamento === "dinheiro" && caixa.recebido
          ? { valorRecebido: caixa.recebido }
          : {}),
        clienteNome: caixa.cliente,
        observacao: caixa.observacao,
        concluida: caixa.concluida,
      },
      {
        onSuccess: (pedido) => {
          setTicket(pedido)
          setCaixa(CAIXA_VAZIA)
          setAviso(null)
          setCaixaAberta(false)
        },
        onError: (erro) => toast.error(erro.message),
      },
    )
  }

  // "/" pela tecla produzida: funciona em qualquer layout de teclado.
  useHotkeys("/", () => campoBusca.current?.focus(), { preventDefault: true, useKey: true })
  useHotkeys("f9", fechar, { preventDefault: true, enableOnFormTags: true, useKey: true }, [
    caixa,
    finalizar.isPending,
  ])

  const totais = totaisDaVenda(caixa.itens, caixa.desconto)
  const quantidadeNaCaixa = (produtoId: string) =>
    caixa.itens
      .filter((item) => item.produtoId === produtoId)
      .reduce((soma, item) => soma + item.quantidade, 0)

  const painelDaCaixa = (
    <CaixaPdv
      estado={caixa}
      mudar={mudar}
      aoFinalizar={fechar}
      finalizando={finalizar.isPending}
      aviso={aviso}
    />
  )

  return (
    // No celular, espaço no fim para a barra "Ver venda" não cobrir os últimos produtos.
    <div className="flex flex-1 flex-col gap-5 p-4 pb-24 md:p-6 lg:px-8 lg:pb-6">
      <CabecalhoPagina
        titulo="PDV"
        resumo={
          <>
            Venda no balcão
            <span className="max-lg:hidden">
              . Atalhos: <Tecla>/</Tecla> busca e <Tecla>F9</Tecla> finaliza.
            </span>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-0">
        <div className="flex min-w-0 flex-col gap-5 lg:pr-6">
          <CatalogoBalcao
            campoBusca={campoBusca}
            quantidadeNa={quantidadeNaCaixa}
            aoTocar={tocarProduto}
          />

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="self-start">
                <PlusIcon data-icon="inline-start" />
                Lançar item avulso
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ItemAvulso aoAdicionar={incluir} />
            </CollapsibleContent>
          </Collapsible>

          <BlocoSecao titulo="Últimas vendas de hoje">
            {ultimas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma venda no balcão hoje. Cada venda finalizada entra aqui, com o ticket.
              </p>
            ) : (
              <div className="-mt-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venda</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead className="hidden sm:table-cell">Itens</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimas.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell className="font-medium tabular-nums">#{venda.numero}</TableCell>
                        <TableCell className="tabular-nums">
                          {format(new Date(venda.criadoEm), "HH:mm")}
                        </TableCell>
                        <TableCell className="hidden max-w-60 truncate sm:table-cell">
                          {venda.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {emReais(venda.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </BlocoSecao>
        </div>

        {telaGrande ? (
          // Caixa plana, separada do catálogo por um fio; acompanha a rolagem.
          <aside className="lg:sticky lg:top-20 lg:border-l lg:border-border/70 lg:pl-6">
            {painelDaCaixa}
          </aside>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="fixed inset-x-4 bottom-4 z-20 h-12 justify-between rounded-xl px-4 shadow-lg"
              onClick={() => setCaixaAberta(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBasketIcon data-icon="inline-start" />
                Ver venda · {plural(totais.quantidade, "item", "itens")}
              </span>
              <NumberFlow
                value={totais.total}
                locales="pt-BR"
                format={formatoMoeda}
                className="font-semibold tabular-nums"
              />
            </Button>
            <Sheet open={caixaAberta} onOpenChange={setCaixaAberta}>
              <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto p-4">
                <SheetHeader className="sr-only">
                  <SheetTitle>Venda</SheetTitle>
                  <SheetDescription>Itens, desconto e pagamento.</SheetDescription>
                </SheetHeader>
                {painelDaCaixa}
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {comOpcoes && (
        <JanelaOpcoes
          key={comOpcoes.id}
          produto={comOpcoes}
          precoBase={precoDeBalcao(comOpcoes, segmento)}
          aoFechar={() => setComOpcoes(null)}
          aoAdicionar={(item, escolhas) => {
            incluir({ ...item, escolhas })
            setComOpcoes(null)
          }}
        />
      )}
      {ticket && <Ticket pedido={ticket} aoFechar={() => setTicket(null)} />}
    </div>
  )
}
