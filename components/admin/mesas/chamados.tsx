"use client"

import { BellRingIcon, CheckIcon, QrCodeIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  useAceitarPedidoQr,
  useAtenderChamado,
  useRecusarPedidoQr,
} from "@/lib/admin/dados/consultas-mesas"
import type { Chamado, ConfigSalao, Mesa, PedidoQr } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasFila, useSomDoAparelho } from "@/lib/admin/preferencias-fila"
import { tempoDesde } from "@/lib/admin/regras/alertas-mesa"
import { chamadosAbertos, textoDoChamado } from "@/lib/admin/regras/chamados"
import { normalizar } from "@/lib/admin/regras/filtro-pedidos"
import { FUNCOES_PRO_SALAO } from "@/lib/admin/regras/salao"
import { tocarAlerta } from "@/lib/admin/som"
import { emReais } from "@/lib/formato"
import { SeloPro } from "../campos"

/** Toca o alerta quando chega um chamado ou pedido que a tela ainda não tinha visto. */
function useSomDosChamados(ids: string[] | null) {
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const tipoSom = useSomDoAparelho()
  const conhecidos = useRef<Set<string> | null>(null)
  const chave = ids?.join(",") ?? null
  useEffect(() => {
    if (chave === null) return
    const atuais = chave ? chave.split(",") : []
    const novos = conhecidos.current ? atuais.filter((id) => !conhecidos.current?.has(id)) : []
    conhecidos.current = new Set(atuais)
    if (novos.length > 0 && somLigado) tocarAlerta(tipoSom)
  }, [chave, somLigado, tipoSom])
}

/** A explicação do QR para quem ainda não tem a função Pro, como a do mapa. */
function QrPro({
  aberta,
  aoMudar,
  aoConfigurar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoConfigurar: () => void
}) {
  const { preco } = FUNCOES_PRO_SALAO.qr
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <SeloPro liberada={false} className="w-fit" />
          <DialogTitle>QR na mesa é Pro</DialogTitle>
          <DialogDescription>
            O cliente lê o QR da mesa, pede pelo celular, chama o garçom e pede a conta; os pedidos
            e chamados chegam aqui com som. {emReais(preco)} por mês no plano Pro. Ligue em
            Configurar salão, em Funções Pro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => aoMudar(false)}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              aoMudar(false)
              aoConfigurar()
            }}
          >
            Abrir Configurar salão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * O botão "Chamados" do topo de Mesas, com o contador do que espera alguém (chamados abertos e
 * pedidos pelo QR), e a lista com Atender, Aceitar e Recusar. Com o QR desligado, o cadeado Pro.
 */
export function ChamadosSalao({
  mesas,
  salao,
  chamados,
  pedidos,
  agora,
  aoConfigurar,
  rodape,
}: {
  mesas: Mesa[]
  salao: ConfigSalao
  chamados: Chamado[] | undefined
  pedidos: PedidoQr[] | undefined
  agora: Date | null
  aoConfigurar: () => void
  /** O que fica no pé da lista (a folha de QR). */
  rodape?: React.ReactNode
}) {
  const [aberta, setAberta] = useState(false)
  const [proAberta, setProAberta] = useState(false)
  const atender = useAtenderChamado()
  const aceitar = useAceitarPedidoQr()
  const recusar = useRecusarPedidoQr()
  const por = useGarcom((atual) => atual.nome).trim()
  // O que é de uma mesa que não existe mais (outra aba excluiu) fica de fora.
  const existe = (mesaId: string) => mesas.some((mesa) => mesa.id === mesaId)
  const abertos = chamadosAbertos(chamados ?? []).filter((chamado) => existe(chamado.mesaId))
  const aguardando = pedidos?.filter((pedido) => existe(pedido.mesaId))
  const total = abertos.length + (aguardando?.length ?? 0)
  useSomDosChamados(
    chamados && pedidos
      ? [...abertos.map((chamado) => chamado.id), ...(aguardando ?? []).map((pedido) => pedido.id)]
      : null,
  )

  const cadeado = !salao.funcoes.qr && (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="QR na mesa Pro"
        onClick={() => setProAberta(true)}
      >
        <QrCodeIcon data-icon="inline-start" />
        QR na mesa
        <SeloPro liberada={false} />
      </Button>
      <QrPro aberta={proAberta} aoMudar={setProAberta} aoConfigurar={aoConfigurar} />
    </>
  )
  // QR desligado e nada esperando: só o cadeado (a lista aberta fica até fechar).
  if (cadeado && total === 0 && !aberta) return cadeado

  const numero = (mesaId: string) => mesas.find((mesa) => mesa.id === mesaId)?.numero
  const ha = (momento: string) => (agora ? ` · há ${tempoDesde(momento, agora)}` : "")
  const aoErrar = (erro: Error) => toast.error(erro.message)
  // O garçom do aparelho, se estiver na lista do salão: ele abre a mesa livre ao aceitar.
  const garcom = salao.garcons.find(
    (item) => item.ativo && normalizar(item.nome) === normalizar(por),
  )?.nome
  const fila = [
    ...(aguardando ?? []).map((pedido) => ({
      tipo: "pedido" as const,
      em: pedido.criadoEm,
      pedido,
    })),
    ...abertos.map((chamado) => ({ tipo: "chamado" as const, em: chamado.criadoEm, chamado })),
  ].toSorted((a, b) => Date.parse(a.em) - Date.parse(b.em))

  return (
    <>
      {cadeado}
      <Button
        type="button"
        size="sm"
        variant={total > 0 ? "default" : "outline"}
        onClick={() => setAberta(true)}
      >
        <BellRingIcon data-icon="inline-start" />
        {/* O nome lido começa pelo que se vê ("Chamados 1") e termina em "esperando". */}
        Chamados{" "}
        <span className="rounded-full bg-background/20 px-1.5 text-xs tabular-nums">{total}</span>{" "}
        <span className="sr-only">esperando</span>
      </Button>
      <Sheet open={aberta} onOpenChange={setAberta}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Chamados</SheetTitle>
            <SheetDescription>
              Pedidos pelo QR e mesas que chamaram, do mais antigo.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
            {fila.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum chamado agora.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70">
                {fila.map((item) => {
                  if (item.tipo === "chamado") {
                    const { chamado } = item
                    const mesa = numero(chamado.mesaId)
                    return (
                      <li
                        key={chamado.id}
                        aria-label={`Mesa ${mesa}`}
                        className="flex items-center gap-3 py-3"
                      >
                        <span className="flex min-w-0 flex-1 flex-col text-sm">
                          <span className="font-semibold">Mesa {mesa}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {textoDoChamado(chamado.tipo)}
                            {ha(chamado.criadoEm)}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          aria-label={`Atender a mesa ${mesa}`}
                          disabled={atender.isPending}
                          onClick={() => atender.mutate(chamado.id, { onError: aoErrar })}
                        >
                          <CheckIcon data-icon="inline-start" />
                          Atender
                        </Button>
                      </li>
                    )
                  }
                  const { pedido } = item
                  const mesa = numero(pedido.mesaId)
                  return (
                    <li
                      key={pedido.id}
                      aria-label={`Mesa ${mesa}`}
                      className="flex flex-col gap-2 py-3 text-sm"
                    >
                      <span className="flex flex-col">
                        <span className="font-semibold">Mesa {mesa}</span>
                        <span className="text-muted-foreground tabular-nums">
                          Pedido pelo QR{ha(pedido.criadoEm)}
                        </span>
                      </span>
                      <ul className="flex flex-col gap-0.5">
                        {pedido.resumo.map((linha, indice) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: o resumo não muda depois de pedido
                          <li key={indice} className="flex justify-between gap-2">
                            <span>
                              {linha.quantidade}× {linha.nome}
                              {linha.opcoes.length > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  {linha.opcoes.join(" · ")}
                                </span>
                              )}
                              {linha.observacao && (
                                <span className="block text-xs italic">“{linha.observacao}”</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">{emReais(pedido.total)}</span>
                        <span className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Recusar o pedido da mesa ${mesa}`}
                            disabled={recusar.isPending}
                            onClick={() => recusar.mutate(pedido.id, { onError: aoErrar })}
                          >
                            <XIcon data-icon="inline-start" />
                            Recusar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            aria-label={`Aceitar o pedido da mesa ${mesa}`}
                            disabled={aceitar.isPending}
                            onClick={() =>
                              aceitar.mutate(
                                {
                                  id: pedido.id,
                                  ...(garcom ? { garcom } : {}),
                                  ...(por ? { por } : {}),
                                },
                                {
                                  onSuccess: () => toast.success(`Pedido da mesa ${mesa} aceito.`),
                                  onError: aoErrar,
                                },
                              )
                            }
                          >
                            <CheckIcon data-icon="inline-start" />
                            Aceitar
                          </Button>
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {rodape && salao.funcoes.qr && <SheetFooter>{rodape}</SheetFooter>}
        </SheetContent>
      </Sheet>
    </>
  )
}
