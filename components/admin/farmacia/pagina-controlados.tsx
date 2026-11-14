"use client"

import { format, parseISO } from "date-fns"
import { DownloadIcon, ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAgora } from "@/hooks/use-agora"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { MovimentoControlado } from "@/lib/admin/dados/tipos"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import { saidasDaReceita, saldosControlados } from "@/lib/admin/regras/farmacia"
import { movimentosDemo, receitasDemo } from "@/lib/mock/admin/farmacia"
import { cn } from "@/lib/utils"
import { SeloLista, SeloTarja } from "./selos"

const TIPOS: Record<MovimentoControlado["tipo"], { rotulo: string; classe: string }> = {
  entrada: {
    rotulo: "Entrada",
    classe:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  saida: { rotulo: "Saída", classe: "" },
  perda: { rotulo: "Perda", classe: "border-destructive/40 text-destructive" },
}

const quando = (em: string) => format(parseISO(em), "dd/MM HH:mm")

/**
 * Farmácia: escrituração dos medicamentos de lista (Portaria 344/98) e antimicrobianos.
 * As receitas aprovadas entram aqui como saída, com paciente e prescritor.
 */
export function PaginaControlados() {
  const agora = useAgora()
  const { data: produtos } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)

  if (!agora || !produtos) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Controlados</h1>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const dispensadas = receitasDemo(agora).flatMap((receita) => {
    const decisao = decisoes[receita.id]
    return decisao?.situacao === "aprovada" ? saidasDaReceita(receita, produtos, decisao.em) : []
  })
  const movimentos = [...movimentosDemo(agora), ...dispensadas].toSorted(
    (a, b) => Date.parse(b.em) - Date.parse(a.em),
  )
  const saldos = saldosControlados(movimentos)
  const controlados = produtos.filter((produto) => produto.medicamento?.lista)
  const nomeDe = (id: string) => produtos.find((produto) => produto.id === id)?.nome ?? id
  const ultimoDe = (id: string) => movimentos.find((movimento) => movimento.produtoId === id)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controlados</h1>
          <p className="text-sm text-muted-foreground">
            Escrituração de entradas e saídas dos medicamentos da Portaria 344/98 e dos
            antimicrobianos. Guarde-os no armário com chave.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.success("Arquivo do SNGPC gerado", {
              description: `${movimentos.length} movimentações. Demonstração: nada foi enviado.`,
            })
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Exportar para o SNGPC
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo por medicamento</CardTitle>
          <CardDescription>
            Entradas menos saídas e perdas. Confira com o físico do armário toda semana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table aria-label="Saldo por medicamento">
            <TableHeader>
              <TableRow>
                <TableHead>Medicamento</TableHead>
                <TableHead>Lista</TableHead>
                <TableHead className="hidden md:table-cell">Tarja</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="hidden sm:table-cell">Último movimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlados.map((produto) => {
                const medicamento = produto.medicamento as NonNullable<typeof produto.medicamento>
                const saldo = saldos[produto.id] ?? 0
                const ultimo = ultimoDe(produto.id)
                return (
                  <TableRow key={produto.id}>
                    <TableCell>
                      <span className="font-medium">{produto.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {medicamento.principioAtivo}
                      </span>
                    </TableCell>
                    <TableCell>
                      {medicamento.lista && <SeloLista lista={medicamento.lista} />}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <SeloTarja tarja={medicamento.tarja} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        saldo < 0 && "text-destructive",
                      )}
                    >
                      {saldo}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {ultimo ? `${TIPOS[ultimo.tipo].rotulo} em ${quando(ultimo.em)}` : "Nenhum"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlertIcon className="size-4" aria-hidden="true" />
            Movimentações
          </CardTitle>
          <CardDescription>Da mais recente para a mais antiga.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table aria-label="Movimentações">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Movimento</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="hidden md:table-cell">Documento</TableHead>
                <TableHead className="hidden lg:table-cell">Paciente e prescritor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((movimento) => (
                <TableRow key={movimento.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {quando(movimento.em)}
                  </TableCell>
                  <TableCell className="font-medium">{nomeDe(movimento.produtoId)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TIPOS[movimento.tipo].classe}>
                      {TIPOS[movimento.tipo].rotulo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{movimento.quantidade}</TableCell>
                  <TableCell className="hidden md:table-cell">{movimento.documento}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {movimento.paciente ? (
                      <>
                        <span>{movimento.paciente}</span>
                        <span className="block text-xs text-muted-foreground">
                          {movimento.prescritor}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
