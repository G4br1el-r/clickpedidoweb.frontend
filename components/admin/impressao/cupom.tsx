"use client"

import { format } from "date-fns"
import { type Ref, useRef } from "react"
import { useReactToPrint } from "react-to-print"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { enderecoEmTexto, formatarTelefone } from "@/lib/admin/regras/mensagens"
import { rotuloCanal, rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { emReais } from "@/lib/formato"

const PAGINA_80MM =
  "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px; color: #000 }"

/** Área imprimível e a função que manda para a impressora (pelo navegador). */
export function useImpressora(titulo: string) {
  const area = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: area,
    documentTitle: titulo,
    pageStyle: PAGINA_80MM,
  })
  return { area, imprimir }
}

function Linha({
  esquerda,
  direita,
  forte,
}: {
  esquerda: string
  direita: string
  forte?: boolean
}) {
  return (
    <div className={forte ? "flex justify-between gap-2 font-bold" : "flex justify-between gap-2"}>
      <span>{esquerda}</span>
      <span>{direita}</span>
    </div>
  )
}

/**
 * Cupom de 80 mm do pedido: itens com opções e observação, cliente, endereço,
 * pagamento e troco. Fica fora da tela e só aparece na impressão.
 */
export function Cupom({
  pedido,
  loja,
  area,
}: {
  pedido: Pedido
  loja: string
  area: Ref<HTMLDivElement>
}) {
  const troco = pedido.trocoPara ? pedido.trocoPara - pedido.total : 0
  return (
    <div className="hidden">
      <div ref={area} className="flex flex-col gap-1.5 p-2 font-mono text-xs text-black">
        <p className="text-center font-bold">{loja}</p>
        <p className="text-center text-sm font-bold">Pedido #{pedido.numero}</p>
        <p className="text-center">
          {rotuloCanal(pedido.tipo)}
          {pedido.mesa ? ` ${pedido.mesa.numero}` : ""} ·{" "}
          {format(new Date(pedido.criadoEm), "dd/MM/yyyy HH:mm")}
        </p>
        <hr className="border-dashed border-black" />
        {pedido.itens.map((item) => (
          <div key={item.id}>
            <Linha esquerda={`${item.quantidade}x ${item.nome}`} direita={emReais(item.total)} />
            {item.opcoes.map((opcao) => (
              <p key={opcao} className="pl-3">
                * {opcao}
              </p>
            ))}
            {item.observacao && <p className="pl-3">Obs.: {item.observacao}</p>}
          </div>
        ))}
        <hr className="border-dashed border-black" />
        <Linha esquerda="Subtotal" direita={emReais(pedido.subtotal)} />
        {pedido.desconto > 0 && (
          <Linha esquerda="Desconto" direita={`- ${emReais(pedido.desconto)}`} />
        )}
        {pedido.taxaEntrega > 0 && (
          <Linha esquerda="Entrega" direita={emReais(pedido.taxaEntrega)} />
        )}
        <Linha esquerda="TOTAL" direita={emReais(pedido.total)} forte />
        <p>
          {rotuloPagamento(pedido.pagamento)} ·{" "}
          {pedido.situacaoPagamento === "pago" ? "PAGO" : `COBRAR ${emReais(pedido.total)}`}
          {troco > 0 ? ` · troco para ${emReais(pedido.trocoPara ?? 0)} (${emReais(troco)})` : ""}
        </p>
        <hr className="border-dashed border-black" />
        <p>
          {pedido.cliente.nome} · {formatarTelefone(pedido.cliente.telefone)}
        </p>
        {pedido.endereco && <p>{enderecoEmTexto(pedido.endereco)}</p>}
        {pedido.endereco?.referencia && <p>Ref.: {pedido.endereco.referencia}</p>}
        {pedido.observacao && <p>Obs.: {pedido.observacao}</p>}
      </div>
    </div>
  )
}

/** Pedido de exemplo para o "Imprimir cupom de teste" das configurações. */
export function pedidoDeTeste(agora: Date): Pedido {
  const momento = agora.toISOString()
  return {
    id: 0,
    numero: 123,
    token: "teste",
    origem: "site",
    tipo: "entrega",
    status: "recebido",
    cliente: { nome: "Cliente de teste", telefone: "12999990000" },
    endereco: {
      cep: "12000-000",
      logradouro: "Rua do Teste",
      numero: "100",
      bairro: "Centro",
      cidade: "Sua cidade",
    },
    itens: [
      {
        id: "teste-1",
        produtoId: null,
        nome: "Item de teste",
        quantidade: 2,
        precoUnitario: 10,
        opcoes: ["Opção: exemplo"],
        observacao: "sem cebola",
        total: 20,
      },
    ],
    subtotal: 20,
    desconto: 0,
    taxaEntrega: 5,
    total: 25,
    pagamento: "dinheiro",
    situacaoPagamento: "na-entrega",
    trocoPara: 50,
    criadoEm: momento,
    atualizadoEm: momento,
    historico: [{ tipo: "etapa", status: "recebido", em: momento }],
    enviarParaCozinha: true,
  }
}
