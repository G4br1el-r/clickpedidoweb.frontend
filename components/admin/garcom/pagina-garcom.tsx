"use client"

import {
  ChefHatIcon,
  MinusIcon,
  PlusIcon,
  SendIcon,
  ShoppingBasketIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { usePedido } from "@/lib/admin/dados/consultas"
import { useLancarNaMesa, useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { useGarcom, useGarcomCarregado } from "@/lib/admin/garcom"
import {
  adicionarItem,
  type Escolhas,
  type ItemVenda,
  precoDeBalcao,
  totaisDaVenda,
} from "@/lib/admin/regras/pdv"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { emReais, plural } from "@/lib/formato"
import { ComandaMesa } from "../mesas/comanda-mesa"
import { CatalogoBalcao } from "../pdv/catalogo-balcao"
import { JanelaOpcoes } from "../pdv/janela-opcoes"

/** Item da bandeja: o que a tela mostra e as escolhas que vão para o servidor. */
type ItemBandeja = Omit<ItemVenda, "chave"> & { escolhas: Escolhas }

function Bandeja({
  itens,
  mesaEscolhida,
  enviando,
  mudarQuantidade,
  remover,
  aoLancar,
}: {
  itens: (ItemBandeja & { chave: string })[]
  mesaEscolhida: boolean
  enviando: boolean
  mudarQuantidade: (chave: string, quantidade: number) => void
  remover: (chave: string) => void
  aoLancar: (enviarParaCozinha: boolean) => void
}) {
  const { quantidade, total } = totaisDaVenda(itens, { modo: "reais", valor: 0 })
  const bloqueado = !mesaEscolhida || itens.length === 0 || enviando
  return (
    <section aria-label="Bandeja" className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-semibold">
        Rodada nova
        {quantidade > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            {plural(quantidade, "item", "itens")}
          </span>
        )}
      </h2>
      {itens.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Toque nos produtos para montar a rodada.
        </p>
      ) : (
        <ul aria-label="Itens da bandeja" className="flex flex-col divide-y">
          {itens.map((item) => (
            <li key={item.chave} aria-label={item.nome} className="flex items-start gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="font-medium">{item.nome}</span>
                {item.opcoes.length > 0 && (
                  <span className="text-xs text-muted-foreground">{item.opcoes.join(" · ")}</span>
                )}
                {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {emReais(item.precoUnitario * item.quantidade)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Menos um"
                  onClick={() =>
                    item.quantidade <= 1
                      ? remover(item.chave)
                      : mudarQuantidade(item.chave, item.quantidade - 1)
                  }
                >
                  {item.quantidade <= 1 ? <Trash2Icon /> : <MinusIcon />}
                </Button>
                <span className="w-6 text-center text-sm font-medium tabular-nums">
                  {item.quantidade}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Mais um"
                  onClick={() => mudarQuantidade(item.chave, item.quantidade + 1)}
                >
                  <PlusIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Total da rodada</span>
        <span className="text-lg font-semibold tabular-nums">{emReais(total)}</span>
      </div>
      {!mesaEscolhida && <p className="text-sm text-muted-foreground">Escolha a mesa.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={bloqueado}
          onClick={() => aoLancar(false)}
        >
          <SendIcon data-icon="inline-start" />
          Lançar na mesa
        </Button>
        <Button type="button" size="lg" disabled={bloqueado} onClick={() => aoLancar(true)}>
          <ChefHatIcon data-icon="inline-start" />
          Enviar para a cozinha
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        “Lançar na mesa” é para o que sai pronto, como bebidas; o preço é conferido pelo sistema.
      </p>
    </section>
  )
}

/** Comanda da mesa escolhida: quem está e quanto já deu. */
function ResumoDaComanda({ pedidoId, aoVer }: { pedidoId: number; aoVer: () => void }) {
  const { data: comanda } = usePedido(pedidoId)
  if (!comanda) return null
  const itens = comanda.itens.reduce((soma, item) => soma + item.quantidade, 0)
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        {comanda.cliente.nome} · {plural(itens, "item", "itens")} · {emReais(comanda.total)}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={aoVer}>
        Ver comanda
      </Button>
    </div>
  )
}

/**
 * Garçom: pensado para o celular. Escolhe a mesa, monta a rodada com o catálogo do
 * balcão e lança na comanda, com ou sem passar pela cozinha.
 */
export function PaginaGarcom() {
  useGarcomCarregado()
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const telaGrande = useTelaGrande()
  const nome = useGarcom((estado) => estado.nome)
  const definirNome = useGarcom((estado) => estado.definirNome)
  const { data: mesas = [] } = useMesas()
  const lancar = useLancarNaMesa()
  const [mesaId, setMesaId] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  const [itens, setItens] = useState<(ItemBandeja & { chave: string })[]>([])
  const [comOpcoes, setComOpcoes] = useState<Produto | null>(null)
  const [bandejaAberta, setBandejaAberta] = useState(false)
  const [vendoComanda, setVendoComanda] = useState(false)

  const mesa = mesas.find((item) => item.id === mesaId) ?? null
  const incluir = (item: ItemBandeja) =>
    setItens((atuais) => adicionarItem<ItemBandeja & { chave: string }>(atuais, item))
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
  const quantidadeNa = (produtoId: string) =>
    itens
      .filter((item) => item.produtoId === produtoId)
      .reduce((soma, item) => soma + item.quantidade, 0)

  const aoLancar = (enviarParaCozinha: boolean) => {
    if (!mesa) return
    lancar.mutate(
      {
        mesaId: mesa.id,
        enviarParaCozinha,
        ...(nome.trim() ? { garcom: nome } : {}),
        ...(mesa.status === "livre" && cliente.trim() ? { clienteNome: cliente } : {}),
        itens: itens.map((item) => ({
          produtoId: item.produtoId as string,
          escolhas: item.escolhas,
          quantidade: item.quantidade,
          ...(item.observacao ? { observacao: item.observacao } : {}),
        })),
      },
      {
        onSuccess: () => {
          toast.success(
            `Mesa ${mesa.numero}: ${enviarParaCozinha ? "enviado para a cozinha" : "lançado na comanda"}.`,
          )
          setItens([])
          setCliente("")
          setBandejaAberta(false)
        },
        onError: (erro) => toast.error(erro.message),
      },
    )
  }

  const bandeja = (
    <Bandeja
      itens={itens}
      mesaEscolhida={mesa !== null}
      enviando={lancar.isPending}
      mudarQuantidade={(chave, quantidade) =>
        setItens((atuais) =>
          atuais.map((item) => (item.chave === chave ? { ...item, quantidade } : item)),
        )
      }
      remover={(chave) => setItens((atuais) => atuais.filter((item) => item.chave !== chave))}
      aoLancar={aoLancar}
    />
  )
  const { quantidade, total } = totaisDaVenda(itens, { modo: "reais", valor: 0 })

  return (
    // No celular, espaço no fim para a barra da bandeja não cobrir os últimos produtos.
    <div className="flex flex-1 flex-col gap-5 p-4 pb-24 md:p-6 lg:pb-6">
      <h1 className="text-2xl font-semibold tracking-tight">Garçom</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <FieldGroup className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="garcom-nome">Seu nome</FieldLabel>
              <Input
                id="garcom-nome"
                autoComplete="name"
                maxLength={40}
                value={nome}
                onChange={(evento) => definirNome(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="garcom-mesa">Mesa</FieldLabel>
              <Select value={mesaId ?? ""} onValueChange={setMesaId}>
                <SelectTrigger id="garcom-mesa" aria-label="Mesa" className="w-full">
                  <SelectValue placeholder="Escolha a mesa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {mesas.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        Mesa {item.numero} · {item.status === "livre" ? "livre" : item.clienteNome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {mesa?.status === "livre" && (
              <Field>
                <FieldLabel htmlFor="garcom-cliente">Cliente</FieldLabel>
                <Input
                  id="garcom-cliente"
                  maxLength={60}
                  placeholder="Opcional"
                  value={cliente}
                  onChange={(evento) => setCliente(evento.target.value)}
                />
              </Field>
            )}
            {mesa?.pedidoAtivoId && (
              <div className="sm:col-span-3">
                <ResumoDaComanda
                  pedidoId={mesa.pedidoAtivoId}
                  aoVer={() => setVendoComanda(true)}
                />
              </div>
            )}
          </FieldGroup>

          <CatalogoBalcao quantidadeNa={quantidadeNa} aoTocar={tocarProduto} />
        </div>

        {telaGrande ? (
          <aside className="sticky top-20 rounded-xl border bg-card p-4">{bandeja}</aside>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="fixed inset-x-4 bottom-4 z-20 shadow-lg"
              onClick={() => setBandejaAberta(true)}
            >
              <ShoppingBasketIcon data-icon="inline-start" />
              Ver bandeja · {plural(quantidade, "item", "itens")} · {emReais(total)}
            </Button>
            <Sheet open={bandejaAberta} onOpenChange={setBandejaAberta}>
              <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{mesa ? `Mesa ${mesa.numero}` : "Bandeja"}</SheetTitle>
                  <SheetDescription>Confira a rodada antes de lançar.</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">{bandeja}</div>
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
      <ComandaMesa mesa={vendoComanda ? mesa : null} aoFechar={() => setVendoComanda(false)} />
    </div>
  )
}
