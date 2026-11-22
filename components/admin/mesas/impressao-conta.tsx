"use client"

import { format } from "date-fns"
import type { ReactNode, Ref } from "react"
import type { Mesa, PagamentoConta, Pedido } from "@/lib/admin/dados/tipos"
import { dividirIgualmente, resumoDaConta, saldoDepoisDe } from "@/lib/admin/regras/conta"
import { rotuloDoPagamento } from "@/lib/admin/regras/rotulos"
import { emReais } from "@/lib/formato"

/** Estilo do papel de 80 mm, para o `react-to-print`. */
export const PAPEL_80MM =
  "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px }"

const Linha = ({ rotulo, valor, forte }: { rotulo: ReactNode; valor: string; forte?: boolean }) => (
  <div className={forte ? "flex justify-between gap-2 font-bold" : "flex justify-between gap-2"}>
    <span>{rotulo}</span>
    <span>{valor}</span>
  </div>
)

const Papel = ({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) => (
  <div ref={ref} className="flex flex-col gap-2 p-2 font-mono text-xs text-black">
    {children}
  </div>
)

const Traco = () => <hr className="border-dashed border-black" />

/**
 * Pré-conta de 80 mm (Q30): itens, cortesias, desconto, taxa, couvert, total, pagamentos feitos,
 * saldo e o valor por pessoa.
 */
export function PreConta({
  pedido,
  mesa,
  loja,
  agora,
  ref,
}: {
  pedido: Pedido
  mesa: Pick<Mesa, "numero">
  loja: string | undefined
  agora: Date
  ref?: Ref<HTMLDivElement>
}) {
  const resumo = resumoDaConta(pedido)
  const pessoas = pedido.mesa?.pessoas ?? 1
  const pagamentos = pedido.pagamentos ?? []
  return (
    <Papel ref={ref}>
      <p className="text-center font-bold">{loja}</p>
      <p className="text-center">
        Mesa {mesa.numero} · {pedido.cliente.nome}
      </p>
      <p className="text-center">Pré-conta · {format(agora, "dd/MM/yyyy HH:mm")}</p>
      <Traco />
      {pedido.itens.map((item) => (
        <div key={item.id}>
          <Linha
            rotulo={`${item.quantidade}× ${item.nome}${item.cortesia ? " (cortesia)" : ""}`}
            valor={emReais(item.cortesia ? 0 : item.total)}
          />
          {item.opcoes.map((opcao) => (
            <p key={opcao} className="pl-3">
              * {opcao}
            </p>
          ))}
        </div>
      ))}
      <Traco />
      <Linha rotulo="Itens" valor={emReais(resumo.itens)} />
      {resumo.cortesias > 0 && (
        <Linha rotulo="Cortesias" valor={`− ${emReais(resumo.cortesias)}`} />
      )}
      {resumo.descontos > 0 && <Linha rotulo="Desconto" valor={`− ${emReais(resumo.descontos)}`} />}
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
      <Linha rotulo="TOTAL" valor={emReais(resumo.total)} forte />
      {pagamentos.length > 0 && (
        <>
          <Traco />
          {pagamentos.map((pagamento) => (
            <Linha
              key={pagamento.id}
              rotulo={`${rotuloDoPagamento(pagamento)} ${format(new Date(pagamento.em), "HH:mm")}`}
              valor={emReais(pagamento.valor)}
            />
          ))}
          <Linha rotulo="Saldo" valor={emReais(resumo.saldo)} forte />
        </>
      )}
      {pessoas > 1 && (
        <Linha
          rotulo={`Por pessoa (${pessoas})`}
          valor={emReais(dividirIgualmente(resumo.total, pessoas)[0])}
        />
      )}
      <p className="text-center">Não é documento fiscal.</p>
    </Papel>
  )
}

/** Comprovante de 80 mm de um pagamento: forma, valor, recebido e troco, e o saldo que ficou depois dele. */
export function Comprovante({
  pedido,
  mesa,
  loja,
  pagamento,
  ref,
}: {
  pedido: Pedido
  mesa: Pick<Mesa, "numero">
  loja: string | undefined
  pagamento: PagamentoConta
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <Papel ref={ref}>
      <p className="text-center font-bold">{loja}</p>
      <p className="text-center">Comprovante de pagamento</p>
      <p className="text-center">
        Mesa {mesa.numero} · {format(new Date(pagamento.em), "dd/MM/yyyy HH:mm")}
      </p>
      <Traco />
      <Linha rotulo={rotuloDoPagamento(pagamento)} valor={emReais(pagamento.valor)} forte />
      {pagamento.recebido !== undefined && (
        <Linha rotulo="Recebido" valor={emReais(pagamento.recebido)} />
      )}
      {pagamento.troco !== undefined && <Linha rotulo="Troco" valor={emReais(pagamento.troco)} />}
      <Traco />
      <Linha rotulo="Saldo da conta" valor={emReais(saldoDepoisDe(pedido, pagamento.id))} />
      <p className="text-center">Não é documento fiscal.</p>
    </Papel>
  )
}
