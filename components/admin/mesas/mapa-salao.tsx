"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AreaSalao } from "@/lib/admin/dados/tipos"
import type { MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import { GRADE_MAPA, tamanhoDaMesa } from "@/lib/admin/regras/salao"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"
import { descricaoDaMesa, MenuMesa } from "./cartao-mesa"

type AcoesNoMapa = {
  aoAbrir: (linha: MesaNaGrade) => void
  /** Recebem o botão ⋯, para onde o foco volta quando a janela fecha. */
  aoEditar: (linha: MesaNaGrade, gatilho: HTMLElement | null) => void
  aoBloquear: (linha: MesaNaGrade, gatilho: HTMLElement | null) => void
}

/** Ordem de leitura do desenho: linha, depois coluna. O Tab segue o mapa. */
const emOrdemDeLeitura = (a: MesaNaGrade, b: MesaNaGrade) =>
  a.mesa.posicao.y - b.mesa.posicao.y || a.mesa.posicao.x - b.mesa.posicao.x

/** As cadeiras em volta da mesa: metade em cima, metade embaixo. Só desenho. */
function Cadeiras({ lugares }: { lugares: number }) {
  const lado = (quantas: number, onde: string) => (
    <span aria-hidden="true" className={cn("absolute inset-x-2 flex justify-around", onde)}>
      {Array.from({ length: quantas }, (_, indice) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cadeiras iguais, só desenho
        <span key={indice} className="h-1 w-2.5 rounded-full bg-foreground/20" />
      ))}
    </span>
  )
  return (
    <>
      {lado(Math.ceil(lugares / 2), "top-0")}
      {lado(Math.floor(lugares / 2), "bottom-0")}
    </>
  )
}

function MesaNoMapa({
  linha,
  agora,
  aoAbrir,
  aoEditar,
  aoBloquear,
}: AcoesNoMapa & { linha: MesaNaGrade; agora: Date | null }) {
  const { mesa, comanda, estado, alertas } = linha
  const { largura, altura } = tamanhoDaMesa(mesa)
  const ocupada = mesa.status === "ocupada"
  const alerta = alertas[0]
  return (
    <li
      className="relative p-1.5"
      style={{
        gridColumn: `${mesa.posicao.x + 1} / span ${largura}`,
        gridRow: `${mesa.posicao.y + 1} / span ${altura}`,
      }}
    >
      <Cadeiras lugares={mesa.lugares} />
      <button
        type="button"
        onClick={() => aoAbrir(linha)}
        aria-label={`Mesa ${mesa.numero}`}
        aria-describedby={`mapa-${mesa.id}-detalhes`}
        data-alerta={alerta?.tipo}
        className={cn(
          "flex size-full cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-center outline-none",
          "transition-[transform,box-shadow,background-color] duration-150 ease-saida active:scale-[0.97] motion-reduce:transition-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          mesa.forma === "redonda" ? "rounded-full" : "rounded-lg",
          ocupada
            ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1"
            : "bg-foreground/[0.04] ring-1 ring-border/60 hover:bg-foreground/[0.07]",
          // O alerta pede o olho com a cor da ação (tom novo), nunca com o vermelho de erro.
          ocupada && (alerta ? "ring-2 ring-(--tom-novo)" : "ring-border/80"),
        )}
      >
        <span className="text-[15px] leading-none font-semibold">{mesa.numero}</span>
        <span
          className={cn(
            "flex max-w-full items-center gap-1 text-[11px] leading-tight font-medium",
            !ocupada && "text-muted-foreground",
          )}
        >
          <Traco tom={estado.tom} className="h-2.5" />
          <span className="truncate">{estado.rotulo}</span>
        </span>
        <span id={`mapa-${mesa.id}-detalhes`} className="sr-only">
          {descricaoDaMesa(linha, agora)}
        </span>
      </button>
      <MenuMesa
        mesa={mesa}
        comanda={comanda}
        estado={estado.estado}
        aoAbrir={() => aoAbrir(linha)}
        aoEditar={(gatilho) => aoEditar(linha, gatilho)}
        aoBloquear={(gatilho) => aoBloquear(linha, gatilho)}
        className="absolute top-0 right-0 size-6 rounded-full bg-background/80"
      />
    </li>
  )
}

/** A planta de uma área: a grade 24 × 16, com as mesas nos lugares delas. */
function Planta({
  area,
  linhas,
  agora,
  ...acoes
}: AcoesNoMapa & { area: AreaSalao; linhas: MesaNaGrade[]; agora: Date | null }) {
  return (
    // No celular a planta rola de lado dentro da própria faixa; a página não.
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <ul
        aria-label={`Mapa: ${area.nome}`}
        className="grid aspect-[3/2] min-w-[720px] rounded-xl border border-border/70 bg-foreground/[0.015] bg-[size:calc(100%/24)_calc(100%/16)] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] p-0"
        style={{
          gridTemplateColumns: `repeat(${GRADE_MAPA.colunas}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRADE_MAPA.linhas}, minmax(0, 1fr))`,
        }}
      >
        {linhas.toSorted(emOrdemDeLeitura).map((linha) => (
          <MesaNoMapa key={linha.mesa.id} linha={linha} agora={agora} {...acoes} />
        ))}
      </ul>
    </div>
  )
}

/** O mapa do salão: uma aba por área (só as que têm mesa) e a planta da área escolhida. */
export function MapaSalao({
  linhas,
  areas,
  areaId,
  aoMudarArea,
  agora,
  ...acoes
}: AcoesNoMapa & {
  linhas: MesaNaGrade[]
  areas: AreaSalao[]
  /** A área do endereço (`?area=`); sem ela, a primeira. */
  areaId: string | null
  aoMudarArea: (areaId: string) => void
  agora: Date | null
}) {
  const daArea = (area: AreaSalao) => linhas.filter(({ mesa }) => mesa.areaId === area.id)
  const comMesa = areas
    .toSorted((a, b) => a.ordem - b.ordem)
    .filter((area) => daArea(area).length > 0)
  const atual = comMesa.find((area) => area.id === areaId) ?? comMesa[0]
  if (!atual) return null
  return (
    <Tabs value={atual.id} onValueChange={aoMudarArea} className="gap-3">
      <TabsList aria-label="Áreas">
        {comMesa.map((area) => (
          <TabsTrigger key={area.id} value={area.id}>
            {area.nome}
          </TabsTrigger>
        ))}
      </TabsList>
      {comMesa.map((area) => (
        <TabsContent key={area.id} value={area.id}>
          <Planta area={area} linhas={daArea(area)} agora={agora} {...acoes} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
