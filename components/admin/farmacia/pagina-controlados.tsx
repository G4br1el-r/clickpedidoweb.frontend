"use client"

import { format, parseISO } from "date-fns"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { escrituracao, saldosControlados } from "@/lib/admin/regras/farmacia"
import type { TomStatus } from "@/lib/admin/regras/status"
import { movimentosDemo, receitasDemo } from "@/lib/mock/admin/farmacia"
import { cn } from "@/lib/utils"
import { BlocoSecao } from "../bloco-secao"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { Traco } from "../traco"
import { SeloLista, SeloTarja } from "./selos"

/** Entrada soma (tom de pronto), saída é a rotina (cinza) e perda pede atenção (cancelado). */
const TIPOS: Record<MovimentoControlado["tipo"], { rotulo: string; tom: TomStatus }> = {
  entrada: { rotulo: "Entrada", tom: "pronto" },
  saida: { rotulo: "Saída", tom: "fim" },
  perda: { rotulo: "Perda", tom: "cancelado" },
}

const RESUMO =
  "Escrituração de entradas e saídas dos medicamentos da Portaria 344/98 e dos antimicrobianos. Guarde-os no armário com chave."

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
      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
        <CabecalhoPagina titulo="Controlados" resumo={RESUMO} />
        <div
          role="status"
          aria-label="Carregando a escrituração"
          className="flex flex-col divide-y divide-border/70 border-t border-border/70"
        >
          {["a", "b", "c", "d", "e"].map((chave) => (
            <div key={chave} className="flex items-center gap-4 py-3.5">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const movimentos = escrituracao(movimentosDemo(agora), receitasDemo(agora), produtos, decisoes)
  const saldos = saldosControlados(movimentos)
  const controlados = produtos.filter((produto) => produto.medicamento?.lista)
  const nomeDe = (id: string) => produtos.find((produto) => produto.id === id)?.nome ?? id
  const ultimoDe = (id: string) => movimentos.find((movimento) => movimento.produtoId === id)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Controlados"
        resumo={RESUMO}
        acoes={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="active:scale-[0.97] max-md:h-11"
            onClick={() =>
              toast.success("Arquivo do SNGPC gerado", {
                description: `${movimentos.length} movimentações. Demonstração: nada foi enviado.`,
              })
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Exportar para o SNGPC
          </Button>
        }
      />

      <BlocoSecao
        titulo="Saldo por medicamento"
        descricao="Entradas menos saídas e perdas. Confira com o físico do armário toda semana."
      >
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
                  <TableCell className="max-w-52 whitespace-normal">
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
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {ultimo ? `${TIPOS[ultimo.tipo].rotulo} em ${quando(ultimo.em)}` : "Nenhum"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </BlocoSecao>

      <BlocoSecao titulo="Movimentações" descricao="Da mais recente para a mais antiga.">
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
            {movimentos.map((movimento) => {
              const tipo = TIPOS[movimento.tipo]
              return (
                <TableRow key={movimento.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {quando(movimento.em)}
                  </TableCell>
                  <TableCell className="max-w-44 font-medium whitespace-normal">
                    {nomeDe(movimento.produtoId)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 text-[13px] leading-none font-medium whitespace-nowrap",
                        tipo.tom === "fim" ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      <Traco tom={tipo.tom} />
                      {tipo.rotulo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{movimento.quantidade}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {movimento.documento}
                  </TableCell>
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
              )
            })}
          </TableBody>
        </Table>
      </BlocoSecao>
    </div>
  )
}
