"use client"

import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Categoria, Pedido, Produto } from "@/lib/admin/dados/tipos"
import {
  coberturaDoEstoque,
  curvaABC,
  margemDoPeriodo,
  opcoesMaisEscolhidas,
  type ProdutoVendido,
  porCategoria,
  resumoABC,
  semVenda,
  vendasPorProduto,
} from "@/lib/admin/regras/dashboard/produtos"
import { emQuantidade, resumoDoEstoque } from "@/lib/admin/regras/estoque"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { type SegmentoPainelId, temRecurso } from "@/lib/admin/segmentos-painel"
import { emReais, plural } from "@/lib/formato"
import { BlocoSecao } from "../../bloco-secao"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const porcento = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

type Medida = "faturamento" | "quantidade"

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** Quanto saiu do produto: o peso no quilo, as unidades no resto. */
const saiu = (produto: ProdutoVendido) =>
  produto.kg !== undefined ? `${decimal.format(produto.kg)} kg` : `${produto.quantidade} un.`

/** Os 10 que mais venderam, pela medida escolhida, cada um levando aos pedidos dele. */
function Ranking({ vendas, noPeriodo }: { vendas: ProdutoVendido[]; noPeriodo: string }) {
  const [medida, setMedida] = useState<Medida>("faturamento")
  const valor = (produto: ProdutoVendido) =>
    medida === "faturamento" ? produto.faturamento : (produto.kg ?? produto.quantidade)
  const total = vendas.reduce((soma, produto) => soma + valor(produto), 0)
  const primeiros = vendas.toSorted((a, b) => valor(b) - valor(a)).slice(0, 10)
  return (
    <BlocoSecao
      titulo="Mais vendidos"
      descricao="Toque num produto para ver os pedidos dele"
      acao={
        <ToggleGroup
          type="single"
          variant="segmento"
          size="sm"
          aria-label="Ordenar o ranking por"
          value={medida}
          onValueChange={(escolhida) => escolhida && setMedida(escolhida as Medida)}
        >
          <ToggleGroupItem value="faturamento" className="cursor-pointer">
            R$
          </ToggleGroupItem>
          <ToggleGroupItem value="quantidade" className="cursor-pointer">
            Qtd.
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <ListaDeFatias
        vazio="Nenhuma venda no período."
        itens={primeiros.map((produto) => ({
          chave: produto.chave,
          nome: produto.nome,
          pedidos: produto.pedidos,
          total: produto.faturamento,
          percentual: total ? (valor(produto) / total) * 100 : 0,
          detalhe: saiu(produto),
          href: `/admin/pedidos?busca=${encodeURIComponent(produto.nome)}&${noPeriodo}`,
        }))}
      />
    </BlocoSecao>
  )
}

/** Quantos nomes cabem na lista do que não vendeu antes do "e mais". */
const NOMES_SEM_VENDA = 20

/** Todos os produtos vendidos, recolhida: classe ABC, quantidade, faturamento e margem. */
function TabelaDeProdutos({
  curva,
  margens,
}: {
  curva: ReturnType<typeof curvaABC>
  margens: Map<string, number>
}) {
  const [aberta, setAberta] = useState(false)
  return (
    <Collapsible open={aberta} onOpenChange={setAberta}>
      <div className="border-y border-border/70">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[15px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Todos os produtos, em tabela
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform duration-200 ease-saida data-[state=open]:rotate-180"
            data-state={aberta ? "open" : "closed"}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-4">
            <Table aria-label="Produtos do período">
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {curva.map((produto) => {
                  const margem = margens.get(produto.chave)
                  return (
                    <TableRow key={produto.chave}>
                      <TableCell className="max-w-48 truncate">{produto.nome}</TableCell>
                      <TableCell>{produto.classe}</TableCell>
                      <TableCell className="text-right tabular-nums">{saiu(produto)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {emReais(produto.faturamento)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {margem === undefined ? "—" : `${porcento.format(margem)}%`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** Produtos: o que vende, quanto rende e o que não sai, no período escolhido. */
export function AbaProdutos({
  pedidos,
  periodo,
  segmento,
  produtos,
  categorias,
}: {
  pedidos: Pedido[]
  periodo: Periodo
  segmento: SegmentoPainelId
  produtos: Produto[]
  categorias: Categoria[]
}) {
  const vendas = useMemo(() => vendasPorProduto(pedidos, periodo), [pedidos, periodo])
  const margem = useMemo(() => margemDoPeriodo(pedidos, periodo), [pedidos, periodo])
  const parados = useMemo(() => semVenda(produtos, vendas), [produtos, vendas])
  const grupos = useMemo(
    () => porCategoria(vendas, produtos, categorias),
    [vendas, produtos, categorias],
  )
  const curva = useMemo(() => curvaABC(vendas), [vendas])
  const opcoes = useMemo(() => opcoesMaisEscolhidas(pedidos, periodo), [pedidos, periodo])
  const cobertura = useMemo(
    () => coberturaDoEstoque(produtos, pedidos, periodo),
    [produtos, pedidos, periodo],
  )
  const ativos = produtos.filter((produto) => produto.ativo).length
  const noPeriodo = `de=${dia(periodo.de)}&ate=${dia(periodo.ate)}`
  // No quilo, conta o peso; o que é vendido por unidade fica à parte.
  const porPeso = temRecurso(segmento, "vendaPorPeso")
  const kg = vendas.reduce((soma, produto) => soma + (produto.kg ?? 0), 0)
  const unidades = vendas.reduce(
    (soma, produto) => soma + (porPeso && produto.kg !== undefined ? 0 : produto.quantidade),
    0,
  )

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Produtos do período">
        <Regua>
          <Indicador rotulo="Produtos vendidos" detalhe={`de ${ativos} no cardápio`}>
            <Numero valor={vendas.length} />
          </Indicador>
          {porPeso ? (
            <Indicador
              rotulo="Kg vendidos"
              detalhe={`e ${plural(unidades, "unidade", "unidades")}`}
            >
              <Numero valor={kg} />
            </Indicador>
          ) : (
            <Indicador rotulo="Unidades vendidas">
              <Numero valor={unidades} />
            </Indicador>
          )}
          <Indicador
            rotulo="Margem"
            detalhe={
              margem.total.receita > 0
                ? `custo em ${porcento.format(margem.cobertura)}% do faturamento`
                : undefined
            }
          >
            {margem.total.receita > 0 ? (
              `${porcento.format(margem.total.percentual)}%`
            ) : (
              <span className="text-base font-normal text-muted-foreground">
                Nenhum produto com custo
              </span>
            )}
          </Indicador>
          <Indicador rotulo="Sem venda" detalhe="ativos no cardápio">
            <Numero valor={parados.length} />
          </Indicador>
        </Regua>
      </Secao>

      <Ranking vendas={vendas} noPeriodo={noPeriodo} />

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao titulo="Por categoria" descricao="Do cardápio">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={grupos.map((grupo) => ({
              ...grupo,
              pedidos: 0,
              total: grupo.faturamento,
              detalhe: `${grupo.quantidade} un.`,
            }))}
          />
        </Secao>
        <Secao titulo="Curva ABC" descricao="A faz 80% do faturamento; B, os 15% seguintes">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={resumoABC(curva).map((classe) => ({
              chave: classe.classe,
              nome: `Classe ${classe.classe}`,
              pedidos: 0,
              total: classe.faturamento,
              percentual: classe.percentual,
              detalhe: plural(classe.produtos, "produto", "produtos"),
            }))}
          />
        </Secao>
      </div>

      <Secao
        titulo="Margem por produto"
        descricao="Faturamento menos o custo, da maior para a menor"
      >
        {margem.porProduto.length > 0 ? (
          <ListaDeFatias
            vazio=""
            itens={margem.porProduto.slice(0, 10).map((produto) => ({
              chave: produto.chave,
              nome: produto.nome,
              pedidos: 0,
              total: produto.margem,
              percentual: produto.percentual,
              detalhe: `vendeu ${emReais(produto.receita)}`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum produto com custo no período.</p>
        )}
        <p className="text-[13px] text-muted-foreground">
          {margem.semCusto.produtos > 0 && margem.porProduto.length > 0 && (
            <>
              {`${plural(margem.semCusto.produtos, "produto sem custo fica", "produtos sem custo ficam")} fora (${emReais(margem.semCusto.faturamento)} vendidos). Os adicionais entram na receita sem custo próprio.`}{" "}
            </>
          )}
          <Link href="/admin/cardapio" className="underline underline-offset-4">
            Informar o custo no cardápio
          </Link>
        </p>
      </Secao>

      {opcoes.length > 0 && (
        <Secao titulo="Adicionais e opções" descricao="As mais escolhidas, por unidade vendida">
          <ul className="grid gap-x-8 border-y border-border/70 sm:grid-cols-2">
            {opcoes.slice(0, 10).map((opcao) => (
              <li
                key={`${opcao.grupo}:${opcao.opcao}`}
                className="flex items-baseline gap-2 border-b border-border/70 py-2.5 text-sm last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
              >
                <span className="truncate font-medium">{opcao.opcao}</span>
                <span className="truncate text-xs text-muted-foreground">{opcao.grupo}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {plural(opcao.vezes, "vez", "vezes")}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {cobertura.length > 0 && (
        <Secao
          titulo="Estoque"
          descricao={`Valor parado: ${emReais(resumoDoEstoque(produtos).valorParado)}`}
        >
          <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
            {cobertura.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{item.nome}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {emQuantidade(item.saldo, item.unidade)}
                </span>
                <span className="w-40 shrink-0 text-right tabular-nums">
                  {item.saldo <= 0
                    ? "Zerado"
                    : item.dias === null
                      ? "Sem venda no período"
                      : item.dias === 0
                        ? "Acaba hoje"
                        : `Acaba em ~${plural(item.dias, "dia", "dias")}`}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/estoque" className="text-[13px] underline underline-offset-4">
            Abrir o estoque
          </Link>
        </Secao>
      )}

      <Secao titulo="Sem venda no período" descricao="Ativos no cardápio">
        <p className="text-sm text-muted-foreground">
          {parados.length === 0
            ? "Todos os produtos ativos venderam."
            : `${parados
                .slice(0, NOMES_SEM_VENDA)
                .map((produto) => produto.nome)
                .join(
                  ", ",
                )}${parados.length > NOMES_SEM_VENDA ? ` e mais ${parados.length - NOMES_SEM_VENDA}` : ""}`}
        </p>
      </Secao>

      <TabelaDeProdutos
        curva={curva}
        margens={new Map(margem.porProduto.map((produto) => [produto.chave, produto.percentual]))}
      />
    </div>
  )
}
