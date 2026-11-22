"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BikeIcon, MapPinIcon, MessageCircleIcon, PhoneIcon, PrinterIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import {
  useAtribuirMotoboy,
  useAvancarPedido,
  useCancelarPedido,
  useLoja,
  useMarcarPago,
  useMotoboys,
  usePedido,
} from "@/lib/admin/dados/consultas"
import type { MotivoCancelamento, Pedido } from "@/lib/admin/dados/tipos"
import {
  enderecoEmTexto,
  formatarTelefone,
  linkDoMapa,
  linkWhatsApp,
  mensagemParaCliente,
  mensagemParaMotoboy,
} from "@/lib/admin/regras/mensagens"
import { faltaPesar } from "@/lib/admin/regras/pesagem"
import {
  MOTIVOS_CANCELAMENTO,
  rotuloCanal,
  rotuloMotivo,
  rotuloPagamento,
} from "@/lib/admin/regras/rotulos"
import { etapasDoCaminho, rotuloAcao, rotuloStatus, tomDoStatus } from "@/lib/admin/regras/status"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { emReais } from "@/lib/formato"
import { descricaoDoTroco } from "@/lib/pedido"
import { cn } from "@/lib/utils"
import { AcoesAgendamento } from "../agendamentos/acoes-agendamento"
import { useImpressaoDePedidos } from "../impressao/impressao-de-pedidos"
import { usePedidoAberto } from "./estado-lista"
import { PesagemPedido } from "./pesagem-pedido"
import { rotuloSituacao, SeloStatus } from "./selos"

const dataEHora = (iso: string) => format(new Date(iso), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 py-5 first:pt-4">
      <h3 className="text-[13px] font-medium text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * Caminho do pedido: uma haste por etapa, no tom dela, acesa até onde o pedido chegou.
 * Ao avançar, a próxima haste acende (a cor entra em 300 ms). Cancelado apaga o caminho.
 */
function CaminhoPedido({ pedido }: { pedido: Pedido }) {
  const etapas = etapasDoCaminho(pedido.tipo)
  const cancelado = pedido.status === "cancelado"
  const atual = cancelado ? -1 : etapas.indexOf(pedido.status)
  return (
    <ol
      aria-label="Caminho do pedido"
      className="grid gap-1.5 pt-2"
      style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}
    >
      {etapas.map((etapa, indice) => {
        const feita = atual >= 0 && indice < atual
        const agora = indice === atual
        return (
          <li
            key={etapa}
            aria-current={agora ? "step" : undefined}
            data-feita={feita ? "" : undefined}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <span
              aria-hidden="true"
              className="h-[3px] rounded-full bg-foreground/10 transition-colors duration-300 ease-saida"
              style={
                feita || agora ? { backgroundColor: `var(--tom-${tomDoStatus(etapa)})` } : undefined
              }
            />
            <span
              className={cn(
                "text-[11px] leading-tight",
                agora ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {rotuloStatus(pedido.tipo, etapa)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Linha({
  rotulo,
  valor,
  forte = false,
}: {
  rotulo: string
  valor: string
  forte?: boolean
}) {
  return (
    <div
      className={
        forte ? "flex justify-between font-semibold" : "flex justify-between text-muted-foreground"
      }
    >
      <span>{rotulo}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  )
}

/** Avisos de sucesso e erro das ações, no padrão do projeto (Sonner). */
const aviso = {
  onSuccess: (pedido: Pedido) =>
    toast.success(`Pedido #${pedido.numero}: ${rotuloStatus(pedido.tipo, pedido.status)}`),
  onError: (erro: Error) => toast.error(erro.message),
}

function Conteudo({ pedido }: { pedido: Pedido }) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: loja } = useLoja()
  const { data: motoboys = [] } = useMotoboys()
  const avancar = useAvancarPedido()
  const cancelar = useCancelarPedido()
  const pagar = useMarcarPago()
  const atribuir = useAtribuirMotoboy()
  const impressao = useImpressaoDePedidos()

  const acao = rotuloAcao(pedido.tipo, pedido.status)
  const encerrado = pedido.status === "concluido" || pedido.status === "cancelado"
  const nomeLoja = loja?.nome ?? ""
  const origem = typeof window === "undefined" ? "" : window.location.origin
  const motoboy = motoboys.find((item) => item.id === pedido.motoboyId)
  const comMotoboy = pedido.tipo === "entrega" && temModulo(segmento, "motoboys")

  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border/70">
        <div className="flex items-center gap-2 pr-8">
          <SheetTitle className="text-lg">Pedido #{pedido.numero}</SheetTitle>
          <SeloStatus pedido={pedido} />
        </div>
        <SheetDescription className="first-letter:uppercase">
          {rotuloCanal(pedido.tipo)} · {dataEHora(pedido.criadoEm)}
        </SheetDescription>
        <CaminhoPedido pedido={pedido} />
        {pedido.status === "cancelado" && (
          <p className="text-sm text-muted-foreground">
            Motivo:{" "}
            {[rotuloMotivo(pedido.motivoCancelamento), pedido.detalheCancelamento]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => impressao.imprimir(pedido)}
          >
            <PrinterIcon data-icon="inline-start" />
            {pedido.impressoEm ? "Reimprimir cupom" : "Imprimir cupom"}
          </Button>
          {pedido.impressoEm && (
            <span className="text-xs text-muted-foreground">
              Impresso às {format(new Date(pedido.impressoEm), "HH:mm")}
            </span>
          )}
        </div>
        {impressao.elemento}
      </SheetHeader>

      <div className="flex flex-1 flex-col divide-y divide-border/70 overflow-y-auto px-4 pb-2">
        <Bloco titulo="Itens">
          <ul className="flex flex-col gap-3">
            {pedido.itens.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <span className="w-6 shrink-0 font-medium tabular-nums">{item.quantidade}×</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{item.nome}</span>
                  {item.pesoGramas && (
                    <span className="text-xs text-muted-foreground">Peso: {item.pesoGramas} g</span>
                  )}
                  {item.opcoes.map((opcao) => (
                    <span key={opcao} className="text-xs text-muted-foreground">
                      {opcao}
                    </span>
                  ))}
                  {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                </div>
                <span className="shrink-0 tabular-nums">{emReais(item.total)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex flex-col gap-1 text-sm">
            <Linha rotulo="Subtotal" valor={emReais(pedido.subtotal)} />
            {pedido.desconto > 0 && (
              <Linha rotulo="Desconto" valor={`− ${emReais(pedido.desconto)}`} />
            )}
            {pedido.taxaEntrega > 0 && (
              <Linha rotulo="Entrega" valor={emReais(pedido.taxaEntrega)} />
            )}
            <Linha rotulo="Total" valor={emReais(pedido.total)} forte />
          </div>
          {pedido.observacao && (
            <p className="rounded-lg bg-foreground/[0.05] px-3 py-2 text-sm">
              Obs.: {pedido.observacao}
            </p>
          )}
        </Bloco>

        <PesagemPedido key={pedido.id} pedido={pedido} loja={nomeLoja} />

        <Bloco titulo="Cliente">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">{pedido.cliente.nome}</span>
            <a
              href={`tel:${pedido.cliente.telefone}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums hover:underline"
            >
              <PhoneIcon className="size-3.5" aria-hidden="true" />
              {formatarTelefone(pedido.cliente.telefone)}
            </a>
          </div>
          {pedido.endereco && (
            <div className="flex flex-col gap-1 text-sm">
              <span>{enderecoEmTexto(pedido.endereco)}</span>
              {pedido.endereco.referencia && (
                <span className="text-muted-foreground">Ref.: {pedido.endereco.referencia}</span>
              )}
            </div>
          )}
          {pedido.mesa && (
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium">Mesa {pedido.mesa.numero}</span>
              {pedido.mesa.garcom && (
                <span className="text-muted-foreground">Garçom: {pedido.mesa.garcom}</span>
              )}
            </div>
          )}
          {pedido.agendamento && (
            <>
              <p className="text-sm font-medium first-letter:uppercase">
                Marcado para {dataEHora(pedido.agendamento.inicio)} ·{" "}
                {pedido.agendamento.duracaoMin} min
              </p>
              <AcoesAgendamento pedido={pedido} />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={linkWhatsApp(
                  pedido.cliente.telefone,
                  mensagemParaCliente(pedido, { loja: nomeLoja, endereco: origem }),
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                Avisar no WhatsApp
              </a>
            </Button>
            {pedido.endereco && (
              <Button asChild variant="outline" size="sm">
                <a href={linkDoMapa(pedido.endereco)} target="_blank" rel="noreferrer">
                  <MapPinIcon data-icon="inline-start" />
                  Abrir no mapa
                </a>
              </Button>
            )}
          </div>
        </Bloco>

        <Bloco titulo="Pagamento">
          <div className="flex flex-col gap-0.5 text-sm">
            <div className="flex justify-between">
              <span>{rotuloPagamento(pedido.pagamento)}</span>
              <span className="font-medium">{rotuloSituacao(pedido.situacaoPagamento)}</span>
            </div>
            {pedido.pagamento === "dinheiro" && (
              <span className="text-muted-foreground">
                {descricaoDoTroco(pedido.trocoPara, pedido.total)}
              </span>
            )}
            {pedido.pagoEm && (
              <span className="text-muted-foreground">
                Pago em {format(new Date(pedido.pagoEm), "dd/MM HH:mm")}
              </span>
            )}
          </div>
        </Bloco>

        {comMotoboy && (
          <Bloco titulo="Motoboy">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={pedido.motoboyId ?? ""}
                onValueChange={(motoboyId) =>
                  atribuir.mutate({ id: pedido.id, motoboyId }, { onError: aviso.onError })
                }
                disabled={encerrado}
              >
                <SelectTrigger aria-label="Motoboy" className="sm:w-48">
                  <SelectValue placeholder="Escolher motoboy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {motoboys
                      .filter((item) => item.ativo)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {motoboy && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={linkWhatsApp(
                      motoboy.telefone,
                      mensagemParaMotoboy(pedido, { loja: nomeLoja }),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BikeIcon data-icon="inline-start" />
                    Chamar {motoboy.nome}
                  </a>
                </Button>
              )}
            </div>
          </Bloco>
        )}
      </div>

      <SheetFooter className="border-t border-border/70 sm:flex-row sm:flex-wrap">
        {acao ? (
          <Button
            type="button"
            className="sm:flex-1"
            disabled={avancar.isPending}
            onClick={() => avancar.mutate({ id: pedido.id, de: pedido.status }, aviso)}
          >
            {acao}
          </Button>
        ) : (
          pedido.tipo === "mesa" &&
          pedido.status === "pronto" && (
            <p className="text-center text-sm text-muted-foreground sm:flex-1">
              A comanda fecha em Mesas
            </p>
          )
        )}
        {pedido.situacaoPagamento !== "pago" &&
          pedido.status !== "cancelado" &&
          (faltaPesar(pedido) ? (
            // Linha própria, abaixo dos botões: o aviso não aperta entre eles.
            <p className="order-last w-full text-center text-xs text-muted-foreground sm:basis-full">
              Pese o pedido antes de receber.
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                pagar.mutate(pedido.id, {
                  onSuccess: () => toast.success("Pagamento registrado."),
                  onError: aviso.onError,
                })
              }
            >
              Marcar como pago
            </Button>
          ))}
        {!encerrado && (
          <ConfirmarCancelamento
            numero={pedido.numero}
            aoConfirmar={(motivo) =>
              cancelar.mutate(
                { id: pedido.id, de: pedido.status, ...(motivo ? { motivo } : {}) },
                aviso,
              )
            }
          />
        )}
      </SheetFooter>
    </>
  )
}

/** Confirmação do cancelamento, com o motivo opcional para não travar quem tem pressa. */
function ConfirmarCancelamento({
  numero,
  aoConfirmar,
}: {
  numero: number
  aoConfirmar: (motivo: MotivoCancelamento | undefined) => void
}) {
  const [motivo, setMotivo] = useState<MotivoCancelamento | "">("")
  return (
    <AlertDialog onOpenChange={(aberto) => aberto || setMotivo("")}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="text-destructive">
          Cancelar pedido
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar o pedido #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido sai da fila e da cozinha. Se já estava pago, o pagamento continua registrado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <p id="motivo-cancelamento" className="text-sm font-medium">
            Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={2}
            aria-labelledby="motivo-cancelamento"
            value={motivo}
            onValueChange={(valor) => setMotivo(valor as MotivoCancelamento | "")}
            className="flex-wrap justify-start"
          >
            {MOTIVOS_CANCELAMENTO.map((item) => (
              <ToggleGroupItem key={item} value={item}>
                {rotuloMotivo(item)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => aoConfirmar(motivo || undefined)}>
            Sim, cancelar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Detalhes do pedido aberto (`?pedido=123`): painel lateral no computador e de baixo no
 * celular, sem sair da lista. Fechar ou voltar no navegador tira o pedido do endereço.
 */
export function DetalhesPedido() {
  const [id, setId] = usePedidoAberto()
  const telaGrande = useTelaGrande()
  const { data: pedido, isPending } = usePedido(id)

  return (
    <Sheet open={id !== null} onOpenChange={(aberto) => !aberto && setId(null)}>
      <SheetContent
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:max-h-[92dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {pedido ? (
          <Conteudo pedido={pedido} />
        ) : isPending ? (
          <SheetHeader>
            <SheetTitle className="sr-only">Carregando pedido</SheetTitle>
            <SheetDescription className="sr-only">Buscando os dados do pedido.</SheetDescription>
            <div role="status" aria-label="Carregando pedido" className="flex flex-col gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </SheetHeader>
        ) : (
          <SheetHeader>
            <SheetTitle>Pedido não encontrado</SheetTitle>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Não achamos este pedido</EmptyTitle>
                <EmptyDescription>
                  Ele pode ser de outro segmento ou já ter sido apagado.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}
