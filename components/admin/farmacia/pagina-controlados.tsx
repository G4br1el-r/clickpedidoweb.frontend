"use client"

import { format, parseISO } from "date-fns"
import { DownloadIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { EsqueletoLista } from "../esqueletos"
import { FioDeAtualizacao } from "../estoque/fio-de-atualizacao"
import { LinhaAnimada } from "../estoque/linha-animada"
import { Carregador } from "../movimento/carregador"
import { BlocoEntrando } from "../movimento/entrada-admin"
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
  const { data: produtos, isFetching } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  const [gerando, setGerando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(temporizador.current), [])

  if (!agora || !produtos) {
    return (
      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
        <CabecalhoPagina titulo="Controlados" resumo={RESUMO} />
        <EsqueletoLista linhas={5} rotulo="Carregando a escrituração" />
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
            aria-busy={gerando || undefined}
            disabled={gerando}
            onClick={() => {
              setGerando(true)
              // Demonstração: o arquivo é montado na hora; a espera curta mostra o envio.
              temporizador.current = setTimeout(() => {
                setGerando(false)
                toast.success("Arquivo do SNGPC gerado", {
                  description: `${movimentos.length} movimentações. Demonstração: nada foi enviado.`,
                })
              }, 700)
            }}
          >
            {gerando ? (
              <span className="size-5 shrink-0 text-muted-foreground">
                <Carregador variante="radar" rotulo="Gerando o arquivo do SNGPC" />
              </span>
            ) : (
              <DownloadIcon data-icon="inline-start" />
            )}
            Exportar para o SNGPC
          </Button>
        }
      />

      <FioDeAtualizacao ativo={isFetching} rotulo="Atualizando os medicamentos" />

      <BlocoEntrando>
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
              <AnimatePresence>
                {controlados.map((produto, indice) => {
                  const medicamento = produto.medicamento as NonNullable<typeof produto.medicamento>
                  const saldo = saldos[produto.id] ?? 0
                  const ultimo = ultimoDe(produto.id)
                  return (
                    <LinhaAnimada key={produto.id} indice={indice}>
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
                    </LinhaAnimada>
                  )
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </BlocoSecao>
      </BlocoEntrando>

      <BlocoEntrando>
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
              <AnimatePresence>
                {movimentos.map((movimento, indice) => {
                  const tipo = TIPOS[movimento.tipo]
                  return (
                    <LinhaAnimada key={movimento.id} indice={indice}>
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
                      <TableCell className="text-right tabular-nums">
                        {movimento.quantidade}
                      </TableCell>
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
                    </LinhaAnimada>
                  )
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </BlocoSecao>
      </BlocoEntrando>
    </div>
  )
}
