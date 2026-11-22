"use client"

import NumberFlow from "@number-flow/react"
import { format } from "date-fns"
import {
  ArrowRightLeftIcon,
  CombineIcon,
  ConciergeBellIcon,
  GiftIcon,
  LockOpenIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SplitIcon,
  SprayCanIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { NumericFormat } from "react-number-format"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { manterToastClicavel } from "@/components/sacola/manter-toast-clicavel"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useLoja, usePedido } from "@/lib/admin/dados/consultas"
import {
  useAlterarQuantidade,
  useDarCortesia,
  useDesbloquearMesa,
  useFecharConta,
  useImprimirPreConta,
  useLiberarMesa,
  useMarcarLimpa,
  useMarcarServido,
  useReabrirConta,
  useRemoverItem,
  useSepararMesas,
  useUltimaConta,
} from "@/lib/admin/dados/consultas-mesas"
import type { ItemPedido, Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { itensPagos, resumoDaConta } from "@/lib/admin/regras/conta"
import { cozinhaJaPreparou } from "@/lib/admin/regras/cozinha"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { type EstadoMesa, estadoDaMesa } from "@/lib/admin/regras/mesas"
import { numerosEmTexto, porQueNaoTransfere } from "@/lib/admin/regras/movimentacoes"
import { emReais, formatoMoeda } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"
import { AbrirMesa } from "./abrir-mesa"
import { AdicionarItens, useLancarNaComanda } from "./adicionar-itens"
import { useAvisoComDesfazer } from "./aviso-desfazer"
import { CancelarComanda } from "./cancelar-comanda"
import { ContaMesa } from "./conta-mesa"
import { EditarItem } from "./editar-item"
import { ConfirmarExclusaoMesa } from "./excluir-mesa"
import { HistoricoComanda } from "./historico-comanda"
import { PAPEL_80MM, PreConta } from "./impressao-conta"
import { JuntarMesas } from "./juntar-mesas"
import { MotivoConta } from "./motivo-conta"
import { type ParteDaConta, ReceberConta } from "./receber-conta"
import { TirarItem } from "./tirar-item"
import { TransferirItens } from "./transferir-itens"
import { TransferirMesa } from "./transferir-mesa"

function ItemAvulso({ mesa, comanda }: { mesa: Mesa; comanda: Pedido }) {
  const [nome, setNome] = useState("")
  const [valor, setValor] = useState<number | undefined>()
  const naComanda = useLancarNaComanda(mesa, comanda)
  return (
    <form
      className="grid grid-cols-[1fr_7rem_auto] items-end gap-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!nome.trim() || !valor) return toast.error("Informe o nome e o valor do item.")
        naComanda.lancar(
          {
            enviarParaCozinha: false,
            itens: [{ avulso: { nome, preco: valor }, quantidade: 1 }],
          },
          () => {
            setNome("")
            setValor(undefined)
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
        disabled={naComanda.enviando}
      >
        <PlusIcon />
      </Button>
    </form>
  )
}

function Comanda({ mesa, pedido, aoFechar }: { mesa: Mesa; pedido: Pedido; aoFechar: () => void }) {
  const { data: loja } = useLoja()
  const alterar = useAlterarQuantidade()
  const remover = useRemoverItem()
  const liberar = useLiberarMesa()
  const [recebendo, setRecebendo] = useState<ParteDaConta | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const servir = useMarcarServido()
  const por = useGarcom((estado) => estado.nome)
  const [editando, setEditando] = useState<ItemPedido | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [cortesia, setCortesia] = useState<ItemPedido | null>(null)
  const darCortesia = useDarCortesia()
  const conta = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: conta,
    documentTitle: `Pré-conta mesa ${mesa.numero}`,
    pageStyle: PAPEL_80MM,
  })
  const preConta = useImprimirPreConta()
  const fecharConta = useFecharConta()
  const vazia = pedido.itens.length === 0
  // Com tudo na cozinha ou pago por item, não há o que transferir: o botão some.
  const temTransferivel = pedido.itens.some((item) => porQueNaoTransfere(pedido, item) === null)
  const aoErrar = (erro: Error) => toast.error(erro.message)
  // Quem assina no histórico: o nome do aparelho ou, sem ele, o garçom da comanda.
  const quem = autorDaAcao(por, pedido.mesa?.garcom)
  // Item que a cozinha já preparou: tirar ou diminuir pergunta o motivo antes.
  const [confirmando, setConfirmando] = useState<{
    item: ItemPedido
    /** "Menos um" tira 1; "Remover", o item todo. */
    quantidade?: number
    tirar: (motivo?: string) => Promise<unknown>
  } | null>(null)
  const comConfirmacao = (
    item: ItemPedido,
    tirar: (motivo?: string) => Promise<unknown>,
    quantidade?: number,
  ) =>
    cozinhaJaPreparou(pedido, item)
      ? setConfirmando({ item, tirar, ...(quantidade ? { quantidade } : {}) })
      : tirar().catch(() => {})
  const diminuir = (item: ItemPedido, motivo?: string) =>
    alterar.mutateAsync(
      {
        pedidoId: pedido.id,
        itemId: item.id,
        quantidade: item.quantidade - 1,
        ...(motivo ? { motivo } : {}),
        ...quem,
      },
      { onError: aoErrar },
    )
  const tirar = (item: ItemPedido, motivo?: string) =>
    remover.mutateAsync(
      { pedidoId: pedido.id, itemId: item.id, ...(motivo ? { motivo } : {}), ...quem },
      { onError: aoErrar },
    )
  const semMovimento = useReducedMotion()
  const estado = estadoDaMesa(mesa, pedido)
  const resumo = resumoDaConta(pedido)
  const pagos = itensPagos(pedido)
  const juntadas = (pedido.mesa?.juntadas ?? []).map((junta) => junta.numero)
  const [transferindo, setTransferindo] = useState(false)
  const [movendo, setMovendo] = useState<"transferir" | "juntar" | null>(null)
  const separar = useSepararMesas()
  const avisar = useAvisoComDesfazer()

  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border/70">
        <div className="flex items-center gap-3 pr-8">
          <SheetTitle className="text-lg">Mesa {mesa.numero}</SheetTitle>
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Traco tom={estado.tom} />
            {estado.rotulo}
          </span>
          {pedido.servirDesde && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={servir.isPending}
              onClick={() =>
                servir.mutate(
                  { pedidoId: pedido.id, ...quem },
                  {
                    onSuccess: () => toast.success(`Mesa ${mesa.numero} servida.`),
                    onError: aoErrar,
                  },
                )
              }
            >
              <ConciergeBellIcon data-icon="inline-start" />
              Marcar servido
            </Button>
          )}
        </div>
        <SheetDescription>
          {[
            pedido.cliente.nome,
            `desde ${format(new Date(pedido.criadoEm), "HH:mm")}`,
            pedido.mesa?.garcom ? `Garçom ${pedido.mesa.garcom}` : null,
            juntadas.length > 0
              ? `Junto com ${juntadas.length === 1 ? "a mesa" : "as mesas"} ${numerosEmTexto(juntadas)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </SheetDescription>
        {/* Transferir, juntar e separar também pela gaveta, como no menu ⋯ da grade. */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMovendo("transferir")}
          >
            <ArrowRightLeftIcon data-icon="inline-start" />
            Transferir mesa
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMovendo("juntar")}>
            <CombineIcon data-icon="inline-start" />
            Juntar mesas
          </Button>
          {juntadas.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={separar.isPending}
              onClick={() =>
                separar.mutate(
                  { pedidoId: pedido.id, ...quem },
                  {
                    onSuccess: ({ desfazer }) => avisar("Mesas separadas.", desfazer),
                    onError: aoErrar,
                  },
                )
              }
            >
              <SplitIcon data-icon="inline-start" />
              Separar
            </Button>
          )}
        </div>
      </SheetHeader>

      <Tabs defaultValue="itens" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="conta">Conta</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="itens" className="flex flex-col gap-5 overflow-y-auto p-4">
          {vazia ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-balance text-muted-foreground">
              A comanda está vazia. Adicione itens ou libere a mesa.
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
                      {item.observacao && (
                        <span className="text-xs italic">“{item.observacao}”</span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {emReais(item.precoUnitario)} cada ·{" "}
                        <span className={cn(item.cortesia && "line-through")}>
                          {emReais(item.total)}
                        </span>
                        {item.cortesia && (
                          <span className="font-medium text-foreground"> · Cortesia</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Depois que a cozinha preparou, só tirando (com motivo) e lançando de novo. */}
                      {!cozinhaJaPreparou(pedido, item) && (
                        <Button
                          type="button"
                          size="icon-sm"
                          className="max-md:size-10"
                          variant="ghost"
                          aria-label="Editar"
                          onClick={() => setEditando(item)}
                        >
                          <PencilIcon />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        className="max-md:size-10"
                        variant="outline"
                        aria-label="Menos um"
                        disabled={item.quantidade <= 1}
                        onClick={() => comConfirmacao(item, (motivo) => diminuir(item, motivo), 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium tabular-nums">
                        {item.quantidade}
                      </span>
                      {/* A cortesia e o pagamento por item valem para o que já estava. */}
                      {!item.cortesia && !pagos.has(item.id) && (
                        <Button
                          type="button"
                          size="icon-sm"
                          className="max-md:size-10"
                          variant="outline"
                          aria-label="Mais um"
                          disabled={item.quantidade >= 999 || cozinhaJaPreparou(pedido, item)}
                          onClick={() =>
                            alterar.mutate(
                              {
                                pedidoId: pedido.id,
                                itemId: item.id,
                                quantidade: item.quantidade + 1,
                                ...quem,
                              },
                              { onError: aoErrar },
                            )
                          }
                        >
                          <PlusIcon />
                        </Button>
                      )}
                      {!item.cortesia && (
                        <Button
                          type="button"
                          size="icon-sm"
                          className="max-md:size-10"
                          variant="ghost"
                          aria-label="Cortesia"
                          onClick={() => setCortesia(item)}
                        >
                          <GiftIcon />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        className="max-md:size-10"
                        variant="ghost"
                        aria-label="Remover"
                        onClick={() => comConfirmacao(item, (motivo) => tirar(item, motivo))}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAdicionando(true)}>
              <PlusIcon data-icon="inline-start" />
              Adicionar itens
            </Button>
            {temTransferivel && (
              <Button type="button" variant="outline" onClick={() => setTransferindo(true)}>
                <ArrowRightLeftIcon data-icon="inline-start" />
                Transferir itens
              </Button>
            )}
          </div>
          <ItemAvulso mesa={mesa} comanda={pedido} />
        </TabsContent>
        <TabsContent value="conta" className="flex flex-col gap-5 overflow-y-auto p-4">
          <ContaMesa
            mesa={mesa}
            pedido={pedido}
            aoCancelar={() => setCancelando(true)}
            aoReceber={setRecebendo}
          />
        </TabsContent>
        <TabsContent value="historico" className="flex flex-col gap-5 overflow-y-auto p-4">
          <HistoricoComanda pedido={pedido} />
        </TabsContent>
      </Tabs>

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
        {resumo.pago > 0 && (
          <div className="-mt-2 flex items-baseline justify-between text-sm text-muted-foreground">
            <span>Saldo</span>
            <span className="tabular-nums">{emReais(resumo.saldo)}</span>
          </div>
        )}
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
              onClick={() => {
                imprimir()
                // A pré-conta impressa é a mesa pedindo a conta (Q30).
                preConta.mutate({ pedidoId: pedido.id, ...quem }, { onError: aoErrar })
              }}
            >
              <PrinterIcon data-icon="inline-start" />
              Imprimir pré-conta
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            className="h-11 flex-1"
            disabled={vazia || fecharConta.isPending}
            onClick={() =>
              // Sem saldo (tudo em cortesia, ou reaberta sem mudança), não há o que receber.
              resumo.saldo > 0
                ? setRecebendo({})
                : fecharConta.mutate(
                    { pedidoId: pedido.id, ...quem },
                    {
                      onSuccess: () => {
                        toast.success(`Conta da mesa ${mesa.numero} fechada.`)
                        aoFechar()
                      },
                      onError: aoErrar,
                    },
                  )
            }
          >
            <ReceiptIcon data-icon="inline-start" />
            Fechar conta
          </Button>
        </div>
      </SheetFooter>

      <div className="hidden">
        <PreConta pedido={pedido} mesa={mesa} loja={loja?.nome} agora={new Date()} ref={conta} />
      </div>
      <TirarItem
        item={confirmando?.item ?? null}
        {...(confirmando?.quantidade ? { quantidade: confirmando.quantidade } : {})}
        aoMudar={(aberto) => !aberto && setConfirmando(null)}
        aoTirar={async (motivo) => {
          await confirmando?.tirar(motivo)
          setConfirmando(null)
        }}
      />
      <EditarItem pedido={pedido} item={editando} aoFechar={() => setEditando(null)} />
      <MotivoConta
        aberta={cortesia !== null}
        titulo={`Cortesia: ${cortesia?.nome ?? ""}`}
        descricao="O item fica na comanda, sem cobrar. Ele já foi consumido: o estoque não volta."
        acao="Dar cortesia"
        aoMudar={(aberta) => !aberta && setCortesia(null)}
        aoConfirmar={(motivo) =>
          darCortesia.mutateAsync(
            { pedidoId: pedido.id, itemId: cortesia?.id ?? "", motivo, ...quem },
            {
              onSuccess: () => {
                toast.success(`${cortesia?.nome} é cortesia.`)
                setCortesia(null)
              },
              onError: aoErrar,
            },
          )
        }
      />
      <CancelarComanda
        mesa={mesa}
        comanda={pedido}
        aberta={cancelando}
        aoMudar={setCancelando}
        aoCancelar={aoFechar}
      />
      <AdicionarItens mesa={mesa} comanda={pedido} aberta={adicionando} aoMudar={setAdicionando} />
      <TransferirItens
        mesa={mesa}
        comanda={pedido}
        aberta={transferindo}
        aoMudar={setTransferindo}
      />
      <TransferirMesa
        mesa={mesa}
        comanda={pedido}
        aberta={movendo === "transferir"}
        aoMudar={(aberta) => !aberta && setMovendo(null)}
        aoTransferir={aoFechar}
      />
      <JuntarMesas
        mesa={mesa}
        comanda={pedido}
        aberta={movendo === "juntar"}
        aoMudar={(aberta) => !aberta && setMovendo(null)}
      />
      <ReceberConta
        mesa={mesa}
        pedido={pedido}
        parte={recebendo}
        aoMudar={(aberta) => !aberta && setRecebendo(null)}
        aoReceber={(fechou) => {
          setRecebendo(null)
          // A conta fechou: a mesa saiu de uso e a gaveta fecha junto.
          if (fechou) aoFechar()
        }}
      />
    </>
  )
}

/** A última conta da mesa, fechada hoje, pode ser reaberta com motivo (Q37). */
function ReabrirConta({ mesa }: { mesa: Mesa }) {
  const { data: conta } = useUltimaConta(mesa.id)
  const [aberta, setAberta] = useState(false)
  const reabrir = useReabrirConta()
  const por = useGarcom((estado) => estado.nome)
  if (!conta?.pagoEm) return null
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 pb-4">
      <p>
        Conta de {emReais(conta.total)} fechada às {format(new Date(conta.pagoEm), "HH:mm")}.
      </p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setAberta(true)}
      >
        <RotateCcwIcon data-icon="inline-start" />
        Reabrir a conta
      </Button>
      <MotivoConta
        aberta={aberta}
        titulo={`Reabrir a conta da mesa ${mesa.numero}?`}
        descricao="A comanda volta aberta, com os pagamentos feitos, e a mesa volta a ficar ocupada."
        acao="Reabrir"
        aoMudar={setAberta}
        aoConfirmar={(motivo) =>
          reabrir.mutateAsync(
            { pedidoId: conta.id, motivo, ...autorDaAcao(por, conta.mesa?.garcom) },
            {
              onSuccess: () => {
                toast.success(`Conta da mesa ${mesa.numero} reaberta.`)
                setAberta(false)
              },
              onError: (erro) => toast.error(erro.message),
            },
          )
        }
      />
    </div>
  )
}

/** O meio da gaveta sem comanda: o que destrava a mesa, ou o convite ao Garçom. */
function AcaoSemComanda({ mesa, estado }: { mesa: Mesa; estado: EstadoMesa }) {
  const desbloquear = useDesbloquearMesa()
  const marcarLimpa = useMarcarLimpa()
  const avisar = useAvisoComDesfazer()
  const aoErrar = (erro: Error) => toast.error(erro.message)
  if (estado === "bloqueada") {
    return (
      <>
        <p>{mesa.bloqueio?.motivo || "Sem motivo"}</p>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={desbloquear.isPending}
          onClick={() =>
            desbloquear.mutate(mesa.id, {
              onSuccess: () => toast.success(`Mesa ${mesa.numero} desbloqueada.`),
              onError: aoErrar,
            })
          }
        >
          <LockOpenIcon data-icon="inline-start" />
          Desbloquear
        </Button>
      </>
    )
  }
  if (estado === "limpeza") {
    return (
      <>
        <ReabrirConta mesa={mesa} />
        <p>A mesa volta a ficar livre quando alguém a limpar.</p>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={marcarLimpa.isPending}
          onClick={() =>
            marcarLimpa.mutate(mesa.id, {
              onSuccess: ({ desfazer }) => avisar(`Mesa ${mesa.numero} limpa.`, desfazer),
              onError: aoErrar,
            })
          }
        >
          <SprayCanIcon data-icon="inline-start" />
          Marcar limpa
        </Button>
        {/* Quem chega antes da limpeza também senta: abrir tira a mesa da limpeza. */}
        <div className="mt-3 border-t border-border/70 pt-4">
          <AbrirMesa mesa={mesa} />
        </div>
      </>
    )
  }
  return (
    <>
      <ReabrirConta mesa={mesa} />
      <AbrirMesa mesa={mesa} />
    </>
  )
}

function MesaSemComanda({ mesa, aoFechar }: { mesa: Mesa; aoFechar: () => void }) {
  const [excluindo, setExcluindo] = useState(false)
  const estado = estadoDaMesa(mesa, undefined)
  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border/70">
        <SheetTitle className="text-lg">Mesa {mesa.numero}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5">
          <Traco tom={estado.tom} />
          {estado.estado === "livre" ? "Mesa livre." : `${estado.rotulo}.`}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-3 p-4 text-sm text-muted-foreground">
        <AcaoSemComanda mesa={mesa} estado={estado.estado} />
      </div>
      <SheetFooter className="border-t border-border/70">
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          onClick={() => setExcluindo(true)}
        >
          <Trash2Icon data-icon="inline-start" />
          Excluir mesa
        </Button>
        <ConfirmarExclusaoMesa
          mesa={mesa}
          aberta={excluindo}
          aoMudar={setExcluindo}
          aoExcluir={aoFechar}
        />
      </SheetFooter>
    </>
  )
}

function ConteudoComanda({ mesa, aoFechar }: { mesa: Mesa; aoFechar: () => void }) {
  const { data: pedido } = usePedido(mesa.pedidoAtivoId ?? null)
  if (!mesa.pedidoAtivoId) return <MesaSemComanda mesa={mesa} aoFechar={aoFechar} />
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

/** Painel da mesa: a comanda aberta, ou as ações da mesa sem comanda. */
export function ComandaMesa({ mesa, aoFechar }: { mesa: Mesa | null; aoFechar: () => void }) {
  const telaGrande = useTelaGrande()
  return (
    <Sheet open={mesa !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent
        // O "Desfazer" do aviso fica por cima: clicar nele não fecha a gaveta.
        onPointerDownOutside={manterToastClicavel}
        onInteractOutside={manterToastClicavel}
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:max-h-[92dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-lg data-[side=right]:xl:max-w-xl"
      >
        {mesa && <ConteudoComanda key={mesa.id} mesa={mesa} aoFechar={aoFechar} />}
      </SheetContent>
    </Sheet>
  )
}
