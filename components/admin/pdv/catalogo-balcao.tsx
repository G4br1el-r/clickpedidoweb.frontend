"use client"

import { SearchIcon } from "lucide-react"
import Image from "next/image"
import { type Ref, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
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

/**
 * Catálogo de balcão (PDV e Garçom): busca, categorias e os cartões dos produtos
 * com o preço de balcão. Tocar no cartão chama `aoTocar`.
 */
export function CatalogoBalcao({
  quantidadeNa,
  aoTocar,
  campoBusca,
}: {
  quantidadeNa: (produtoId: string) => number
  aoTocar: (produto: Produto) => void
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
    <>
      <InputGroup>
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
      </InputGroup>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Categoria"
        value={categoria}
        onValueChange={(valor) => valor && setCategoria(valor)}
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
        {categorias
          .filter((item) => item.ativa)
          .map((item) => (
            <ToggleGroupItem key={item.id} value={item.id} className="gap-1.5">
              {item.nome}
              <span className="text-xs tabular-nums text-muted-foreground">
                {contagem(item.id)}
              </span>
            </ToggleGroupItem>
          ))}
      </ToggleGroup>

      {!produtos ? (
        <div
          role="status"
          aria-label="Carregando o cardápio"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {[0, 1, 2, 3, 4, 5].map((indice) => (
            <Skeleton key={indice} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul aria-label="Produtos" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {vendaveis.map((produto) => {
            const quantidade = quantidadeNa(produto.id)
            return (
              <li key={produto.id}>
                <button
                  type="button"
                  disabled={!produto.disponivel}
                  onClick={() => aoTocar(produto)}
                  className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left transition-[transform,box-shadow] duration-150 ease-out hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {produto.imagem ? (
                    <Image
                      src={produto.imagem}
                      alt=""
                      width={240}
                      height={140}
                      unoptimized={produto.imagem.startsWith("data:")}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-24 items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground"
                    >
                      {produto.nome.charAt(0)}
                    </span>
                  )}
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-sm font-medium">
                      {/* O nome falado começa pelo que se vê: "Adicionar" só para leitor de tela. */}
                      <span className="sr-only">Adicionar </span>
                      {produto.nome}
                    </span>
                    <span className="mt-auto text-sm tabular-nums text-muted-foreground">
                      {emReais(precoDeBalcao(produto, segmento))}
                      {produto.grupos.length > 0 && " +"}
                    </span>
                  </span>
                  {quantidade > 0 && (
                    <Badge className="absolute top-2 right-2 tabular-nums" aria-hidden="true">
                      {quantidade}
                    </Badge>
                  )}
                  {!produto.disponivel && (
                    <Badge variant="secondary" className="absolute top-2 left-2">
                      Esgotado
                    </Badge>
                  )}
                  {produto.disponivel &&
                    produto.estoque?.controlar &&
                    situacaoEstoque(produto.estoque) === "baixo" && (
                      <Badge variant="secondary" className="absolute top-2 left-2 tabular-nums">
                        Restam{" "}
                        {produto.unidade === "kg"
                          ? emQuantidade(produto.estoque.quantidade, "kg")
                          : produto.estoque.quantidade}
                      </Badge>
                    )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
