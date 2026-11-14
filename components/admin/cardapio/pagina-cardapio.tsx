"use client"

import { PlusIcon, SearchIcon, SearchXIcon, TagsIcon } from "lucide-react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { contarSituacoes, filtrarProdutos, type Situacao } from "@/lib/admin/regras/cardapio"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temRecurso, tituloDoModulo } from "@/lib/admin/segmentos-painel"
import { FormularioProduto } from "./formulario-produto"
import { LinhaProduto } from "./linha-produto"

const SITUACOES: { id: Situacao; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "disponiveis", rotulo: "Disponíveis" },
  { id: "esgotados", rotulo: "Esgotados" },
  { id: "ocultos", rotulo: "Ocultos" },
  { id: "destaques", rotulo: "Destaques" },
  { id: "ofertas", rotulo: "Ofertas" },
]

const PARAMETROS = {
  busca: parseAsString.withDefault(""),
  categoria: parseAsString,
  situacao: parseAsStringLiteral(SITUACOES.map((situacao) => situacao.id)).withDefault("todos"),
}

/** Produto aberto no formulário: `?produto=novo` ou o id. */
export function useProdutoAberto() {
  return useQueryState("produto", parseAsString.withOptions({ history: "push" }))
}

/** Cardápio da loja: produtos por categoria, com busca, filtros e ações na própria linha. */
export function PaginaCardapio() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: produtos } = useProdutos()
  const { data: categorias } = useCategorias()
  const [filtros, setFiltros] = useQueryStates(PARAMETROS)
  const [, abrirProduto] = useProdutoAberto()
  const mostrarBalcao = temRecurso(segmento, "precoBalcao")

  const filtrados = useMemo(
    () =>
      produtos
        ? filtrarProdutos(produtos, {
            busca: filtros.busca,
            categoriaId: filtros.categoria,
            situacao: filtros.situacao,
          })
        : [],
    [produtos, filtros.busca, filtros.categoria, filtros.situacao],
  )
  const contagem = useMemo(() => contarSituacoes(produtos ?? []), [produtos])
  const limpar = () => setFiltros({ busca: null, categoria: null, situacao: null })

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tituloDoModulo("cardapio", segmento)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Edite o preço direto na linha. Enter salva, Esc desfaz.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/categorias">
              <TagsIcon data-icon="inline-start" />
              Categorias
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => abrirProduto("novo")}>
            <PlusIcon data-icon="inline-start" />
            Novo produto
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <InputGroup className="lg:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Buscar produto"
            placeholder="Nome ou descrição"
            value={filtros.busca}
            onChange={(evento) => setFiltros({ busca: evento.target.value || null })}
          />
        </InputGroup>
        <Select
          value={filtros.categoria ?? "todas"}
          onValueChange={(valor) => setFiltros({ categoria: valor === "todas" ? null : valor })}
        >
          <SelectTrigger aria-label="Categoria" className="lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias?.map((categoria) => (
                <SelectItem key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Situação"
        value={filtros.situacao}
        onValueChange={(valor) => valor && setFiltros({ situacao: valor as Situacao })}
        className="flex-wrap justify-start"
      >
        {SITUACOES.map(({ id, rotulo }) => (
          <ToggleGroupItem key={id} value={id} className="cursor-pointer gap-1.5">
            {rotulo}
            <span className="text-xs tabular-nums text-muted-foreground">{contagem[id]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {!produtos || !categorias ? (
        <div role="status" aria-label="Carregando o cardápio" className="flex flex-col gap-3">
          {[0, 1, 2].map((indice) => (
            <Skeleton key={indice} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum produto com esses filtros</EmptyTitle>
            <EmptyDescription>Mude a busca ou os filtros.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" size="sm" onClick={limpar}>
              Limpar filtros
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {categorias.map((categoria) => {
            const daCategoria = filtrados.filter((produto) => produto.categoriaId === categoria.id)
            if (daCategoria.length === 0) return null
            return (
              // Listas longas (a adega tem 255 produtos): o navegador só desenha o que aparece.
              <section
                key={categoria.id}
                aria-labelledby={`categoria-${categoria.id}`}
                className="overflow-hidden rounded-xl border bg-card [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
              >
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <h2 id={`categoria-${categoria.id}`} className="font-semibold">
                    {categoria.nome}
                  </h2>
                  <Badge variant="secondary" className="tabular-nums">
                    {daCategoria.length}
                  </Badge>
                  {!categoria.ativa && <Badge variant="outline">Categoria oculta</Badge>}
                </div>
                <ul className="divide-y">
                  {daCategoria.map((produto) => (
                    <LinhaProduto
                      key={produto.id}
                      produto={produto}
                      mostrarBalcao={mostrarBalcao}
                      aoEditar={() => abrirProduto(produto.id)}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <FormularioProduto />
    </div>
  )
}
