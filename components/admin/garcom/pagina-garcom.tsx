"use client"

import NumberFlow from "@number-flow/react"
import {
  ChefHatIcon,
  MinusIcon,
  PlusIcon,
  SendIcon,
  ShoppingBasketIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
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
import type { Mesa, Produto } from "@/lib/admin/dados/tipos"
import { useGarcom, useGarcomCarregado } from "@/lib/admin/garcom"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import {
  adicionarItem,
  type Escolhas,
  type ItemVenda,
  precoDeBalcao,
  totaisDaVenda,
} from "@/lib/admin/regras/pdv"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { RadarAoVivo } from "../entrega/atualizando"
import { ComandaMesa } from "../mesas/comanda-mesa"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { ItemEntrando } from "../movimento/entrada-admin"
import { type AvisoCaixa, linhaQueMudou } from "../pdv/caixa-pdv"
import { CatalogoBalcao } from "../pdv/catalogo-balcao"
import { JanelaOpcoes } from "../pdv/janela-opcoes"
import { Traco } from "../traco"

/** Item da bandeja: o que a tela mostra e as escolhas que vão para o servidor. */
type ItemBandeja = Omit<ItemVenda, "chave"> & { escolhas: Escolhas }

function Bandeja({
  itens,
  mesa,
  enviando,
  aviso,
  mudarQuantidade,
  remover,
  aoLancar,
}: {
  itens: (ItemBandeja & { chave: string })[]
  mesa: Mesa | null
  /** Qual lançamento espera o servidor; `null` se nenhum. */
  enviando: "cozinha" | "mesa" | null
  aviso: AvisoCaixa | null
  mudarQuantidade: (chave: string, quantidade: number) => void
  remover: (chave: string) => void
  aoLancar: (enviarParaCozinha: boolean) => void
}) {
  const semMovimento = useReducedMotion() ?? false
  const { quantidade, total } = totaisDaVenda(itens, { modo: "reais", valor: 0 })
  const bloqueado = !mesa || itens.length === 0 || enviando !== null
  return (
    <section aria-label="Bandeja" className="flex flex-col gap-4">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
        Rodada nova
        {mesa && <span>· Mesa {mesa.numero}</span>}
        {quantidade > 0 && (
          <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
            {plural(quantidade, "item", "itens")}
          </span>
        )}
      </h2>

      {/* O que o último toque fez, para quem usa leitor de tela. */}
      <p role="status" className="sr-only">
        {aviso?.texto}
      </p>

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-7 text-center text-[13px] text-balance text-muted-foreground">
          Toque nos produtos para montar a rodada.
        </p>
      ) : (
        <ul
          aria-label="Itens da bandeja"
          className="-mt-1 flex flex-col divide-y divide-border/70 border-b border-border/70"
        >
          <AnimatePresence initial={false}>
            {itens.map((item) => (
              // Toque repetido: o item novo entra sem esperar fila (posição 0) e sai só com o fade.
              <ItemEntrando
                key={item.chave}
                como="li"
                indice={0}
                aria-label={item.nome}
                layout={semMovimento ? false : "position"}
                className="relative flex items-start gap-2 py-2.5"
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
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">{item.nome}</span>
                  {item.opcoes.length > 0 && (
                    <span className="text-xs text-muted-foreground">{item.opcoes.join(" · ")}</span>
                  )}
                  {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {emReais(item.precoUnitario * item.quantidade)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="max-md:size-11"
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
                    className="max-md:size-11"
                    aria-label="Mais um"
                    onClick={() => mudarQuantidade(item.chave, item.quantidade + 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </ItemEntrando>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total da rodada</span>
        <NumberFlow
          value={total}
          locales="pt-BR"
          format={formatoMoeda}
          className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
        />
      </div>
      {!mesa && <p className="-mt-2 text-sm text-muted-foreground">Escolha a mesa.</p>}
      {/* A ação mais comum por cima, inteira; a de bebida pronta logo abaixo. */}
      <div className="flex flex-col gap-2">
        <BotaoCarregando
          type="button"
          size="lg"
          className="h-11 text-[15px]"
          carregando={enviando === "cozinha"}
          rotuloCarregando="Enviando a rodada"
          disabled={bloqueado}
          onClick={() => aoLancar(true)}
        >
          <ChefHatIcon data-icon="inline-start" />
          Enviar para a cozinha
        </BotaoCarregando>
        <BotaoCarregando
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          carregando={enviando === "mesa"}
          rotuloCarregando="Lançando na mesa"
          disabled={bloqueado}
          onClick={() => aoLancar(false)}
        >
          <SendIcon data-icon="inline-start" />
          Lançar na mesa
        </BotaoCarregando>
      </div>
      <p className="text-xs text-muted-foreground">
        “Lançar na mesa” é para o que sai pronto, como bebidas; o preço é conferido pelo sistema.
      </p>
    </section>
  )
}

/** Comanda da mesa escolhida: quem está e quanto já deu. */
function ResumoDaComanda({
  mesa,
  pedidoId,
  aoVer,
}: {
  mesa: Mesa
  pedidoId: number
  aoVer: () => void
}) {
  const { data: comanda } = usePedido(pedidoId)
  if (!comanda) return null
  const itens = comanda.itens.reduce((soma, item) => soma + item.quantidade, 0)
  const estado = estadoDaMesa(mesa, comanda)
  return (
    <div className="flex items-center gap-3 text-sm">
      <Traco tom={estado.tom} />
      <span className="min-w-0 flex-1 truncate">
        {comanda.cliente.nome} · {plural(itens, "item", "itens")} · {emReais(comanda.total)}
      </span>
      <Button type="button" variant="outline" size="sm" className="max-md:h-11" onClick={aoVer}>
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
  const { data: mesasCarregadas, isFetching: sincronizando } = useMesas()
  const mesas = mesasCarregadas ?? []
  const lancar = useLancarNaMesa()
  const [mesaId, setMesaId] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  const [itens, setItens] = useState<(ItemBandeja & { chave: string })[]>([])
  const [aviso, setAviso] = useState<AvisoCaixa | null>(null)
  const [comOpcoes, setComOpcoes] = useState<Produto | null>(null)
  const [bandejaAberta, setBandejaAberta] = useState(false)
  const [vendoComanda, setVendoComanda] = useState(false)

  const mesa = mesas.find((item) => item.id === mesaId) ?? null
  const incluir = (item: ItemBandeja) => {
    const novos = adicionarItem<ItemBandeja & { chave: string }>(itens, item)
    setItens(novos)
    // A linha que entrou ou cresceu: acende na bandeja e é anunciada.
    const linha = linhaQueMudou(itens, novos)
    if (linha) {
      setAviso((atual) => ({
        chave: linha.chave,
        texto: `${linha.nome}: ${linha.quantidade} na bandeja`,
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
          setAviso(null)
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
      mesa={mesa}
      enviando={
        lancar.isPending ? (lancar.variables?.enviarParaCozinha ? "cozinha" : "mesa") : null
      }
      aviso={aviso}
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
    <div className="flex flex-1 flex-col gap-5 p-4 pb-24 md:p-6 lg:px-8 lg:pb-6">
      <CabecalhoPagina
        titulo="Garçom"
        resumo="Escolha a mesa, monte a rodada e lance na comanda."
        acoes={
          <RadarAoVivo
            ativo={Boolean(mesasCarregadas) && sincronizando}
            rotulo="Sincronizando as mesas"
          />
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-0">
        <div className="flex min-w-0 flex-col gap-5 lg:pr-6">
          <div className="flex flex-col gap-3 border-y border-border/70 py-4">
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
              <Field>
                <FieldLabel htmlFor="garcom-mesa">Mesa</FieldLabel>
                <Select value={mesaId ?? ""} onValueChange={setMesaId}>
                  <SelectTrigger
                    id="garcom-mesa"
                    aria-label="Mesa"
                    className="w-full data-[size=default]:max-md:h-11"
                  >
                    <SelectValue placeholder="Escolha a mesa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {mesas.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <Traco tom={estadoDaMesa(item, undefined).tom} />
                          Mesa {item.numero} ·{" "}
                          {item.status === "livre" ? "livre" : item.clienteNome}
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
                    className="max-md:h-11"
                    maxLength={60}
                    placeholder="Opcional"
                    value={cliente}
                    onChange={(evento) => setCliente(evento.target.value)}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="garcom-nome">Seu nome</FieldLabel>
                <Input
                  id="garcom-nome"
                  className="max-md:h-11"
                  autoComplete="name"
                  maxLength={40}
                  value={nome}
                  onChange={(evento) => definirNome(evento.target.value)}
                />
              </Field>
            </div>
            {mesa?.pedidoAtivoId && (
              <ResumoDaComanda
                mesa={mesa}
                pedidoId={mesa.pedidoAtivoId}
                aoVer={() => setVendoComanda(true)}
              />
            )}
          </div>

          <CatalogoBalcao quantidadeNa={quantidadeNa} aoTocar={tocarProduto} />
        </div>

        {telaGrande ? (
          // Bandeja plana, separada do catálogo por um fio; acompanha a rolagem.
          <aside className="lg:sticky lg:top-20 lg:border-l lg:border-border/70 lg:pl-6">
            {bandeja}
          </aside>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="fixed inset-x-4 bottom-4 z-20 h-12 justify-between rounded-xl px-4 shadow-lg"
              onClick={() => setBandejaAberta(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBasketIcon data-icon="inline-start" />
                Ver bandeja · {plural(quantidade, "item", "itens")}
              </span>
              <NumberFlow
                value={total}
                locales="pt-BR"
                format={formatoMoeda}
                className="font-semibold tabular-nums"
              />
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
