"use client"

import { differenceInMinutes, format, parseISO } from "date-fns"
import {
  CheckIcon,
  FileHeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { farmaceuticaResponsavel, receitasDemo } from "@/lib/mock/admin/farmacia"
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

function CartaoReceita({
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

  return (
    <Card className="gap-3">
      <article aria-label={`Receita de ${receita.paciente.nome}`} className="contents">
        <CardHeader className="gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{receita.paciente.nome}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {haQuanto(receita.recebidaEm, agora)}
            </span>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              <IconeCanal data-icon="inline-start" />
              {canal.rotulo}
            </Badge>
            {receita.pedidoNumero && (
              <Badge variant="outline">Pedido #{receita.pedidoNumero}</Badge>
            )}
            <SeloReceita tipo={receita.tipo} />
            <span className="text-xs">Papel: {info.papel}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Prescritor</dt>
              <dd>
                {nome} · {conselho} {numero}/{uf}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Emitida em {data(receita.emitidaEm)}
              </dt>
              <dd>
                <Validade receita={receita} agora={agora} />
              </dd>
            </div>
          </dl>

          <ul className="divide-y rounded-lg border">
            {receita.itens.map((item) => {
              const produto = produtos.find((candidato) => candidato.id === item.produtoId)
              return (
                <li key={item.produtoId} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      <span className="text-muted-foreground tabular-nums">
                        {item.quantidade}×{" "}
                      </span>
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
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Confira antes de separar</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {pendencias.map((pendencia) => (
                    <li key={pendencia}>{pendencia}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {decisao ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {decisao.situacao === "aprovada" ? (
                <span className="flex items-center gap-2">
                  <Badge>
                    <CheckIcon data-icon="inline-start" />
                    Aprovada
                  </Badge>
                  {decisao.retida && (
                    <span className="text-xs text-muted-foreground">Via retida na farmácia</span>
                  )}
                </span>
              ) : (
                <Badge variant="destructive">Recusada: {decisao.motivo}</Badge>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => desfazer(receita.id)}>
                <Undo2Icon data-icon="inline-start" />
                Desfazer
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {info.retencao ? (
                <div className="flex items-center gap-2">
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
                  onClick={() => setRecusando(true)}
                >
                  <XIcon data-icon="inline-start" />
                  Recusar
                </Button>
                <Button
                  type="button"
                  size="sm"
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
        </CardContent>
      </article>
      {recusando && <JanelaRecusar receita={receita} aoFechar={() => setRecusando(false)} />}
    </Card>
  )
}

type Aba = "aguardando" | "aprovadas" | "recusadas"

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "aguardando", rotulo: "Aguardando" },
  { id: "aprovadas", rotulo: "Aprovadas" },
  { id: "recusadas", rotulo: "Recusadas" },
]

/** Farmácia: o farmacêutico confere cada receita que chega antes de o pedido ser separado. */
export function PaginaReceitas() {
  const agora = useAgora()
  const { data: produtos } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  const [aba, setAba] = useState<Aba>("aguardando")

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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receitas</h1>
          <p className="text-sm text-muted-foreground">
            Confira cada receita antes de separar o pedido. Controlados e antibióticos só saem com a
            via retida.
          </p>
        </div>
        <Badge variant="outline" className="h-auto gap-1.5 py-1">
          <ShieldCheckIcon data-icon="inline-start" />
          Responsável técnica: {farmaceuticaResponsavel.nome} · {farmaceuticaResponsavel.crf}
        </Badge>
      </div>

      {!agora || !produtos ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {comPendencia > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
              {comPendencia === 1
                ? "1 receita aguardando tem pendência."
                : `${comPendencia} receitas aguardando têm pendência.`}
            </p>
          )}
          <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="gap-4">
            <TabsList>
              {ABAS.map(({ id, rotulo }) => (
                // O cinza do shadcn não alcança 4,5:1 sobre o fundo das cores do segmento.
                <TabsTrigger
                  key={id}
                  value={id}
                  className="text-muted-foreground! data-active:text-foreground!"
                >
                  {rotulo} <Badge variant="secondary">{grupos[id].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {ABAS.map(({ id }) => (
              <TabsContent key={id} value={id}>
                {grupos[id].length === 0 ? (
                  <Empty className="border border-dashed">
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
                  <div className="grid gap-4 xl:grid-cols-2">
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
        </>
      )}
    </div>
  )
}
