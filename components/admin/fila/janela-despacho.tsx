"use client"

import { MessageCircleIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Motoboy, Pedido } from "@/lib/admin/dados/tipos"
import { motoboySugerido, type SituacaoMotoboy } from "@/lib/admin/regras/despacho"
import { linkWhatsApp, mensagemDaRota } from "@/lib/admin/regras/mensagens"
import { emReais } from "@/lib/formato"

const SITUACAO: Record<SituacaoMotoboy["situacao"], string> = {
  disponivel: "disponível",
  "em-rota": "em rota",
  ausente: "ausente",
}

/**
 * Despachar: as entregas escolhidas (e, se quiser, as prontas do mesmo bairro) saem com um
 * motoboy, sugerido o livre há mais tempo. Depois, o botão chama o motoboy no WhatsApp com a
 * rota pronta: endereços, cobrança e troco.
 */
export function JanelaDespacho({
  pedidos,
  mesmoBairro,
  situacoes,
  comAlcool,
  nomeLoja,
  ocupado,
  aoDespachar,
  aoFechar,
}: {
  /** As entregas que a pessoa mandou despachar. */
  pedidos: Pedido[]
  /** Outras prontas do mesmo bairro, para levar junto. */
  mesmoBairro: Pedido[]
  situacoes: SituacaoMotoboy[]
  /** Adega: a entrega com bebida alcoólica pede documento (+18) na mensagem. */
  comAlcool: (pedido: Pedido) => boolean
  nomeLoja: string
  ocupado: boolean
  aoDespachar: (ids: number[], motoboyId: string) => Promise<Pedido[]>
  aoFechar: () => void
}) {
  const sugerido = motoboySugerido(situacoes)
  const [motoboyId, setMotoboyId] = useState(sugerido?.id ?? "")
  const [juntos, setJuntos] = useState<ReadonlySet<number>>(new Set())
  const [saiu, setSaiu] = useState<{ motoboy: Motoboy; pedidos: Pedido[] } | null>(null)
  const titulo =
    pedidos.length === 1
      ? `Despachar #${pedidos[0].numero}`
      : `Despachar ${pedidos.length} entregas`

  const despachar = async () => {
    const motoboy = situacoes.find((item) => item.motoboy.id === motoboyId)?.motoboy
    if (!motoboy) return
    const ids = [...pedidos.map((pedido) => pedido.id), ...juntos]
    const despachados = await aoDespachar(ids, motoboy.id)
    if (despachados.length > 0) setSaiu({ motoboy, pedidos: despachados })
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {saiu
              ? `Saiu com ${saiu.motoboy.nome}: ${saiu.pedidos.length === 1 ? "1 entrega" : `${saiu.pedidos.length} entregas`}.`
              : "Escolha quem leva. A rota vai pronta para o WhatsApp do motoboy."}
          </DialogDescription>
        </DialogHeader>

        {saiu ? (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Fechar
            </Button>
            <Button asChild>
              <a
                href={linkWhatsApp(
                  saiu.motoboy.telefone,
                  mensagemDaRota(saiu.pedidos, { loja: nomeLoja, maioridade: comAlcool }),
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                Chamar {saiu.motoboy.nome} no WhatsApp
              </a>
            </Button>
          </DialogFooter>
        ) : (
          <>
            <ul className="flex flex-col border-y border-border/70">
              {pedidos.map((pedido) => (
                <li key={pedido.id} className="flex items-baseline gap-2 py-2 text-sm">
                  <span className="font-semibold tabular-nums">#{pedido.numero}</span>
                  <span className="min-w-0 flex-1 truncate">{pedido.endereco?.bairro}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {emReais(pedido.total)}
                  </span>
                </li>
              ))}
            </ul>

            {mesmoBairro.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] text-muted-foreground">
                  Prontas do mesmo bairro, para levar junto
                </legend>
                {mesmoBairro.map((pedido) => {
                  const id = `junto-${pedido.id}`
                  return (
                    <div key={pedido.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={id}
                        checked={juntos.has(pedido.id)}
                        onCheckedChange={(marcado) =>
                          setJuntos((atuais) => {
                            const novos = new Set(atuais)
                            if (marcado) novos.add(pedido.id)
                            else novos.delete(pedido.id)
                            return novos
                          })
                        }
                      />
                      <Label htmlFor={id} className="cursor-pointer font-normal">
                        #{pedido.numero} · {pedido.cliente.nome}
                      </Label>
                    </div>
                  )
                })}
              </fieldset>
            )}

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-[13px] text-muted-foreground">Motoboy</legend>
              <RadioGroup value={motoboyId} onValueChange={setMotoboyId} className="gap-0">
                {situacoes.map((situacao) => {
                  const id = `motoboy-${situacao.motoboy.id}`
                  return (
                    <div
                      key={situacao.motoboy.id}
                      className="flex min-h-10 items-center gap-2 border-b border-border/70 last:border-b-0"
                    >
                      <RadioGroupItem
                        id={id}
                        value={situacao.motoboy.id}
                        aria-label={situacao.motoboy.nome}
                        disabled={situacao.situacao === "ausente"}
                      />
                      <Label htmlFor={id} className="flex-1 cursor-pointer gap-2 font-normal">
                        {situacao.motoboy.nome}
                        <span className="text-xs text-muted-foreground">
                          {SITUACAO[situacao.situacao]}
                          {situacao.situacao === "em-rota" && ` com ${situacao.emRota.length}`}
                        </span>
                      </Label>
                      {sugerido?.id === situacao.motoboy.id && (
                        <Badge variant="secondary">Sugerido</Badge>
                      )}
                    </div>
                  )
                })}
              </RadioGroup>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={aoFechar}>
                Cancelar
              </Button>
              <Button type="button" disabled={!motoboyId || ocupado} onClick={despachar}>
                Despachar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
