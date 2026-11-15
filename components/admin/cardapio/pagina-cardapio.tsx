"use client"

import { PlusIcon, SearchIcon, SearchXIcon, TagsIcon } from "lucide-react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"
import { useMemo } from "react"
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
import { plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
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

/** Esqueleto no formato da lista: cabeçalho da categoria e linhas finas. */
function EsqueletoCardapio() {
  return (
    <div role="status" aria-label="Carregando o cardápio" className="flex flex-col gap-8">
      {[5, 3].map((linhas) => (
        <div key={linhas} className="flex flex-col">
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
            {Array.from({ length: linhas }, (_, linha) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo, sem reordenar.
              <div key={linha} className="flex items-center gap-3 py-2.5">
                <Skeleton className="size-10 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="hidden h-8 w-28 sm:block" />
                <Skeleton className="hidden h-5 w-44 md:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
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
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo={tituloDoModulo("cardapio", segmento)}
        resumo="Edite o preço direto na linha. Enter salva, Esc desfaz."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="max-md:h-11">
              <Link href="/admin/categorias">
                <TagsIcon data-icon="inline-start" />
                Categorias
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="active:scale-[0.97] max-md:h-11"
              onClick={() => abrirProduto("novo")}
            >
              <PlusIcon data-icon="inline-start" />
              Novo produto
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
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
        {/* No celular o controle rola de lado dentro da própria faixa; a página não. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <ToggleGroup
            type="single"
            variant="segmento"
            size="sm"
            aria-label="Situação"
            value={filtros.situacao}
            onValueChange={(valor) => valor && setFiltros({ situacao: valor as Situacao })}
          >
            {SITUACOES.map(({ id, rotulo }) => (
              <ToggleGroupItem
                key={id}
                value={id}
                className="cursor-pointer gap-1.5 px-2.5 max-md:h-10"
              >
                {rotulo}
                <span className="text-xs text-muted-foreground tabular-nums">{contagem[id]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {!produtos || !categorias ? (
        <EsqueletoCardapio />
      ) : filtrados.length === 0 ? (
        <Empty className="border-t border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum produto com esses filtros</EmptyTitle>
            <EmptyDescription>
              A busca olha o nome e a descrição. Mude a busca, a categoria ou a situação.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" size="sm" onClick={limpar}>
              Limpar filtros
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {categorias.map((categoria) => {
            const daCategoria = filtrados.filter((produto) => produto.categoriaId === categoria.id)
            if (daCategoria.length === 0) return null
            return (
              // Listas longas (a adega tem 255 produtos): o navegador só desenha o que aparece.
              <section
                key={categoria.id}
                aria-label={`${categoria.nome}, ${plural(daCategoria.length, "produto", "produtos")}`}
                className="flex flex-col [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
              >
                <div className="flex items-baseline gap-2.5 border-b border-border/70 pb-2.5">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{categoria.nome}</h2>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {daCategoria.length}
                  </span>
                  {!categoria.ativa && (
                    <span className="text-[13px] text-muted-foreground">
                      · Categoria oculta no cardápio
                    </span>
                  )}
                </div>
                {/* A linha decide o layout pelo espaço da lista, não pela janela: com a lateral aberta, o tablet tem pouco espaço. */}
                <ul className="@container flex flex-col divide-y divide-border/70">
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
