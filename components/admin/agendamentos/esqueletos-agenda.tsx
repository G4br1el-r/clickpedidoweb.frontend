import { Skeleton } from "@/components/ui/skeleton"
import { atrasoEscalonado } from "@/lib/admin/movimento"

const atraso = (indice: number) => ({
  animationDelay: `${atrasoEscalonado(indice, { passo: 0.06 })}s`,
})

/** Onde caem os blocos do esqueleto: posição e altura em % da linha do tempo, e a faixa. */
const BLOCOS = [
  { topo: "8%", altura: "11%", esquerda: "0%", largura: "100%" },
  { topo: "26%", altura: "11%", esquerda: "0%", largura: "50%" },
  { topo: "30%", altura: "11%", esquerda: "50%", largura: "50%" },
  { topo: "58%", altura: "17%", esquerda: "0%", largura: "100%" },
  { topo: "82%", altura: "8%", esquerda: "0%", largura: "100%" },
] as const

/**
 * Esqueleto da agenda do dia: o título e o dia, os botões de navegar e a linha do tempo com
 * a coluna das horas e blocos de tamanhos diferentes, alguns lado a lado, como a agenda real.
 */
export function EsqueletoAgenda() {
  return (
    <div
      role="status"
      aria-label="Carregando a agenda"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-8 w-52 rounded-lg" />
      </div>
      <div className="flex rounded-2xl bg-foreground/[0.03] p-2 pt-3">
        <div className="flex w-12 shrink-0 flex-col gap-[4.2rem] pl-1">
          {Array.from({ length: 6 }, (_, hora) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: horas de esqueleto não têm identidade.
            <Skeleton key={hora} className="h-3 w-8" />
          ))}
        </div>
        <div className="relative h-[28rem] flex-1">
          {BLOCOS.map((bloco, indice) => (
            <div
              key={bloco.topo + bloco.esquerda}
              data-testid="esqueleto-atendimento"
              className="esqueleto-entra absolute p-px pr-0.5 pb-0.5"
              style={{
                top: bloco.topo,
                height: bloco.altura,
                left: bloco.esquerda,
                width: bloco.largura,
                ...atraso(indice),
              }}
            >
              <Skeleton className="size-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Grade dos horários livres enquanto o servidor responde: a mesma grade de 4 ou 5 colunas. */
export function EsqueletoHorarios({ quantidade = 10 }: { quantidade?: number }) {
  return (
    <div
      role="status"
      aria-label="Carregando os horários"
      aria-busy="true"
      className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
    >
      {Array.from({ length: quantidade }, (_, indice) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: horários de esqueleto não têm identidade.
          key={indice}
          data-testid="esqueleto-horario"
          className="esqueleto-entra h-9 rounded-md max-sm:h-11"
          style={atraso(indice)}
        />
      ))}
    </div>
  )
}
