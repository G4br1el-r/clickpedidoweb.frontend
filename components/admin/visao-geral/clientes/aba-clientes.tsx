"use client"

import { format } from "date-fns"
import { MessageCircleIcon } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  clientesDos90Dias,
  mensagemDeVolta,
  reguaDeClientes,
  sumidos,
} from "@/lib/admin/regras/dashboard/clientes"
import { nomesDo } from "@/lib/admin/regras/dashboard/nomes"
import { linkWhatsApp } from "@/lib/admin/regras/mensagens"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const porcento = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

/**
 * Clientes: quem compra, quem volta e quem sumiu. Usa sempre os últimos 90 dias, sem ligar
 * para o período escolhido. O cliente é o telefone do pedido.
 */
export function AbaClientes({
  pedidos,
  agora,
  segmento,
  loja,
  linkDaLoja,
}: {
  /** Pedidos dos últimos 90 dias. */
  pedidos: Pedido[]
  agora: Date
  segmento: SegmentoPainelId
  loja: { nome: string; telefone: string }
  /** Endereço da vitrine, que vai na mensagem para o cliente sumido. */
  linkDaLoja: string
}) {
  const clientes = useMemo(
    () => clientesDos90Dias(pedidos, agora, loja.telefone),
    [pedidos, agora, loja.telefone],
  )
  const regua = useMemo(() => reguaDeClientes(clientes, agora), [clientes, agora])
  const sumiram = useMemo(() => sumidos(clientes, agora), [clientes, agora])
  const n = nomesDo(segmento)
  const melhores = clientes.slice(0, 10)
  const gastoTotal = clientes.reduce((soma, cliente) => soma + cliente.gasto, 0)
  const maior = melhores[0]?.gasto ?? 0

  return (
    <div className="flex flex-col gap-10">
      {/* O "Últimos 90 dias, até hoje" fica no lugar do filtro de período, acima. */}
      <Secao titulo="Clientes">
        <Regua>
          <Indicador rotulo="Clientes" detalhe="pelo telefone do pedido">
            <Numero valor={regua.unicos} />
          </Indicador>
          <Indicador rotulo="Novos" detalhe="primeiro pedido nos últimos 30 dias">
            <Numero valor={regua.novos} />
          </Indicador>
          <Indicador rotulo="Voltaram" detalhe="pediram 2 vezes ou mais">
            {`${porcento.format(regua.recorrentes)}%`}
          </Indicador>
          <Indicador rotulo="Pedidos por cliente">
            <Numero valor={regua.pedidosPorCliente} />
          </Indicador>
        </Regua>
      </Secao>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao titulo="Melhores clientes" descricao="Quem mais gastou">
          <ListaDeFatias
            vazio="Nenhum cliente nos últimos 90 dias."
            itens={melhores.map((cliente) => ({
              chave: cliente.telefone,
              nome: cliente.nome,
              pedidos: cliente.pedidos,
              total: cliente.gasto,
              percentual: gastoTotal ? (cliente.gasto / gastoTotal) * 100 : 0,
              barra: maior ? (cliente.gasto / maior) * 100 : 0,
              detalhe: `${plural(cliente.pedidos, n.pedido, n.pedidos)} · último em ${format(new Date(cliente.ultimo), "dd/MM")}`,
              href: `/admin/pedidos?cliente=${cliente.telefone}`,
            }))}
          />
        </Secao>

        <Secao titulo="Sumidos" descricao="2 ou mais vezes, sem voltar há 30 dias">
          {sumiram.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {`Ninguém sumiu: quem ${segmento === "salao" ? "agendou" : "pediu"} 2 vezes ou mais voltou nos últimos 30 dias.`}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
              {sumiram.slice(0, 10).map((cliente) => (
                <li key={cliente.telefone} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{cliente.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {`${plural(cliente.pedidos, n.pedido, n.pedidos)} · há ${cliente.dias} dias · ${emReais(cliente.gasto)}`}
                    </span>
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={linkWhatsApp(
                        cliente.telefone,
                        mensagemDeVolta({
                          nome: cliente.nome,
                          loja: loja.nome,
                          link: linkDaLoja,
                          segmento,
                        }),
                      )}
                      target="_blank"
                      rel="noopener"
                      aria-label={`Chamar ${cliente.nome} no WhatsApp`}
                    >
                      <MessageCircleIcon data-icon="inline-start" />
                      Chamar
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[13px] text-muted-foreground">
            O WhatsApp abre com a mensagem pronta; nada é enviado sozinho.
          </p>
        </Secao>
      </div>
    </div>
  )
}
