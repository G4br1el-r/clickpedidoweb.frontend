"use client"

import { PlusIcon, SearchIcon, SearchXIcon, TagsIcon } from "lucide-react"
import { AnimatePresence, useIsPresent } from "motion/react"
import Link from "next/link"
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Categoria, Produto } from "@/lib/admin/dados/tipos"
import { contarSituacoes, filtrarProdutos, type Situacao } from "@/lib/admin/regras/cardapio"
import { estadoDaMarcaGeral, marcadosVisiveis } from "@/lib/admin/regras/lote-cardapio"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temRecurso, tituloDoModulo } from "@/lib/admin/segmentos-painel"
import { plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { FaixaRolavel } from "../faixa-rolavel"
import { BlocoEntrando } from "../movimento/entrada-admin"
import { AtualizandoLista } from "./atualizando-lista"
import { BarraDeLoteCardapio } from "./barra-de-lote-cardapio"
import { EsqueletoCardapio } from "./esqueletos-cardapio"
import { FormularioProduto } from "./formulario-produto"
import { LinhaProduto } from "./linha-produto"
import { useLoteCardapio } from "./use-lote-cardapio"

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

/**
 * Uma categoria da lista. Direta no `AnimatePresence`: quando o filtro esvazia a categoria,
 * ela some com um fade e, nesse meio tempo, já não conta para o leitor de tela.
 */
function SecaoDaCategoria({
  categoria,
  produtos,
  mostrarBalcao,
  marcados,
  aoMarcar,
  aoEditar,
}: {
  categoria: Categoria
  produtos: Produto[]
  mostrarBalcao: boolean
  marcados: ReadonlySet<string>
  aoMarcar: (id: string) => void
  aoEditar: (id: string) => void
}) {
  const presente = useIsPresent()
  return (
    // Listas longas (a adega tem 255 produtos): o navegador só desenha o que aparece.
    <BlocoEntrando
      como="section"
      aria-label={`${categoria.nome}, ${plural(produtos.length, "produto", "produtos")}`}
      aria-hidden={presente ? undefined : true}
      className="flex flex-col [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
    >
      <div className="flex items-baseline gap-2.5 border-b border-border/70 pb-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{categoria.nome}</h2>
        <span className="text-[13px] text-muted-foreground tabular-nums">{produtos.length}</span>
        {!categoria.ativa && (
          <span className="text-[13px] text-muted-foreground">· Categoria oculta no cardápio</span>
        )}
      </div>
      {/* A linha decide o layout pelo espaço da lista, não pela janela: com a lateral aberta, o tablet tem pouco espaço. */}
      <ul className="@container flex flex-col divide-y divide-border/70">
        <AnimatePresence>
          {produtos.map((produto, indice) => (
            <LinhaProduto
              key={produto.id}
              produto={produto}
              indice={indice}
              mostrarBalcao={mostrarBalcao}
              marcado={marcados.has(produto.id)}
              aoMarcar={() => aoMarcar(produto.id)}
              aoEditar={() => aoEditar(produto.id)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </BlocoEntrando>
  )
}

/** Cardápio da loja: produtos por categoria, com busca, filtros e ações na própria linha. */
export function PaginaCardapio() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: produtos, isFetching } = useProdutos()
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
  const lote = useLoteCardapio()
  const marcadosNaLista = useMemo(
    () => marcadosVisiveis(lote.marcados, filtrados),
    [lote.marcados, filtrados],
  )
  const idsVisiveis = useMemo(() => filtrados.map((produto) => produto.id), [filtrados])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo={tituloDoModulo("cardapio", segmento)}
        resumo="Edite o preço direto na linha: Enter salva, Esc desfaz. Marque vários produtos para mudar de uma vez."
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
        <FaixaRolavel className="-mx-4 px-4 md:mx-0 md:px-0">
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
        </FaixaRolavel>
      </div>

      {!produtos || !categorias ? (
        <EsqueletoCardapio />
      ) : filtrados.length === 0 ? (
        <BlocoEntrando>
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
        </BlocoEntrando>
      ) : (
        <div className="relative flex flex-col gap-4">
          <AtualizandoLista atualizando={isFetching} rotulo="Atualizando o cardápio" />
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="marcar-todos-cardapio"
              className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-8"
            >
              <Checkbox
                id="marcar-todos-cardapio"
                aria-label="Marcar todos os visíveis"
                checked={estadoDaMarcaGeral(lote.marcados, idsVisiveis)}
                onCheckedChange={(marcar) => lote.marcarTodos(idsVisiveis, marcar === true)}
                className="max-md:size-5"
              />
              Marcar todos os visíveis
            </label>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {plural(filtrados.length, "produto", "produtos")}
            </span>
          </div>
          <div className="flex flex-col gap-8">
            <AnimatePresence>
              {categorias.map((categoria) => {
                const daCategoria = filtrados.filter(
                  (produto) => produto.categoriaId === categoria.id,
                )
                if (daCategoria.length === 0) return null
                return (
                  <SecaoDaCategoria
                    key={categoria.id}
                    categoria={categoria}
                    produtos={daCategoria}
                    mostrarBalcao={mostrarBalcao}
                    marcados={lote.marcados}
                    aoMarcar={lote.marcar}
                    aoEditar={abrirProduto}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <BarraDeLoteCardapio
        selecionados={marcadosNaLista}
        aoAplicar={lote.aplicar}
        aoLimpar={lote.limpar}
        aplicando={lote.aplicando}
      />

      <FormularioProduto />
    </div>
  )
}
