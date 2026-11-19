import type { MapaDeCalor as Mapa } from "@/lib/admin/regras/dashboard/vendas"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"

const NOMES_DOS_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** Um tom do azul do gráfico por nível; o vazio é a tinta quase transparente. */
const TONS = [
  "bg-foreground/[0.04]",
  "bg-(--grafico)/20",
  "bg-(--grafico)/40",
  "bg-(--grafico)/65 text-white",
  "bg-(--grafico)/90 text-white",
]

/**
 * Mapa de calor em tabela: cada célula é um dia da semana numa hora, mais forte quanto
 * mais pedidos. O número aparece ao passar o mouse, tocar ou focar; o leitor de tela lê
 * a tabela inteira, com pedidos e faturamento.
 */
export function MapaDeCalor({
  mapa,
  pedido,
  pedidos,
}: {
  mapa: Mapa
  pedido: string
  pedidos: string
}) {
  if (mapa.horas.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
  return (
    <table
      aria-label={`${pedidos[0].toUpperCase()}${pedidos.slice(1)} por dia da semana e hora`}
      className="w-full max-w-3xl table-fixed border-separate border-spacing-0.5 text-xs"
    >
      <thead>
        <tr>
          <th scope="col" className="w-10 text-left font-normal text-muted-foreground">
            <span className="sr-only">Dia</span>
          </th>
          {mapa.horas.map((hora) => (
            <th
              key={hora}
              scope="col"
              className="pb-1 font-normal text-muted-foreground tabular-nums"
            >
              {hora}h
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {mapa.dias.map((linha) => (
          <tr key={linha.dia}>
            <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">
              <span aria-hidden="true">{NOMES_DOS_DIAS[linha.dia].slice(0, 3)}</span>
              <span className="sr-only">{NOMES_DOS_DIAS[linha.dia]}</span>
            </th>
            {linha.celulas.map((celula) => (
              <td
                key={celula.hora}
                // O número visível vem do CSS: o texto da célula é o que o leitor de tela lê.
                data-pedidos={celula.pedidos || ""}
                tabIndex={celula.pedidos ? 0 : undefined}
                className={cn(
                  "h-7 rounded-[3px] text-center align-middle tabular-nums outline-none",
                  "after:opacity-0 after:content-[attr(data-pedidos)] hover:after:opacity-100 focus-visible:after:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                  TONS[celula.nivel],
                )}
              >
                <span className="sr-only">
                  {celula.pedidos
                    ? `${plural(celula.pedidos, pedido, pedidos)}, ${emReais(celula.faturamento)}`
                    : `Sem ${pedidos}`}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
