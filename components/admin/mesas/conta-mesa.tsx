"use client"

import { format } from "date-fns"
import { HandCoinsIcon, XIcon } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLoja } from "@/lib/admin/dados/consultas"
import {
  useDescontar,
  useEstornarPagamento,
  usePedirConta,
  useTirarCouvert,
  useTirarTaxa,
} from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, PagamentoConta, Pedido } from "@/lib/admin/dados/tipos"
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
import { Comprovante, PAPEL_80MM } from "./impressao-conta"
import { DescontoNaConta, MotivoConta } from "./motivo-conta"
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
  const [mudando, setMudando] = useState<"desconto" | "taxa" | "couvert" | null>(null)
  const [estornando, setEstornando] = useState<PagamentoConta | null>(null)
  const [comprovante, setComprovante] = useState<PagamentoConta | null>(null)
  const papel = useRef<HTMLDivElement>(null)
  const { data: loja } = useLoja()
  const imprimir = useReactToPrint({
    contentRef: papel,
    documentTitle: `Comprovante mesa ${mesa.numero}`,
    pageStyle: PAPEL_80MM,
    onAfterPrint: () => setComprovante(null),
  })
  // O comprovante escolhido entra no papel escondido e só então vai para a impressora.
  useEffect(() => {
    if (comprovante) imprimir()
  }, [comprovante, imprimir])
  const descontar = useDescontar()
  const tirarTaxa = useTirarTaxa()
  const tirarCouvert = useTirarCouvert()
  const estornar = useEstornarPagamento()
  const quem = autorDaAcao(por, pedido.mesa?.garcom)
  // Fecha a janela quando o servidor aceita; se recusar, avisa e a janela continua aberta.
  const comAviso = (sucesso: string, aoTerminar: () => void) => ({
    onSuccess: () => {
      toast.success(sucesso)
      aoTerminar()
    },
    onError: (erro: Error) => toast.error(erro.message),
  })
  const fecharMudanca = () => setMudando(null)

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
            >
              <Button type="button" size="xs" variant="ghost" onClick={() => setMudando("taxa")}>
                Tirar taxa
              </Button>
            </Linha>
          )}
          {pedido.couvert && !pedido.couvert.removido && (
            <Linha
              rotulo={`Couvert (${pessoas} × ${emReais(pedido.couvert.porPessoa)})`}
              valor={emReais(resumo.couvert)}
            >
              <Button type="button" size="xs" variant="ghost" onClick={() => setMudando("couvert")}>
                Tirar couvert
              </Button>
            </Linha>
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
              <li
                key={pagamento.id}
                aria-label={`${rotuloDoPagamento(pagamento)} ${emReais(pagamento.valor)}`}
                className="flex items-center gap-3"
              >
                <span className="flex-1">
                  {rotuloDoPagamento(pagamento)}
                  <span className="text-muted-foreground">
                    {" · "}
                    {format(new Date(pagamento.em), "HH:mm")}
                    {pagamento.troco ? ` · troco ${emReais(pagamento.troco)}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{emReais(pagamento.valor)}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setComprovante(pagamento)}
                >
                  Comprovante
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setEstornando(pagamento)}
                >
                  Estornar
                </Button>
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
          <Button type="button" variant="outline" onClick={() => setMudando("desconto")}>
            Desconto
          </Button>
        )}
        {comItens && (
          <Button type="button" variant="outline" className="text-destructive" onClick={aoCancelar}>
            <XIcon data-icon="inline-start" />
            Cancelar comanda
          </Button>
        )}
      </div>

      <div className="hidden">
        {comprovante && (
          <Comprovante
            pedido={pedido}
            mesa={mesa}
            loja={loja?.nome}
            pagamento={comprovante}
            ref={papel}
          />
        )}
      </div>
      <DescontoNaConta
        aberta={mudando === "desconto"}
        numero={mesa.numero}
        aoMudar={(aberta) => !aberta && fecharMudanca()}
        aoAplicar={(desconto) =>
          descontar.mutateAsync(
            { pedidoId: pedido.id, ...desconto, ...quem },
            comAviso("Desconto aplicado.", fecharMudanca),
          )
        }
      />
      <MotivoConta
        aberta={mudando === "taxa"}
        titulo="Tirar a taxa de serviço?"
        descricao="A taxa sai desta conta e fica no histórico, com o motivo."
        acao="Tirar taxa"
        aoMudar={(aberta) => !aberta && fecharMudanca()}
        aoConfirmar={(motivo) =>
          tirarTaxa.mutateAsync(
            { pedidoId: pedido.id, motivo, ...quem },
            comAviso("Taxa de serviço tirada.", fecharMudanca),
          )
        }
      />
      <MotivoConta
        aberta={mudando === "couvert"}
        titulo="Tirar o couvert?"
        descricao="O couvert sai desta conta e fica no histórico, com o motivo."
        acao="Tirar couvert"
        aoMudar={(aberta) => !aberta && fecharMudanca()}
        aoConfirmar={(motivo) =>
          tirarCouvert.mutateAsync(
            { pedidoId: pedido.id, motivo, ...quem },
            comAviso("Couvert tirado.", fecharMudanca),
          )
        }
      />
      <MotivoConta
        aberta={estornando !== null}
        titulo={
          estornando
            ? `Estornar ${rotuloDoPagamento(estornando)} de ${emReais(estornando.valor)}?`
            : ""
        }
        descricao="O pagamento sai da conta e o saldo volta. O estorno fica no histórico."
        acao="Estornar"
        aoMudar={(aberta) => !aberta && setEstornando(null)}
        aoConfirmar={(motivo) =>
          estornar.mutateAsync(
            { pedidoId: pedido.id, pagamentoId: estornando?.id ?? "", motivo, ...quem },
            comAviso("Pagamento estornado.", () => setEstornando(null)),
          )
        }
      />
    </>
  )
}
