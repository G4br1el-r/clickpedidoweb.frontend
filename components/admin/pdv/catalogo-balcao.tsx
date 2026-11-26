"use client"

import NumberFlow from "@number-flow/react"
import { SearchIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import { type Ref, useMemo, useState } from "react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import { emQuantidade, situacaoEstoque } from "@/lib/admin/regras/estoque"
import { normalizar } from "@/lib/admin/regras/filtro-pedidos"
import { precoDeBalcao } from "@/lib/admin/regras/pdv"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

/**
 * Tantas colunas quanto cabem, cada uma com pelo menos 7,5 rem. O número de colunas por janela não
 * serve aqui: o catálogo divide a tela com a comanda e a barra lateral, e num notebook de 1024 px
 * sobravam 70 px por produto.
 */
const GRADE = "grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2"

/** Categoria do trilho: texto, e a escolhida ganha o traço embaixo. */
const ITEM_TRILHO = cn(
  "relative h-11 shrink-0 rounded-none px-0 text-[13px] text-muted-foreground md:h-9",
  "hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
  "after:scale-x-50 after:opacity-0 after:transition-[opacity,transform] after:duration-200 after:ease-saida",
  "data-[state=on]:after:scale-x-100 data-[state=on]:after:opacity-100",
  "focus-visible:ring-inset",
)

/** Quantas já estão na venda: entra com um pulo pequeno a cada toque. */
function Contador({ quantidade }: { quantidade: number }) {
  const semMovimento = useReducedMotion()
  return (
    <AnimatePresence>
      {quantidade > 0 && (
        <motion.span
          aria-hidden="true"
          initial={semMovimento ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="absolute top-1.5 right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
        >
          <NumberFlow value={quantidade} />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/**
 * Catálogo de balcão (PDV e Garçom): busca, categorias num trilho de texto e os produtos
 * em grade densa com o preço de balcão. Tocar no produto chama `aoTocar`.
 */
export function CatalogoBalcao({
  quantidadeNa,
  aoTocar,
  campoBusca,
}: {
  quantidadeNa: (produtoId: string) => number
  aoTocar: (produto: Produto) => void
  /** Com o campo ligado ao atalho "/", a busca mostra a tecla. */
  campoBusca?: Ref<HTMLInputElement>
}) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { data: produtos } = useProdutos()
  const { data: categorias = [] } = useCategorias()
  const [busca, setBusca] = useState("")
  const [categoria, setCategoria] = useState("todas")

  const vendaveis = useMemo(() => {
    const termo = normalizar(busca).trim()
    const visiveis = new Set(categorias.filter((item) => item.ativa).map((item) => item.id))
    return (produtos ?? []).filter(
      (produto) =>
        produto.ativo &&
        visiveis.has(produto.categoriaId) &&
        (categoria === "todas" || produto.categoriaId === categoria) &&
        (!termo || normalizar(`${produto.nome} ${produto.descricao}`).includes(termo)),
    )
  }, [produtos, categorias, busca, categoria])

  const contagem = (id: string) =>
    (produtos ?? []).filter((produto) => produto.categoriaId === id && produto.ativo).length

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <InputGroup className="h-10">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={campoBusca}
          type="search"
          aria-label="Buscar no cardápio"
          placeholder="Buscar produto"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />
        {campoBusca && (
          <InputGroupAddon align="inline-end" className="max-md:hidden">
            <kbd className="rounded border border-border px-1.5 font-sans text-[11px] text-muted-foreground">
              /
            </kbd>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div className="border-b border-border/70">
        <ToggleGroup
          type="single"
          aria-label="Categoria"
          value={categoria}
          onValueChange={(valor) => valor && setCategoria(valor)}
          spacing={0}
          className="w-full flex-nowrap justify-start gap-5 overflow-x-auto [scrollbar-width:none] data-[spacing=0]:gap-5"
        >
          <ToggleGroupItem value="todas" className={ITEM_TRILHO}>
            Todas
          </ToggleGroupItem>
          {categorias
            .filter((item) => item.ativa)
            .map((item) => (
              <ToggleGroupItem key={item.id} value={item.id} className={cn(ITEM_TRILHO, "gap-1")}>
                {item.nome}
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                  {contagem(item.id)}
                </span>
              </ToggleGroupItem>
            ))}
        </ToggleGroup>
      </div>

      {!produtos ? (
        <div role="status" aria-label="Carregando o cardápio" className={GRADE}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((indice) => (
            <div
              key={indice}
              className="flex flex-col overflow-hidden rounded-xl ring-1 ring-border/60"
            >
              <Skeleton className="h-20 rounded-none" />
              <div className="flex flex-col gap-2 p-2.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : vendaveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-balance text-muted-foreground">
          {busca.trim()
            ? `Nada com “${busca.trim()}”. Confira a escrita ou lance como item avulso.`
            : "Nenhum produto à venda nesta categoria."}
        </p>
      ) : (
        <ul aria-label="Produtos" className={GRADE}>
          {vendaveis.map((produto) => {
            const quantidade = quantidadeNa(produto.id)
            const pouco =
              produto.disponivel &&
              produto.estoque?.controlar &&
              situacaoEstoque(produto.estoque) === "baixo"
            return (
              <li key={produto.id}>
                <button
                  type="button"
                  disabled={!produto.disponivel}
                  onClick={() => aoTocar(produto)}
                  className={cn(
                    "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-border/80 outline-none",
                    "transition-[transform,box-shadow] duration-150 ease-saida hover:ring-foreground/25 active:scale-[0.97]",
                    "focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 motion-reduce:transition-none",
                    quantidade > 0 && "ring-foreground/40",
                  )}
                >
                  {produto.imagem ? (
                    <Image
                      src={produto.imagem}
                      alt=""
                      width={240}
                      height={140}
                      unoptimized={produto.imagem.startsWith("data:")}
                      className="h-20 w-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-20 items-center justify-center bg-foreground/[0.04] text-xl font-semibold text-muted-foreground"
                    >
                      {produto.nome.charAt(0)}
                    </span>
                  )}
                  <span className="flex flex-1 flex-col gap-1 p-2.5">
                    <span className="line-clamp-2 text-[13px] leading-snug font-medium">
                      {/* O nome falado começa pelo que se vê: "Adicionar" só para leitor de tela. */}
                      <span className="sr-only">Adicionar </span>
                      {produto.nome}
                    </span>
                    <span className="mt-auto text-[13px] font-semibold tabular-nums">
                      {emReais(precoDeBalcao(produto, segmento))}
                      {produto.grupos.length > 0 && (
                        <span className="font-normal text-muted-foreground"> +</span>
                      )}
                    </span>
                  </span>
                  <Contador quantidade={quantidade} />
                  {!produto.disponivel && (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-md bg-card/95 px-1.5 py-0.5 text-[11px] font-medium">
                      <Traco tom="cancelado" className="h-3" />
                      Esgotado
                    </span>
                  )}
                  {pouco && produto.estoque && (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-md bg-card/95 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
                      <Traco tom="preparo" className="h-3" />
                      Restam{" "}
                      {produto.unidade === "kg"
                        ? emQuantidade(produto.estoque.quantidade, "kg")
                        : produto.estoque.quantidade}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
