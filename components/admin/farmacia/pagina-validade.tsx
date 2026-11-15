"use client"

import { format, parseISO } from "date-fns"
import { SnowflakeIcon } from "lucide-react"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { situacaoDoLote, type ValidadeLote } from "@/lib/admin/regras/farmacia"
import type { TomStatus } from "@/lib/admin/regras/status"
import { plural } from "@/lib/formato"
import { lotesDemo } from "@/lib/mock/admin/farmacia"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { Traco } from "../traco"
import { SeloTarja } from "./selos"

type Filtro = "todos" | "vencido" | "vence-em-30" | "vence-em-90" | "baixo"

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "vencido", rotulo: "Vencidos" },
  { id: "vence-em-30", rotulo: "Vencem em 30 dias" },
  { id: "vence-em-90", rotulo: "Vencem em 90 dias" },
  { id: "baixo", rotulo: "Estoque baixo" },
]

/**
 * Tom de cada validade: vencido é o de cancelado (sai da prateleira); até 30 dias, o de
 * preparo (pede ação); até 90 e em dia ficam no cinza, e só o texto diz quanto falta.
 */
const TOM: Record<ValidadeLote, TomStatus> = {
  vencido: "cancelado",
  "vence-em-30": "preparo",
  "vence-em-90": "fim",
  "em-dia": "fim",
}

const RESUMO =
  "Cada lote com a validade dele. Vencidos saem da prateleira e vão para descarte; o que vence em 30 dias pede promoção ou devolução ao distribuidor."

function textoValidade(dias: number) {
  if (dias < 0) return `Vencido há ${plural(-dias, "dia", "dias")}`
  if (dias === 0) return "Vence hoje"
  return dias <= 90 ? `Vence em ${plural(dias, "dia", "dias")}` : "Em dia"
}

function EsqueletoValidade() {
  return (
    <div role="status" aria-label="Carregando os lotes" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-[28rem] max-w-full" />
      <div className="flex flex-col divide-y divide-border/70 border-t border-border/70">
        {["a", "b", "c", "d", "e", "f"].map((chave) => (
          <div key={chave} className="flex items-center gap-4 py-3.5">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Farmácia: lotes e validades, do que vence primeiro ao que vence por último. A quantidade geral do produto fica no módulo Estoque. */
export function PaginaValidade() {
  const agora = useAgora()
  const { data: produtos } = useProdutos()
  const [filtro, setFiltro] = useState<Filtro>("todos")

  if (!agora || !produtos) {
    return (
      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
        <CabecalhoPagina titulo="Lotes e validade" resumo={RESUMO} />
        <EsqueletoValidade />
      </div>
    )
  }

  const lotes = lotesDemo(agora)
    .map((lote) => ({
      lote,
      situacao: situacaoDoLote(lote, agora),
      produto: produtos.find((produto) => produto.id === lote.produtoId),
    }))
    .toSorted((a, b) => a.situacao.dias - b.situacao.dias)
  const passa = (filtroAtual: Filtro, item: (typeof lotes)[number]) =>
    filtroAtual === "todos" ||
    (filtroAtual === "baixo" ? item.situacao.estoqueBaixo : item.situacao.validade === filtroAtual)
  const visiveis = lotes.filter((item) => passa(filtro, item))

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina titulo="Lotes e validade" resumo={RESUMO} />

      {/* No celular o controle rola de lado dentro da própria faixa; a página não. */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <ToggleGroup
          type="single"
          variant="segmento"
          size="sm"
          value={filtro}
          onValueChange={(valor) => valor && setFiltro(valor as Filtro)}
          aria-label="Situação do lote"
        >
          {FILTROS.map(({ id, rotulo }) => {
            const quantos = lotes.filter((item) => passa(id, item)).length
            return (
              <ToggleGroupItem
                key={id}
                value={id}
                className="cursor-pointer gap-1.5 px-2.5 max-md:h-10"
              >
                {rotulo}{" "}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    // Vencido com lote é o único número que pede atenção já no filtro.
                    id === "vencido" && quantos > 0
                      ? "font-semibold text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {quantos}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      <div className="border-t border-border/70">
        <Table aria-label="Lotes">
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="hidden sm:table-cell">Lote</TableHead>
              <TableHead className="hidden sm:table-cell">Validade</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map(({ lote, situacao, produto }) => {
              const tom = TOM[situacao.validade]
              return (
                <TableRow key={lote.id}>
                  <TableCell className="max-w-56">
                    <span className="flex items-center gap-1.5 font-medium whitespace-normal">
                      {produto?.nome ?? "Produto removido"}
                      {produto?.medicamento?.refrigerado && (
                        <SnowflakeIcon
                          role="img"
                          aria-label="Guardar na geladeira"
                          className="size-4 shrink-0 text-sky-600 dark:text-sky-300"
                        />
                      )}
                    </span>
                    {produto?.medicamento && (
                      <SeloTarja tarja={produto.medicamento.tarja} className="mt-1.5" />
                    )}
                    {/* No celular, o lote vem aqui, no lugar da coluna que some. */}
                    <span className="mt-1 block font-mono text-xs text-muted-foreground sm:hidden">
                      Lote {lote.codigo}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {lote.codigo}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {format(parseISO(lote.validade), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={cn(
                        "font-medium",
                        situacao.estoqueBaixo && "text-(--tom-preparo-texto)",
                      )}
                    >
                      {lote.quantidade}
                    </span>
                    <span className="block text-xs text-muted-foreground">mín. {lote.minimo}</span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="flex flex-col gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 text-[13px] leading-tight font-medium sm:whitespace-nowrap",
                          situacao.validade === "em-dia"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        <Traco tom={tom} />
                        {textoValidade(situacao.dias)}
                      </span>
                      {/* No celular, a data vem aqui, no lugar da coluna que some. */}
                      <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                        {format(parseISO(lote.validade), "dd/MM/yyyy")}
                      </span>
                      {situacao.estoqueBaixo && (
                        <span className="pl-[11px] text-xs text-muted-foreground">
                          Estoque baixo
                        </span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
