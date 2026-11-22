"use client"

import { MessageSquareIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useFila, useServirRodada, useVerMensagem } from "@/lib/admin/dados/consultas"
import {
  mensagensPendentes,
  prontosParaServir,
  TEXTO_DA_MENSAGEM,
} from "@/lib/admin/regras/cozinha"
import { Traco } from "../traco"
import { useAlertaDeQuemServe } from "./use-alerta-de-quem-serve"

const nomeDaMesa = (numero: number | undefined, rodada: number) =>
  `Mesa ${numero ?? "?"}${rodada > 1 ? ` · ${rodada}ª rodada` : ""}`

/**
 * O que o salão tem para levar agora: as rodadas prontas das mesas, com Servido, e as
 * mensagens da cozinha, com Ok. Some quando não há nada; o alerta toca no que chega.
 */
export function ProntosParaServir({ intervalo }: { intervalo?: number }) {
  const { data: pedidos } = useFila(intervalo)
  const servir = useServirRodada()
  const ver = useVerMensagem()
  useAlertaDeQuemServe(pedidos, "salao")
  if (!pedidos) return null

  const prontos = prontosParaServir(pedidos)
  const mensagens = pedidos
    .filter((pedido) => pedido.tipo === "mesa")
    .flatMap((pedido) => mensagensPendentes(pedido).map((mensagem) => ({ pedido, mensagem })))
  if (prontos.length === 0 && mensagens.length === 0) return null
  const aoErrar = (erro: Error) => toast.error(erro.message)

  return (
    <section
      aria-label={`Prontos para servir, ${prontos.length}`}
      className="flex flex-col gap-2.5"
    >
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Traco tom="pronto" />
        Prontos para servir
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
          {prontos.length}
        </span>
      </h2>
      {/* No celular, uma coluna; na tela larga, cartões lado a lado, com o Servido perto do nome. */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {mensagens.map(({ pedido, mensagem }) => {
          const texto = TEXTO_DA_MENSAGEM[mensagem.tipo]
          return (
            <li
              key={mensagem.id}
              aria-label={`Mesa ${pedido.mesa?.numero ?? "?"}: ${texto}`}
              className="flex items-center gap-3 rounded-lg bg-(--atencao)/[0.08] py-2 pr-2 pl-3"
            >
              <MessageSquareIcon className="size-4 shrink-0 text-(--atencao)" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">
                  {nomeDaMesa(pedido.mesa?.numero, mensagem.rodada)}:
                </span>{" "}
                {texto}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  ver.mutate({ id: pedido.id, mensagemId: mensagem.id }, { onError: aoErrar })
                }
              >
                Ok
              </Button>
            </li>
          )
        })}
        {prontos.map((ticket) => {
          const nome = `${nomeDaMesa(ticket.pedido.mesa?.numero, ticket.rodada)}${ticket.refazer ? " · refazer" : ""}`
          return (
            <li
              key={ticket.id}
              aria-label={nome}
              className="flex items-center gap-3 rounded-lg bg-(--tom-pronto)/[0.08] py-2 pr-2 pl-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">{nome}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {ticket.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  servir.mutate(
                    {
                      id: ticket.pedido.id,
                      rodada: ticket.rodada,
                      refazer: ticket.refazer?.numero,
                    },
                    { onError: aoErrar },
                  )
                }
              >
                Servido
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
