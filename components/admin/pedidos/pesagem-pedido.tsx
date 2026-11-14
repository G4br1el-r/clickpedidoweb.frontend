"use client"

import { format } from "date-fns"
import { ScaleIcon, SendIcon } from "lucide-react"
import { useId, useState } from "react"
import { NumericFormat } from "react-number-format"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useRegistrarPesagem } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { linkWhatsApp } from "@/lib/admin/regras/mensagens"
import { calcularPesagem, itensParaPesar, mensagemLinkPagamento } from "@/lib/admin/regras/pesagem"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

const gramas = (valor: number) =>
  valor >= 1000 ? `${(valor / 1000).toLocaleString("pt-BR")} kg` : `${valor} g`

/** Tenta a conta com os pesos digitados; sem todos os pesos, ainda não há prévia. */
function previa(pedido: Pedido, pesos: Record<string, number | undefined>) {
  try {
    return calcularPesagem(
      { ...pedido, situacaoPagamento: "pendente" },
      pesos as Record<string, number>,
    )
  } catch {
    return null
  }
}

/**
 * Açougue: o peso da balança de cada item vendido por quilo. Mostra o valor real, o
 * novo total e a diferença; depois de pesar, manda o link de pagamento quando o cliente
 * paga após a pesagem.
 */
export function PesagemPedido({ pedido, loja }: { pedido: Pedido; loja: string }) {
  const titulo = useId()
  const registrar = useRegistrarPesagem()
  const itens = itensParaPesar(pedido)
  const [pesos, setPesos] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(itens.map((item) => [item.id, item.pesoReal])),
  )
  if (itens.length === 0) return null

  const pago = pedido.situacaoPagamento === "pago"
  const conta = previa(pedido, pesos)
  const valorDe = (id: string) => conta?.itens.find((item) => item.id === id)?.total
  const origem = typeof window === "undefined" ? "" : window.location.origin

  return (
    <section aria-labelledby={titulo} className="flex flex-col gap-3 rounded-xl border p-3">
      <h3 id={titulo} className="flex items-center gap-1.5 text-sm font-semibold">
        <ScaleIcon className="size-4" aria-hidden="true" />
        Pesagem
        {pedido.pesagem && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Pesado às {format(new Date(pedido.pesagem.pesadoEm), "HH:mm")}
          </span>
        )}
      </h3>
      <ul className="flex flex-col gap-3">
        {itens.map((item) => {
          const real = valorDe(item.id)
          return (
            <li key={item.id} className="flex flex-wrap items-end gap-x-3 gap-y-1 text-sm">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{item.nome}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Pedido: {item.quantidade > 1 ? `${item.quantidade} × ` : ""}
                  {gramas(item.pesoGramas as number)} · {emReais(item.precoKg as number)}/kg ·
                  estimado {emReais(item.totalEstimado ?? item.total)}
                </span>
              </div>
              {/* A unidade fica fora do valor: colar "1200" funciona como digitar. */}
              <InputGroup className="h-8 w-28">
                <NumericFormat
                  customInput={InputGroupInput}
                  aria-label={`Peso de ${item.nome}`}
                  inputMode="numeric"
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={0}
                  allowNegative={false}
                  placeholder="Peso"
                  disabled={pago}
                  className="text-right tabular-nums"
                  value={pesos[item.id] ?? ""}
                  onValueChange={({ floatValue }) =>
                    setPesos((atuais) => ({ ...atuais, [item.id]: floatValue }))
                  }
                />
                <InputGroupAddon align="inline-end">g</InputGroupAddon>
              </InputGroup>
              <span className="w-20 text-right tabular-nums">
                {real !== undefined ? emReais(real) : "—"}
              </span>
            </li>
          )
        })}
      </ul>

      {conta && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t pt-2 text-sm tabular-nums">
          <span className="text-muted-foreground">Estimado {emReais(conta.totalEstimado)}</span>
          <span className="font-medium">Novo total {emReais(conta.novoTotal)}</span>
          <span
            className={cn(
              "font-medium",
              conta.diferenca > 0 && "text-amber-700 dark:text-amber-400",
              conta.diferenca < 0 && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            Diferença:{" "}
            {conta.diferenca === 0
              ? "nenhuma"
              : `${conta.diferenca > 0 ? "+" : "−"} ${emReais(Math.abs(conta.diferenca))}`}
          </span>
        </div>
      )}

      {pago ? (
        <p className="text-sm text-muted-foreground">Pedido pago: a pesagem não muda o valor.</p>
      ) : (
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={!conta || registrar.isPending}
          onClick={() =>
            registrar.mutate(
              { id: pedido.id, pesos: pesos as Record<string, number> },
              {
                onSuccess: () => toast.success("Pesagem registrada."),
                onError: (erro) => toast.error(erro.message),
              },
            )
          }
        >
          Registrar pesagem
        </Button>
      )}

      {pedido.pagamento === "pagar-apos-pesagem" && pedido.pesagem && !pago && (
        <Button asChild variant="outline" size="sm" className="self-start">
          <a
            href={linkWhatsApp(
              pedido.cliente.telefone,
              mensagemLinkPagamento(pedido, { loja, endereco: origem }),
            )}
            target="_blank"
            rel="noreferrer"
          >
            <SendIcon data-icon="inline-start" />
            Enviar link de pagamento
          </a>
        </Button>
      )}
    </section>
  )
}
