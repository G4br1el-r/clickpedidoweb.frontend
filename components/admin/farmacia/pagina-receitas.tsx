"use client"

import { differenceInMinutes, format, parseISO } from "date-fns"
import {
  FileHeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgora } from "@/hooks/use-agora"
import { usePedidos } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto, Receita } from "@/lib/admin/dados/tipos"
import { type DecisaoReceita, useFarmacia } from "@/lib/admin/farmacia-estado"
import {
  conferirReceita,
  INFO_RECEITA,
  receitaDoPedido,
  saidasDaReceita,
  situacaoDaReceita,
} from "@/lib/admin/regras/farmacia"
import {
  farmaceuticaResponsavel,
  receitaDoPedidoDemo,
  receitasDemo,
} from "@/lib/mock/admin/farmacia"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { Traco } from "../traco"
import { SeloReceita, SeloTarja } from "./selos"

const CANAIS: Record<Receita["canal"], { rotulo: string; icone: typeof StoreIcon }> = {
  site: { rotulo: "Site", icone: FileHeartIcon },
  whatsapp: { rotulo: "WhatsApp", icone: MessageCircleIcon },
  balcao: { rotulo: "Balcão", icone: StoreIcon },
}

const MOTIVOS = [
  "Receita vencida",
  "Receituário não serve para o medicamento",
  "Dados do prescritor incompletos",
  "Receita ilegível ou rasurada",
] as const

const data = (texto: string) => format(parseISO(texto), "dd/MM/yyyy")

function haQuanto(recebidaEm: string, agora: Date) {
  const minutos = Math.max(differenceInMinutes(agora, parseISO(recebidaEm)), 0)
  return minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`
}

function Validade({ receita, agora }: { receita: Receita; agora: Date }) {
  const situacao = situacaoDaReceita(receita.tipo, receita.emitidaEm, agora)
  if (situacao.estado === "sem-prazo") {
    return <span className="text-muted-foreground">Sem prazo fixo: critério do farmacêutico</span>
  }
  if (situacao.estado === "vencida") {
    return (
      <span className="font-medium text-destructive">Vencida em {data(situacao.validaAte)}</span>
    )
  }
  return <span>Válida até {data(situacao.validaAte)}</span>
}

function JanelaRecusar({ receita, aoFechar }: { receita: Receita; aoFechar: () => void }) {
  const recusar = useFarmacia((estado) => estado.recusar)
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0])
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recusar a receita de {receita.paciente.nome}?</DialogTitle>
          <DialogDescription>
            O cliente recebe o motivo e pode enviar outra receita pelo mesmo pedido.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={motivo} onValueChange={setMotivo} aria-label="Motivo">
          {MOTIVOS.map((opcao) => (
            <Label key={opcao} className="flex cursor-pointer items-center gap-2.5 font-normal">
              <RadioGroupItem value={opcao} />
              {opcao}
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              recusar(receita.id, motivo)
              toast(`Receita de ${receita.paciente.nome} recusada`)
              aoFechar()
            }}
          >
            Recusar receita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A conferência de uma receita: o módulo Receitas e a fila (antes do aceite) usam o mesmo. */
export function CartaoReceita({
  receita,
  produtos,
  agora,
  decisao,
}: {
  receita: Receita
  produtos: Produto[]
  agora: Date
  decisao?: DecisaoReceita
}) {
  const aprovar = useFarmacia((estado) => estado.aprovar)
  const desfazer = useFarmacia((estado) => estado.desfazer)
  const [retida, setRetida] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const info = INFO_RECEITA[receita.tipo]
  const pendencias = conferirReceita(receita, produtos, agora)
  const canal = CANAIS[receita.canal]
  const IconeCanal = canal.icone
  const { conselho, numero, uf, nome } = receita.prescritor
  const podeAprovar = pendencias.length === 0 && (!info.retencao || retida)
  const idRetida = `retida-${receita.id}`
  const idTitulo = `receita-${receita.id}`

  return (
    <article
      aria-label={`Receita de ${receita.paciente.nome}`}
      aria-describedby={idTitulo}
      className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-border/80"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 id={idTitulo} className="text-[15px] font-semibold tracking-[-0.01em]">
            {receita.paciente.nome}
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {haQuanto(receita.recebidaEm, agora)}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconeCanal className="size-3.5" aria-hidden="true" />
            {canal.rotulo}
            {receita.pedidoNumero && (
              <span className="tabular-nums">· Pedido #{receita.pedidoNumero}</span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SeloReceita tipo={receita.tipo} />
          <span className="text-xs text-muted-foreground">Papel: {info.papel}</span>
        </div>
      </header>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Prescritor</dt>
          <dd>
            {nome} · {conselho} {numero}/{uf}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Emitida em {data(receita.emitidaEm)}</dt>
          <dd>
            <Validade receita={receita} agora={agora} />
          </dd>
        </div>
      </dl>

      <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
        {receita.itens.map((item) => {
          const produto = produtos.find((candidato) => candidato.id === item.produtoId)
          return (
            <li key={item.produtoId} className="flex flex-col gap-1 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  <span className="text-muted-foreground tabular-nums">{item.quantidade}× </span>
                  <span>{produto?.nome ?? "Produto removido"}</span>
                </span>
                {produto?.medicamento && <SeloTarja tarja={produto.medicamento.tarja} />}
              </div>
              {item.posologia && (
                <span className="text-xs text-muted-foreground">{item.posologia}</span>
              )}
            </li>
          )
        })}
      </ul>

      {!decisao && pendencias.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <Traco tom="cancelado" className="h-3" />
            Confira antes de separar
          </p>
          <div className="flex flex-col gap-1 pl-[11px]">
            <ul className="flex flex-col gap-0.5 text-[13px] text-foreground">
              {pendencias.map((pendencia) => (
                <li key={pendencia}>{pendencia}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {decisao ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {decisao.situacao === "aprovada" ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                <Traco tom="pronto" />
                Aprovada
              </span>
              {decisao.retida && (
                <span className="text-xs text-muted-foreground">Via retida na farmácia</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-[13px] font-medium">
              <Traco tom="cancelado" />
              Recusada: {decisao.motivo}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-md:h-11"
            onClick={() => desfazer(receita.id)}
          >
            <Undo2Icon data-icon="inline-start" />
            Desfazer
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {info.retencao ? (
            <div className="flex min-h-11 items-center gap-2 md:min-h-0">
              <Checkbox
                id={idRetida}
                checked={retida}
                onCheckedChange={(marcado) => setRetida(marcado === true)}
                disabled={pendencias.length > 0}
              />
              <Label htmlFor={idRetida} className="font-normal">
                Via da receita retida na farmácia
              </Label>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Receita simples: devolva ao cliente carimbada.
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-md:h-11"
              onClick={() => setRecusando(true)}
            >
              <XIcon data-icon="inline-start" />
              Recusar
            </Button>
            <Button
              type="button"
              size="sm"
              className="active:scale-[0.97] max-md:h-11"
              disabled={!podeAprovar}
              onClick={() => {
                aprovar(receita.id, { retida })
                const lancadas = saidasDaReceita(receita, produtos, new Date().toISOString())
                toast.success(`Receita de ${receita.paciente.nome} aprovada`, {
                  description:
                    lancadas.length > 0
                      ? "Saída lançada na escrituração dos controlados."
                      : "Pode separar o pedido.",
                })
              }}
            >
              <ShieldCheckIcon data-icon="inline-start" />
              Aprovar
            </Button>
          </div>
        </div>
      )}
      {recusando && <JanelaRecusar receita={receita} aoFechar={() => setRecusando(false)} />}
    </article>
  )
}

type Aba = "aguardando" | "aprovadas" | "recusadas"

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "aguardando", rotulo: "Aguardando" },
  { id: "aprovadas", rotulo: "Aprovadas" },
  { id: "recusadas", rotulo: "Recusadas" },
]

const RESUMO =
  "Confira cada receita antes de separar o pedido. Controlados e antibióticos só saem com a via retida."

/** Farmácia: o farmacêutico confere cada receita que chega antes de o pedido ser separado. */
export function PaginaReceitas() {
  const agora = useAgora()
  const { data: produtos } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  const [aba, setAba] = useState<Aba>("aguardando")

  const { data: pedidos = [] } = usePedidos()
  // As receitas que chegaram com pedidos do site: a que espera o aceite e as já conferidas.
  const dosPedidos = pedidos.flatMap((pedido) => {
    const tipo = produtos ? receitaDoPedido(pedido, produtos) : null
    if (!tipo || !produtos) return []
    const receita = receitaDoPedidoDemo(pedido, produtos, tipo)
    return pedido.esperaAceite || decisoes[receita.id] ? [receita] : []
  })
  const receitas = agora ? [...dosPedidos, ...receitasDemo(agora)] : []
  const grupos: Record<Aba, Receita[]> = {
    aguardando: receitas.filter((receita) => !decisoes[receita.id]),
    aprovadas: receitas.filter((receita) => decisoes[receita.id]?.situacao === "aprovada"),
    recusadas: receitas.filter((receita) => decisoes[receita.id]?.situacao === "recusada"),
  }
  const comPendencia =
    agora && produtos
      ? grupos.aguardando.filter((receita) => conferirReceita(receita, produtos, agora).length > 0)
          .length
      : 0

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Receitas"
        resumo={RESUMO}
        acoes={
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <ShieldCheckIcon className="size-4" aria-hidden="true" />
            Responsável técnica: {farmaceuticaResponsavel.nome} · {farmaceuticaResponsavel.crf}
          </span>
        }
      />

      {!agora || !produtos ? (
        <div role="status" aria-label="Carregando as receitas" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-80 max-w-full" />
          <div className="grid gap-3 xl:grid-cols-2">
            {["a", "b"].map((chave) => (
              <Skeleton key={chave} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <TabsList>
              {ABAS.map(({ id, rotulo }) => (
                // O cinza do shadcn não alcança 4,5:1 sobre o fundo das cores do segmento.
                <TabsTrigger
                  key={id}
                  value={id}
                  className="px-2.5 text-muted-foreground! data-active:text-foreground!"
                >
                  {rotulo}{" "}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {grupos[id].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {comPendencia > 0 && (
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <Traco tom="cancelado" />
                {comPendencia === 1
                  ? "1 receita aguardando tem pendência."
                  : `${comPendencia} receitas aguardando têm pendência.`}
              </p>
            )}
          </div>

          {ABAS.map(({ id }) => (
            <TabsContent key={id} value={id}>
              {grupos[id].length === 0 ? (
                <Empty className="rounded-2xl border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileHeartIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma receita aqui</EmptyTitle>
                    <EmptyDescription>
                      {id === "aguardando"
                        ? "Tudo conferido. As novas receitas do site e do WhatsApp aparecem aqui."
                        : "As receitas que você decidir aparecem aqui."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {grupos[id].map((receita) => (
                    <CartaoReceita
                      key={receita.id}
                      receita={receita}
                      produtos={produtos}
                      agora={agora}
                      decisao={decisoes[receita.id]}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
