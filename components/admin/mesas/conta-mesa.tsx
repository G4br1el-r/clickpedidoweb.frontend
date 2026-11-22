"use client"

import { format } from "date-fns"
import { HandCoinsIcon, XIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePedirConta } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import {
  dividirIgualmente,
  itensPagos,
  resumoDaConta,
  valorDosItens,
} from "@/lib/admin/regras/conta"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { rotuloDoPagamento } from "@/lib/admin/regras/rotulos"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { ParteDaConta } from "./receber-conta"

function Linha({
  rotulo,
  valor,
  forte = false,
  children,
}: {
  rotulo: string
  valor: string
  forte?: boolean
  /** Ação no fim da linha (tirar taxa, tirar couvert). */
  children?: ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-3", forte && "font-semibold")}>
      <dt className={cn("flex-1", !forte && "text-muted-foreground")}>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
      {children}
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `conta-${titulo.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 border-t border-border/70 pt-4">
      <h3 id={id} className="text-[13px] font-medium text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Partes iguais do total; a última leva o centavo que sobra. */
function DividirIgualmente({
  pedido,
  aoReceber,
}: {
  pedido: Pedido
  aoReceber: (parte: ParteDaConta) => void
}) {
  const [partes, setPartes] = useState(Math.min(Math.max(pedido.mesa?.pessoas ?? 2, 2), 20))
  const valida = Number.isInteger(partes) && partes >= 2 && partes <= 20
  return (
    <Secao titulo="Dividir igualmente">
      <div className="flex items-center gap-3">
        <Label htmlFor="conta-partes">Partes</Label>
        <Input
          id="conta-partes"
          type="number"
          inputMode="numeric"
          min={2}
          max={20}
          className="w-20"
          value={Number.isNaN(partes) ? "" : partes}
          onChange={(evento) => setPartes(evento.target.valueAsNumber)}
        />
      </div>
      {valida && (
        <ul className="flex flex-wrap gap-2">
          {dividirIgualmente(resumoDaConta(pedido).total, partes).map((valor, indice) => (
            // As partes não mudam de lugar: a posição é a identidade de cada uma.
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista só cresce ou encolhe no fim
            <li key={indice}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => aoReceber({ valor })}
              >
                Receber {emReais(valor)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  )
}

/** Os itens ainda não pagos e sem cortesia, para marcar e receber com a taxa deles. */
function PorItem({
  pedido,
  aoReceber,
}: {
  pedido: Pedido
  aoReceber: (parte: ParteDaConta) => void
}) {
  const [marcados, setMarcados] = useState<string[]>([])
  const pagos = itensPagos(pedido)
  const livres = pedido.itens.filter((item) => !item.cortesia && !pagos.has(item.id))
  const escolhidos = marcados.filter((id) => livres.some((item) => item.id === id))
  const valor = valorDosItens(pedido, escolhidos)
  return (
    <Secao titulo="Por item">
      <ul className="flex flex-col gap-2">
        {livres.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`conta-item-${item.id}`}
              checked={escolhidos.includes(item.id)}
              onCheckedChange={(marcado) =>
                setMarcados((atuais) =>
                  marcado ? [...atuais, item.id] : atuais.filter((id) => id !== item.id),
                )
              }
            />
            <Label htmlFor={`conta-item-${item.id}`} className="flex-1 font-normal">
              {item.quantidade}× {item.nome}
            </Label>
            <span className="tabular-nums text-muted-foreground">{emReais(item.total)}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={escolhidos.length === 0}
        onClick={() => {
          aoReceber({ itens: escolhidos })
          setMarcados([])
        }}
      >
        Receber {emReais(valor)}
      </Button>
    </Secao>
  )
}

/** Aba Conta: o resumo, os pagamentos, dividir, por item e as ações sobre a comanda. */
export function ContaMesa({
  mesa,
  pedido,
  aoCancelar,
  aoReceber,
}: {
  mesa: Mesa
  pedido: Pedido
  aoCancelar: () => void
  aoReceber: (parte: ParteDaConta) => void
}) {
  const resumo = resumoDaConta(pedido)
  const quantidade = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)
  const pedirConta = usePedirConta()
  const por = useGarcom((estado) => estado.nome)
  const pagamentos = pedido.pagamentos ?? []
  const pessoas = pedido.mesa?.pessoas ?? 1
  const comItens = pedido.itens.length > 0

  return (
    <>
      <section aria-label="Resumo da conta">
        <dl className="flex flex-col gap-2 text-sm">
          <Linha
            rotulo="Itens"
            valor={`${plural(quantidade, "item", "itens")} · ${emReais(resumo.itens)}`}
          />
          {resumo.cortesias > 0 && (
            <Linha rotulo="Cortesias" valor={`− ${emReais(resumo.cortesias)}`} />
          )}
          {resumo.descontos > 0 && (
            <Linha rotulo="Desconto" valor={`− ${emReais(resumo.descontos)}`} />
          )}
          {pedido.taxaServico && !pedido.taxaServico.removida && (
            <Linha
              rotulo={`Taxa de serviço (${pedido.taxaServico.percentual.toLocaleString("pt-BR")}%)`}
              valor={emReais(resumo.taxa)}
            />
          )}
          {pedido.couvert && !pedido.couvert.removido && (
            <Linha
              rotulo={`Couvert (${pessoas} × ${emReais(pedido.couvert.porPessoa)})`}
              valor={emReais(resumo.couvert)}
            />
          )}
          <Linha rotulo="Total" valor={emReais(resumo.total)} forte />
          {resumo.pago > 0 && <Linha rotulo="Pago" valor={emReais(resumo.pago)} />}
          <Linha rotulo="Saldo" valor={emReais(resumo.saldo)} forte />
        </dl>
      </section>

      {pagamentos.length > 0 && (
        <Secao titulo="Pagamentos">
          <ul aria-label="Pagamentos" className="flex flex-col gap-2 text-sm">
            {pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="flex items-center justify-between gap-3">
                <span>
                  {rotuloDoPagamento(pagamento)}
                  <span className="text-muted-foreground">
                    {" · "}
                    {format(new Date(pagamento.em), "HH:mm")}
                    {pagamento.troco ? ` · troco ${emReais(pagamento.troco)}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{emReais(pagamento.valor)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {comItens && resumo.saldo > 0 && (
        <>
          <DividirIgualmente pedido={pedido} aoReceber={aoReceber} />
          <PorItem pedido={pedido} aoReceber={aoReceber} />
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
        {pedido.contaPedidaEm ? (
          <p className="w-full text-sm text-muted-foreground">
            Pediu a conta às {format(new Date(pedido.contaPedidaEm), "HH:mm")}.
          </p>
        ) : (
          // A comanda vazia ainda não tem conta para pedir.
          comItens && (
            <Button
              type="button"
              variant="outline"
              disabled={pedirConta.isPending}
              onClick={() =>
                pedirConta.mutate(
                  { pedidoId: pedido.id, ...autorDaAcao(por, pedido.mesa?.garcom) },
                  {
                    onSuccess: () => toast.success(`Mesa ${mesa.numero} pediu a conta.`),
                    onError: (erro) => toast.error(erro.message),
                  },
                )
              }
            >
              <HandCoinsIcon data-icon="inline-start" />
              Pediu a conta
            </Button>
          )
        )}
        {comItens && (
          <Button type="button" variant="outline" className="text-destructive" onClick={aoCancelar}>
            <XIcon data-icon="inline-start" />
            Cancelar comanda
          </Button>
        )}
      </div>
    </>
  )
}
