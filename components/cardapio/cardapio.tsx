"use client"

import { SearchXIcon } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { EntradaAoRolar } from "@/components/entrada"
import { ProdutoSheet } from "@/components/produto/produto-sheet"
import { BarraSacola } from "@/components/sacola/barra-sacola"
import { IlhaSacola } from "@/components/sacola/ilha-sacola"
import { VooParaSacola } from "@/components/sacola/voo-para-sacola"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useCardapio } from "@/hooks/use-cardapio"
import { clienteAtual } from "@/lib/cliente"
import { plural } from "@/lib/formato"
import type { Banner, Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { BannersLoja } from "./banners-loja"
import { BarraNavegacao } from "./barra-navegacao"
import { CabecalhoLoja } from "./cabecalho-loja"
import { CardapioSkeleton } from "./cardapio-skeleton"
import { DetalhesLoja } from "./detalhes-loja"
import { MaisPedidas } from "./mais-pedidas"
import { ProdutoLinha } from "./produto-itens"
import { RodapeLoja } from "./rodape-loja"

const ALTURA_BARRA = 66
const EVENTOS_ROLAGEM = ["wheel", "touchmove", "keydown"] as const

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

export function Cardapio() {
  const router = useRouter()
  const { data: categorias } = useCardapio()

  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null)
  const [painelProdutoAberto, setPainelProdutoAberto] = useState(false)
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [termo, setTermo] = useState("")
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const refsSecoes = useRef(new Map<string, HTMLElement>())
  const rolagemPorClique = useRef(false)

  const destaques = useMemo(
    () => categorias?.flatMap((c) => c.produtos.filter((p) => p.destaque)) ?? [],
    [categorias],
  )

  const termoNormalizado = normalizar(termo.trim())
  const categoriasVisiveis = useMemo(() => {
    if (!categorias) return []
    if (!termoNormalizado) return categorias
    return categorias
      .map((categoria) => ({
        ...categoria,
        produtos: categoria.produtos.filter((produto) =>
          normalizar(`${produto.nome} ${produto.descricao}`).includes(termoNormalizado),
        ),
      }))
      .filter((categoria) => categoria.produtos.length > 0)
  }, [categorias, termoNormalizado])
  const totalResultados = categoriasVisiveis.reduce((soma, c) => soma + c.produtos.length, 0)

  // Produto anterior e próximo na ordem em que aparecem no cardápio (respeitando a busca).
  const vizinhos = useMemo(() => {
    const ordem = categoriasVisiveis.flatMap((categoria) => categoria.produtos)
    const indice = produtoAberto ? ordem.findIndex(({ id }) => id === produtoAberto.id) : -1
    if (indice < 0) return {}
    return { anterior: ordem[indice - 1], proximo: ordem[indice + 1] }
  }, [categoriasVisiveis, produtoAberto])

  // Marca a última seção cujo topo já passou da barra. No fim da página, a última seção
  // pode não chegar ao topo; se ela já está inteira à vista, é ela que fica marcada.
  useEffect(() => {
    if (!categorias) return
    setCategoriaAtiva((atual) => atual ?? categorias[0]?.id ?? null)
    let quadro = 0
    const atualizar = () => {
      quadro = 0
      if (rolagemPorClique.current) return
      const ordem = categoriasVisiveis.flatMap(({ id }) => {
        const secao = refsSecoes.current.get(id)
        return secao ? [{ id, caixa: secao.getBoundingClientRect() }] : []
      })
      if (ordem.length === 0) return
      const limite = ALTURA_BARRA + 120
      let ativa = ordem[0].id
      for (const { id, caixa } of ordem) if (caixa.top <= limite) ativa = id
      const noFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (noFim) ativa = ordem[ordem.length - 1].id
      setCategoriaAtiva(ativa)
    }
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar)
    }
    window.addEventListener("scroll", agendar, { passive: true })
    window.addEventListener("resize", agendar)
    return () => {
      window.removeEventListener("scroll", agendar)
      window.removeEventListener("resize", agendar)
      cancelAnimationFrame(quadro)
    }
  }, [categorias, categoriasVisiveis])

  function irParaCategoria(id: string) {
    setCategoriaAtiva(id)
    rolagemPorClique.current = true
    const secao = refsSecoes.current.get(id)
    // Rola só a página: no celular, scrollIntoView também desloca a área visível e esconde parte da barra.
    if (secao) {
      const destino = secao.getBoundingClientRect().top + window.scrollY - ALTURA_BARRA - 12
      window.scrollTo({ top: Math.max(0, destino) })
    }
    // A categoria escolhida fica marcada até a próxima rolagem feita pela pessoa,
    // mesmo quando a tela é alta demais para a seção chegar ao topo.
    const liberar = () => {
      rolagemPorClique.current = false
      for (const evento of EVENTOS_ROLAGEM) window.removeEventListener(evento, liberar)
    }
    for (const evento of EVENTOS_ROLAGEM) {
      window.addEventListener(evento, liberar, { once: true, passive: true })
    }
  }

  function abrirProduto(produto: Produto) {
    setProdutoAberto(produto)
    setPainelProdutoAberto(true)
  }

  function produtoDoBanner(banner: Banner) {
    if (banner.acao.tipo !== "produto") return undefined
    const { produtoId } = banner.acao
    return categorias?.flatMap((c) => c.produtos).find((produto) => produto.id === produtoId)
  }

  function escolherBanner(banner: Banner) {
    if (banner.acao.tipo === "categoria") {
      irParaCategoria(banner.acao.categoriaId)
      return
    }
    const produto = produtoDoBanner(banner)
    if (produto) abrirProduto(produto)
  }

  function irParaFinalizar() {
    router.push("/finalizar")
  }

  function alternarBusca(ativo: boolean) {
    setBuscando(ativo)
    if (!ativo) setTermo("")
  }

  return (
    <div className="relative min-h-dvh w-full bg-background">
      <CabecalhoLoja
        aoVerDetalhes={() => setDetalhesAbertos(true)}
        termo={termo}
        aoBuscar={setTermo}
      />
      <BarraNavegacao
        categorias={categorias ?? []}
        ativa={categoriaAtiva}
        aoEscolher={irParaCategoria}
        buscando={buscando}
        aoAlternarBusca={alternarBusca}
        termo={termo}
        aoBuscar={setTermo}
        aoVerDetalhes={() => setDetalhesAbertos(true)}
        aoRecolherBusca={() => setBuscando(false)}
      />
      {/* Com busca ativa, a lista não encolhe abaixo da tela: a barra continua grudada. */}
      <div
        className={cn(
          "mx-auto w-full max-w-[1320px] 2xl:max-w-[1640px]",
          termoNormalizado && "min-h-dvh",
        )}
      >
        <div className="min-w-0">
          <main>
            {!categorias ? (
              <CardapioSkeleton />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex flex-col gap-8 pt-6 md:gap-10 md:pt-8"
              >
                {termoNormalizado && (
                  <p aria-live="polite" className="px-4 text-sm text-muted-foreground md:px-6">
                    {plural(totalResultados, "resultado", "resultados")}
                  </p>
                )}

                {!termoNormalizado && clienteAtual.banners && (
                  <BannersLoja
                    banners={clienteAtual.banners}
                    produtoDoBanner={produtoDoBanner}
                    aoEscolher={escolherBanner}
                  />
                )}

                {!termoNormalizado && destaques.length > 0 && (
                  <MaisPedidas produtos={destaques} aoAbrir={abrirProduto} />
                )}

                {categoriasVisiveis.length === 0 ? (
                  <Empty className="px-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchXIcon />
                      </EmptyMedia>
                      <EmptyTitle>Nada encontrado para "{termo.trim()}"</EmptyTitle>
                      <EmptyDescription>Tente buscar por outro sabor ou produto.</EmptyDescription>
                    </EmptyHeader>
                    <Button type="button" variant="outline" size="cta" onClick={() => setTermo("")}>
                      Limpar busca
                    </Button>
                  </Empty>
                ) : (
                  categoriasVisiveis.map((categoria) => (
                    <section
                      key={categoria.id}
                      id={`categoria-${categoria.id}`}
                      ref={(elemento) => {
                        if (elemento) refsSecoes.current.set(categoria.id, elemento)
                        else refsSecoes.current.delete(categoria.id)
                      }}
                      aria-labelledby={`titulo-${categoria.id}`}
                      className="scroll-mt-[80px] px-4 md:px-6"
                    >
                      <EntradaAoRolar atraso={0.08}>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="h-7 w-1.5 shrink-0 rounded-full bg-marca-acento md:h-8"
                          />
                          <h2
                            id={`titulo-${categoria.id}`}
                            className="text-2xl font-extrabold tracking-tight md:text-3xl"
                          >
                            {categoria.nome}
                          </h2>
                          <span
                            aria-hidden="true"
                            className="h-px min-w-6 flex-1 bg-linear-to-r from-border to-transparent"
                          />
                          <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground tabular-nums">
                            {plural(categoria.produtos.length, "opção", "opções")}
                          </span>
                        </div>
                      </EntradaAoRolar>
                      <ul
                        className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3"
                        data-testid="grade-produtos"
                      >
                        {categoria.produtos.map((produto, indice) => (
                          <li key={produto.id}>
                            <EntradaAoRolar
                              atraso={0.14 + Math.min(indice, 4) * 0.06}
                              className="h-full"
                            >
                              <ProdutoLinha
                                produto={produto}
                                aoAbrir={() => abrirProduto(produto)}
                              />
                            </EntradaAoRolar>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </motion.div>
            )}
          </main>
        </div>
      </div>

      <RodapeLoja />

      <ProdutoSheet
        produto={produtoAberto}
        aberto={painelProdutoAberto}
        aoMudar={setPainelProdutoAberto}
        anterior={vizinhos.anterior}
        proximo={vizinhos.proximo}
        aoNavegar={setProdutoAberto}
      />
      <DetalhesLoja aberto={detalhesAbertos} aoMudar={setDetalhesAbertos} />
      <IlhaSacola aoContinuar={irParaFinalizar} />
      <BarraSacola oculta={painelProdutoAberto} />

      <VooParaSacola />
    </div>
  )
}
