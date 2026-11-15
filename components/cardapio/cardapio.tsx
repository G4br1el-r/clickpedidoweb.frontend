"use client"

import { SearchXIcon } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ProdutoSheet } from "@/components/produto/produto-sheet"
import { BarraSacola } from "@/components/sacola/barra-sacola"
import { IlhaSacola } from "@/components/sacola/ilha-sacola"
import { VooParaSacola } from "@/components/sacola/voo-para-sacola"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useCardapio } from "@/hooks/use-cardapio"
import { useValorAssentado } from "@/hooks/use-valor-assentado"
import { plural } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { textoDeBusca } from "@/lib/produto"
import { textosDoSegmento } from "@/lib/segmentos"
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
/** Quanto uma categoria precisa ficar sob a barra, rolando, para virar a ativa. */
const ESPERA_CATEGORIA_MS = 200
const EVENTOS_ROLAGEM = ["wheel", "touchmove", "keydown"] as const

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

export function Cardapio() {
  const lojaEscolhida = useLoja()
  const router = useRouter()
  const { data: categorias } = useCardapio()

  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null)
  const [painelProdutoAberto, setPainelProdutoAberto] = useState(false)
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [buscando, setBuscando] = useState(false)
  // A barra de categorias grudada no topo: no celular, as ações descem para a barra de baixo.
  const [grudada, setGrudada] = useState(false)
  const [termo, setTermo] = useState("")
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  // Rolando, a categoria sob a barra troca a cada seção que passa. Categorias curtas (a farmácia
  // tem três itens por seção) passam em menos de um quarto de segundo: só a que fica é marcada,
  // e a pílula vai direto para ela, sem piscar nas do meio.
  const [ativaNaRolagem, setAtivaNaRolagem] = useState<string | null>(null)
  const ativaAssentada = useValorAssentado(ativaNaRolagem, ESPERA_CATEGORIA_MS)
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
          textoDeBusca(produto).includes(termoNormalizado),
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
    // Ao trocar de loja, a ativa da loja anterior não existe aqui: volta para a primeira.
    setCategoriaAtiva((atual) =>
      atual && categorias.some(({ id }) => id === atual) ? atual : (categorias[0]?.id ?? null),
    )
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
      setAtivaNaRolagem(ativa)
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

  useEffect(() => {
    if (ativaAssentada && !rolagemPorClique.current) setCategoriaAtiva(ativaAssentada)
  }, [ativaAssentada])

  function irParaCategoria(id: string) {
    // O clique marca na hora; a rolagem que ele causa não muda a escolha.
    setCategoriaAtiva(id)
    setAtivaNaRolagem(id)
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
        aoGrudar={setGrudada}
      />
      {/* Com busca ativa, a lista não encolhe abaixo da tela: a barra continua grudada. */}
      <div className={cn("mx-auto w-full max-w-[1120px]", termoNormalizado && "min-h-dvh")}>
        <div className="min-w-0">
          <main>
            {!categorias ? (
              <CardapioSkeleton />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex flex-col gap-10 pt-7 md:gap-14 md:pt-10"
              >
                {termoNormalizado && (
                  <p aria-live="polite" className="px-4 text-sm text-muted-foreground md:px-6">
                    {plural(totalResultados, "resultado", "resultados")}
                  </p>
                )}

                {categoriasVisiveis.length === 0 ? (
                  <Empty className="px-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchXIcon />
                      </EmptyMedia>
                      <EmptyTitle>Nada encontrado para "{termo.trim()}"</EmptyTitle>
                      <EmptyDescription>
                        {textosDoSegmento(lojaEscolhida.segmento).buscaVazia}
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button type="button" variant="outline" size="cta" onClick={() => setTermo("")}>
                      Limpar busca
                    </Button>
                  </Empty>
                ) : (
                  categoriasVisiveis.map((categoria, indice) => (
                    <Fragment key={categoria.id}>
                      <section
                        id={`categoria-${categoria.id}`}
                        ref={(elemento) => {
                          if (elemento) refsSecoes.current.set(categoria.id, elemento)
                          else refsSecoes.current.delete(categoria.id)
                        }}
                        aria-labelledby={`titulo-${categoria.id}`}
                        className="scroll-mt-[80px] px-4 md:px-6"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <h2
                            id={`titulo-${categoria.id}`}
                            className="text-lg font-semibold tracking-[-0.015em] md:text-xl"
                          >
                            {categoria.nome}
                          </h2>
                          <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                            {plural(categoria.produtos.length, "opção", "opções")}
                          </span>
                        </div>
                        {/* Sem cartões: as linhas se separam por um fio; em duas colunas do tablet em diante. */}
                        <ul
                          className="mt-1 grid grid-cols-1 md:grid-cols-2 md:gap-x-10"
                          data-testid="grade-produtos"
                        >
                          {categoria.produtos.map((produto) => (
                            <li key={produto.id} className="border-b border-border/70">
                              <ProdutoLinha
                                produto={produto}
                                aoAbrir={() => abrirProduto(produto)}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                      {/* O cardápio abre a página; os banners e os mais pedidos vêm depois da primeira categoria. */}
                      {indice === 0 && !termoNormalizado && (
                        <>
                          {lojaEscolhida.banners && (
                            <BannersLoja
                              banners={lojaEscolhida.banners}
                              produtoDoBanner={produtoDoBanner}
                              aoEscolher={escolherBanner}
                            />
                          )}
                          {destaques.length > 0 && (
                            <MaisPedidas produtos={destaques} aoAbrir={abrirProduto} />
                          )}
                        </>
                      )}
                    </Fragment>
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
      <BarraSacola
        oculta={painelProdutoAberto}
        grudada={grudada}
        buscando={buscando}
        termo={termo}
        aoAlternarBusca={alternarBusca}
        aoVerDetalhes={() => setDetalhesAbertos(true)}
      />

      <VooParaSacola />
    </div>
  )
}
