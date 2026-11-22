import { format } from "date-fns"
import type { Pedido } from "@/lib/admin/dados/tipos"

/** Aba Histórico: o que aconteceu na comanda, do mais novo para o mais antigo (Q10). */
export function HistoricoComanda({ pedido }: { pedido: Pedido }) {
  const eventos = pedido.eventos ?? []
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico registrado.</p>
  }
  return (
    <ol aria-label="Histórico da comanda" className="flex flex-col gap-3 text-sm">
      {eventos
        // A posição na lista guardada (que só cresce no fim) é a chave: não muda quando
        // chega um evento novo, mesmo mostrando do mais novo para o mais antigo.
        .map((evento, posicao) => ({ evento, chave: `${posicao}-${evento.tipo}-${evento.em}` }))
        .toReversed()
        .map(({ evento, chave }) => (
          <li key={chave} className="grid grid-cols-[3rem_1fr] gap-2">
            <time dateTime={evento.em} className="text-muted-foreground tabular-nums">
              {format(new Date(evento.em), "HH:mm")}
            </time>
            <span className="flex flex-col">
              <span>
                {evento.texto}
                {evento.por ? ` · ${evento.por}` : ""}
              </span>
              {evento.motivo && (
                <span className="text-xs text-muted-foreground">Motivo: {evento.motivo}</span>
              )}
            </span>
          </li>
        ))}
    </ol>
  )
}
