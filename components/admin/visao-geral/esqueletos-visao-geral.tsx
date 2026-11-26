import { Skeleton } from "@/components/ui/skeleton"
import { atrasoEscalonado } from "@/lib/admin/movimento"
import type { AbaId } from "@/lib/admin/regras/dashboard/abas"
import { formaDoEsqueleto } from "@/lib/admin/regras/esqueleto-aba"
import { Carregador } from "../movimento/carregador"

/**
 * Esqueletos da visão geral, no formato do que vai chegar: régua de números, gráfico e
 * listas de barras. Cada bloco entra um pouco depois do anterior (`esqueleto-entra`) e brilha
 * de leve (admin.css). Só o invólucro avisa o leitor de tela; as peças ficam mudas.
 */
const PASSO = 0.06

const atraso = (indice: number) => ({
  animationDelay: `${atrasoEscalonado(indice, { passo: PASSO })}s`,
})

/** Alturas das colunas do gráfico: variam para parecer dado, não grade. */
const COLUNAS = [38, 62, 48, 80, 56, 92, 44, 70, 52, 86, 60, 74]

function Regua({ indice }: { indice: number }) {
  return (
    <div data-testid="esqueleto-regua" className="esqueleto-entra" style={atraso(indice)}>
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="grid grid-cols-2 border-y border-border/70 lg:grid-cols-4">
        {[0, 1, 2, 3].map((fato) => (
          <div
            key={fato}
            data-testid="esqueleto-indicador"
            className="flex flex-col gap-2 px-4 py-4 first:pl-0 max-lg:nth-3:pl-0"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Grafico({ indice }: { indice: number }) {
  return (
    <div
      data-testid="esqueleto-grafico"
      className="esqueleto-entra flex flex-col gap-4 border-t border-border/70 pt-5"
      style={atraso(indice)}
    >
      <Skeleton className="h-4 w-44" />
      <div className="flex h-64 items-end gap-2 sm:gap-3">
        {COLUNAS.map((altura, coluna) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas do esqueleto.
            key={coluna}
            className="flex-1 rounded-b-none rounded-t-md"
            style={{ height: `${altura}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function Lista({ indice }: { indice: number }) {
  return (
    <div
      data-testid="esqueleto-lista"
      className="esqueleto-entra flex flex-col gap-4 border-t border-border/70 pt-5"
      style={atraso(indice)}
    >
      <Skeleton className="h-4 w-36" />
      {[78, 56, 40, 28].map((largura) => (
        <div key={largura} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <Skeleton className="h-1.5 rounded-full" style={{ width: `${largura}%` }} />
        </div>
      ))}
    </div>
  )
}

/** Esqueleto da aba: sem `aba`, o do Resumo. */
export function EsqueletoVisaoGeral({ aba = "resumo" }: { aba?: AbaId }) {
  const forma = formaDoEsqueleto(aba)
  let posicao = 0
  return (
    <div
      role="status"
      aria-label="Carregando a visão geral"
      aria-busy="true"
      className="flex flex-col gap-10"
    >
      {Array.from({ length: forma.reguas }, (_, regua) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos fixos do esqueleto.
        <Regua key={`regua-${regua}`} indice={posicao++} />
      ))}
      {forma.grafico && <Grafico indice={posicao++} />}
      {forma.listas > 0 && (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
          {Array.from({ length: forma.listas }, (_, lista) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocos fixos do esqueleto.
            <Lista key={`lista-${lista}`} indice={posicao++} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Espaço do gráfico enquanto o Recharts chega: colunas apagadas e o anel de quem espera
 * (o anel é o próprio aviso para o leitor de tela).
 */
export function EsqueletoGrafico() {
  return (
    <div className="relative flex h-64 items-end gap-2 sm:gap-3">
      {COLUNAS.map((altura, coluna) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas do esqueleto.
          key={coluna}
          data-testid="esqueleto-coluna"
          className="flex-1 rounded-b-none rounded-t-md opacity-60"
          style={{ height: `${altura}%` }}
        />
      ))}
      <div className="absolute inset-0 grid place-items-center text-muted-foreground">
        <Carregador variante="anel" rotulo="Carregando o gráfico" />
      </div>
    </div>
  )
}
