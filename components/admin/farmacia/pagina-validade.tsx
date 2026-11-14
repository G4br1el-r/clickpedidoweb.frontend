"use client"

import { format, parseISO } from "date-fns"
import { SnowflakeIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { plural } from "@/lib/formato"
import { lotesDemo } from "@/lib/mock/admin/farmacia"
import { SeloTarja } from "./selos"

type Filtro = "todos" | "vencido" | "vence-em-30" | "vence-em-90" | "baixo"

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "vencido", rotulo: "Vencidos" },
  { id: "vence-em-30", rotulo: "Vencem em 30 dias" },
  { id: "vence-em-90", rotulo: "Vencem em 90 dias" },
  { id: "baixo", rotulo: "Estoque baixo" },
]

const CORES: Record<ValidadeLote, string> = {
  vencido: "border-destructive/40 bg-destructive/10 text-destructive",
  "vence-em-30":
    "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200",
  "vence-em-90": "",
  "em-dia": "text-muted-foreground",
}

function textoValidade(dias: number) {
  if (dias < 0) return `Vencido há ${plural(-dias, "dia", "dias")}`
  if (dias === 0) return "Vence hoje"
  return dias <= 90 ? `Vence em ${plural(dias, "dia", "dias")}` : "Em dia"
}

/** Farmácia: lotes e validades, do que vence primeiro ao que vence por último. A quantidade geral do produto fica no módulo Estoque. */
export function PaginaValidade() {
  const agora = useAgora()
  const { data: produtos } = useProdutos()
  const [filtro, setFiltro] = useState<Filtro>("todos")

  if (!agora || !produtos) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lotes e validade</h1>
        <Skeleton className="h-64 rounded-xl" />
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
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lotes e validade</h1>
        <p className="text-sm text-muted-foreground">
          Cada lote com a validade dele. Vencidos saem da prateleira e vão para descarte; o que
          vence em 30 dias pede promoção ou devolução ao distribuidor.
        </p>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={filtro}
        onValueChange={(valor) => valor && setFiltro(valor as Filtro)}
        aria-label="Situação do lote"
        className="flex-wrap"
      >
        {FILTROS.map(({ id, rotulo }) => (
          <ToggleGroupItem key={id} value={id} className="gap-1.5 px-3">
            {rotulo}{" "}
            <Badge variant={id === "vencido" ? "destructive" : "secondary"}>
              {lotes.filter((item) => passa(id, item)).length}
            </Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Card>
        <CardContent>
          <Table aria-label="Lotes">
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map(({ lote, situacao, produto }) => (
                <TableRow key={lote.id}>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      {produto?.nome ?? "Produto removido"}
                      {produto?.medicamento?.refrigerado && (
                        <SnowflakeIcon
                          role="img"
                          aria-label="Guardar na geladeira"
                          className="size-4 text-sky-600 dark:text-sky-300"
                        />
                      )}
                    </span>
                    {produto?.medicamento && (
                      <SeloTarja tarja={produto.medicamento.tarja} className="mt-1" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{lote.codigo}</TableCell>
                  <TableCell className="tabular-nums">
                    {format(parseISO(lote.validade), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lote.quantidade}
                    <span className="block text-xs text-muted-foreground">mín. {lote.minimo}</span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={CORES[situacao.validade]}>
                        {textoValidade(situacao.dias)}
                      </Badge>
                      {situacao.estoqueBaixo && <Badge variant="secondary">Estoque baixo</Badge>}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
