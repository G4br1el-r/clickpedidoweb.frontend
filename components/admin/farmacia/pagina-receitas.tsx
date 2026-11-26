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
import { AnimatePresence } from "motion/react"
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
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto, Receita } from "@/lib/admin/dados/tipos"
import { type DecisaoReceita, useFarmacia } from "@/lib/admin/farmacia-estado"
import {
  conferirReceita,
  INFO_RECEITA,
  saidasDaReceita,
  situacaoDaReceita,
} from "@/lib/admin/regras/farmacia"
import {
  notaDasReceitas,
  planoDeAprovacao,
  retidaNaAprovacao,
  textoDaDecisao,
  textoDasReceitas,
} from "@/lib/admin/regras/lote-farmacia"
import { alternarMarca } from "@/lib/admin/regras/selecao"
import { plural } from "@/lib/formato"
import { farmaceuticaResponsavel, receitasDemo } from "@/lib/mock/admin/farmacia"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { BarraEmLote } from "../estoque/barra-em-lote"
import { FioDeAtualizacao } from "../estoque/fio-de-atualizacao"
import { FaixaRolavel } from "../faixa-rolavel"
import { BlocoEntrando, ItemEntrando } from "../movimento/entrada-admin"
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

/** Recusa uma receita ou várias de uma vez, com o mesmo motivo para todas. */
function JanelaRecusar({
  receitas,
  aoFechar,
  aoRecusar,
}: {
  receitas: Receita[]
  aoFechar: () => void
  /** Chamada depois de recusar, para limpar a seleção de quem usa em lote. */
  aoRecusar?: () => void
}) {
  const recusar = useFarmacia((estado) => estado.recusar)
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0])
  const unica = receitas.length === 1 ? receitas[0] : null
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {unica
              ? `Recusar a receita de ${unica.paciente.nome}?`
              : `Recusar ${plural(receitas.length, "receita", "receitas")}?`}
          </DialogTitle>
          <DialogDescription>
            {unica
              ? "O cliente recebe o motivo e pode enviar outra receita pelo mesmo pedido."
              : "Cada cliente recebe o motivo e pode enviar outra receita pelo mesmo pedido."}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={motivo} onValueChange={setMotivo} aria-label="Motivo">
          {MOTIVOS.map((opcao) => (
            <Label
              key={opcao}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 font-normal md:min-h-0"
            >
              <RadioGroupItem value={opcao} />
              {opcao}
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" className="max-md:h-11" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="max-md:h-11"
            onClick={() => {
              for (const receita of receitas) recusar(receita.id, motivo)
              toast(
                unica
                  ? `Receita de ${unica.paciente.nome} recusada`
                  : textoDaDecisao("recusada", receitas.length),
              )
              aoRecusar?.()
              aoFechar()
            }}
          >
            {unica ? "Recusar receita" : "Recusar receitas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CartaoReceita({
  receita,
  produtos,
  agora,
  decisao,
  indice,
  marcada,
  aoMarcar,
}: {
  receita: Receita
  produtos: Produto[]
  agora: Date
  decisao?: DecisaoReceita
  indice: number
  /** Só a receita que aguarda conferência pode ser marcada para a ação em lote. */
  marcada?: boolean
  aoMarcar?: () => void
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
    <ItemEntrando
      como="article"
      indice={indice}
      aria-label={`Receita de ${receita.paciente.nome}`}
      aria-describedby={idTitulo}
      className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-border/80"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {aoMarcar && (
            <span className="flex size-11 shrink-0 items-center justify-center max-md:-my-2.5 max-md:-ml-2.5 md:size-6">
              <Checkbox
                aria-label={`Selecionar a receita de ${receita.paciente.nome}`}
                checked={marcada}
                onCheckedChange={aoMarcar}
              />
            </span>
          )}
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
      {recusando && <JanelaRecusar receitas={[receita]} aoFechar={() => setRecusando(false)} />}
    </ItemEntrando>
  )
}

/** O formato do cartão de receita: nome, selo, prescritor, itens e os botões. */
function EsqueletoReceitas() {
  return (
    <div
      role="status"
      aria-label="Carregando as receitas"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-8 w-80 max-w-full" />
      <div className="grid gap-3 xl:grid-cols-2">
        {[0, 1].map((indice) => (
          <div
            key={indice}
            data-testid="esqueleto-cartao-receita"
            className="esqueleto-entra flex flex-col gap-4 rounded-xl border border-border/70 p-4"
            style={{ animationDelay: `${indice * 0.06}s` }}
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
            <div className="flex flex-col gap-2 border-y border-border/70 py-3">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
            <div className="flex justify-end gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
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
  const { data: produtos, isFetching } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  const aprovar = useFarmacia((estado) => estado.aprovar)
  const [aba, setAba] = useState<Aba>("aguardando")
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set())
  const [confirmouVia, setConfirmouVia] = useState(false)
  const [recusandoLote, setRecusandoLote] = useState(false)

  const receitas = agora ? receitasDemo(agora) : []
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

  // Só vale quem ainda aguarda: a receita decidida some da fila e da seleção.
  const marcadas = grupos.aguardando.filter((receita) => selecionadas.has(receita.id))
  const plano =
    agora && produtos
      ? planoDeAprovacao(marcadas, produtos, agora)
      : { aprovaveis: [], comPendencia: [], comRetencao: 0 }

  function limparSelecao() {
    setSelecionadas(new Set())
    setConfirmouVia(false)
  }

  function aprovarLote() {
    if (!produtos) return
    const quando = new Date().toISOString()
    let comSaida = 0
    for (const receita of plano.aprovaveis) {
      aprovar(receita.id, { retida: retidaNaAprovacao(receita, confirmouVia) })
      if (saidasDaReceita(receita, produtos, quando).length > 0) comSaida += 1
    }
    toast.success(textoDaDecisao("aprovada", plano.aprovaveis.length), {
      description:
        comSaida > 0
          ? "Saídas lançadas na escrituração dos controlados."
          : "Pode separar os pedidos.",
    })
    limparSelecao()
  }

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
        <EsqueletoReceitas />
      ) : (
        <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <FaixaRolavel className="-mx-4 max-w-[calc(100%+2rem)] px-4 md:mx-0 md:max-w-full md:px-0">
              <TabsList className="max-md:h-11!">
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
            </FaixaRolavel>
            {comPendencia > 0 && (
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <Traco tom="cancelado" />
                {comPendencia === 1
                  ? "1 receita aguardando tem pendência."
                  : `${comPendencia} receitas aguardando têm pendência.`}
              </p>
            )}
          </div>

          <FioDeAtualizacao ativo={isFetching} rotulo="Atualizando as receitas" />

          {ABAS.map(({ id }) => (
            <TabsContent key={id} value={id}>
              {grupos[id].length === 0 ? (
                <BlocoEntrando>
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
                </BlocoEntrando>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  <AnimatePresence>
                    {grupos[id].map((receita, indice) => (
                      <CartaoReceita
                        key={receita.id}
                        indice={indice}
                        receita={receita}
                        produtos={produtos}
                        agora={agora}
                        decisao={decisoes[receita.id]}
                        marcada={id === "aguardando" ? selecionadas.has(receita.id) : undefined}
                        aoMarcar={
                          id === "aguardando"
                            ? () => setSelecionadas((atual) => alternarMarca(atual, receita.id))
                            : undefined
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <BarraEmLote
        aberta={aba === "aguardando" && marcadas.length > 0}
        texto={textoDasReceitas(marcadas.length)}
        nota={notaDasReceitas(plano.comPendencia.length)}
        aoLimpar={limparSelecao}
      >
        {plano.comRetencao > 0 && (
          <Label className="flex min-h-11 w-full items-center gap-2 text-[13px] font-normal md:min-h-0">
            <Checkbox
              checked={confirmouVia}
              onCheckedChange={(marcado) => setConfirmouVia(marcado === true)}
            />
            {plano.comRetencao === 1
              ? "Retive a via da receita que exige"
              : `Retive a via das ${plano.comRetencao} receitas que exigem`}
          </Label>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-md:h-11"
          onClick={() => setRecusandoLote(true)}
        >
          <XIcon data-icon="inline-start" />
          Recusar {plural(marcadas.length, "receita", "receitas")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="max-md:h-11"
          disabled={plano.aprovaveis.length === 0 || (plano.comRetencao > 0 && !confirmouVia)}
          onClick={aprovarLote}
        >
          <ShieldCheckIcon data-icon="inline-start" />
          Aprovar {plural(plano.aprovaveis.length, "receita", "receitas")}
        </Button>
      </BarraEmLote>

      {recusandoLote && (
        <JanelaRecusar
          receitas={marcadas}
          aoFechar={() => setRecusandoLote(false)}
          aoRecusar={limparSelecao}
        />
      )}
    </div>
  )
}
