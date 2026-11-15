"use client"

import {
  BikeIcon,
  ClockIcon,
  GiftIcon,
  MessageCircleIcon,
  MoonIcon,
  ReceiptTextIcon,
  SearchIcon,
  Share2Icon,
  StarIcon,
  StoreIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { Bloco, Config, Disposicao } from "@/lib/admin/config"
import { nomeDoBloco } from "@/lib/admin/config"
import { clienteAtual } from "@/lib/cliente"
import { emReais, plural } from "@/lib/formato"
import { cardapioCasaDaPizza } from "@/lib/mock/casa-da-pizza"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { BotaoMais, CardProduto } from "./cards-produto"
import {
  EfeitoAdicionar,
  Entrada,
  IconeSacolaPrevia,
  ImagemLoja,
  TituloSecao,
  useConfigAtual,
  useDemoAtiva,
  useImagensLoja,
} from "./comum"
import { usePrevia } from "./estado"
import { classeBotao, ESPACO } from "./estilos"

const todosProdutos = cardapioCasaDaPizza.flatMap((categoria) => categoria.produtos)

const ALTURA_BANNER = {
  baixo: "h-[200px] @3xl/tela:h-[240px]",
  padrao: "h-[260px] @3xl/tela:h-[320px]",
  alto: "h-[340px] @3xl/tela:h-[420px]",
} as const

const COLUNAS_CELULAR = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const
const COLUNAS_COMPUTADOR = {
  1: "@3xl/tela:grid-cols-1",
  2: "@3xl/tela:grid-cols-2",
  3: "@3xl/tela:grid-cols-3",
  4: "@3xl/tela:grid-cols-4",
} as const
const LARGURA_CARROSSEL_CELULAR = {
  1: "w-[78%]",
  2: "w-[46%]",
  3: "w-[31%]",
  4: "w-[23.5%]",
} as const
const LARGURA_CARROSSEL_COMPUTADOR = {
  1: "@3xl/tela:w-[60%]",
  2: "@3xl/tela:w-[48%]",
  3: "@3xl/tela:w-[31.5%]",
  4: "@3xl/tela:w-[23.5%]",
} as const

/* ------------------------------------------------------------------ */

function AcoesTopo({ config, sobreFoto }: { config: Config; sobreFoto: boolean }) {
  const botao = cn(
    "grid size-9 place-items-center rounded-full",
    sobreFoto ? "text-white hover:bg-white/15" : "text-foreground hover:bg-muted",
  )
  return (
    <div className="flex items-center gap-1">
      <span className={botao}>
        <StoreIcon className="size-[18px]" />
      </span>
      {config.recursos.compartilhar && (
        <span className={botao}>
          <Share2Icon className="size-[18px]" />
        </span>
      )}
      {config.recursos.alternarTema && (
        <span className={botao}>
          <MoonIcon className="size-[18px]" />
        </span>
      )}
      <span
        className={cn(
          "ml-1 flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold",
          sobreFoto ? "bg-white text-neutral-900 shadow-lg shadow-black/25" : "bg-secondary",
        )}
      >
        <ReceiptTextIcon className="size-4" />
        Pedidos
      </span>
      <span className="ml-1">
        <IconeSacolaPrevia sobreFoto={sobreFoto} />
      </span>
    </div>
  )
}

function Logo({ config, logo, className }: { config: Config; logo: string; className?: string }) {
  if (!config.identidade.mostrarLogo) return null
  return (
    <ImagemLoja
      src={logo}
      sizes="96px"
      className={cn("size-20 shrink-0 rounded-full bg-card ring-4 ring-white/80", className)}
    />
  )
}

function SeloAberto({ config, sobreFoto }: { config: Config; sobreFoto: boolean }) {
  if (!config.recursos.seloAberto) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        sobreFoto ? "bg-white/15 text-white backdrop-blur" : "bg-accent text-accent-foreground",
      )}
    >
      <span className="size-2 rounded-full bg-[#2BB673]" />
      {clienteAtual.status.texto}
    </span>
  )
}

function Cabecalho({ config }: { config: Config }) {
  const { logo, banner } = useImagensLoja()
  const { nome, slogan, escurecerBanner, alturaBanner } = config.identidade

  if (config.inicio.cabecalho === "compacto") {
    return (
      <header className="relative">
        <ImagemLoja src={banner} sizes="1280px" className="absolute inset-0" />
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: escurecerBanner / 100 }}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-end px-3 pt-2">
          <AcoesTopo config={config} sobreFoto />
        </div>
        <div className="relative flex items-center gap-3 px-4 pt-2 pb-5 text-white @3xl/tela:px-8">
          <Logo config={config} logo={logo} className="size-14 ring-2" />
          <div className="min-w-0">
            <h2 className="truncate font-heading text-2xl font-extrabold">{nome}</h2>
            <p className="truncate text-sm text-white/85">{slogan}</p>
          </div>
          <span className="ml-auto hidden @3xl/tela:block">
            <SeloAberto config={config} sobreFoto />
          </span>
        </div>
      </header>
    )
  }

  if (config.inicio.cabecalho === "dividido") {
    return (
      <header className="grid @3xl/tela:grid-cols-2">
        <div className="relative order-2 flex flex-col justify-center gap-3 bg-card px-5 py-6 @3xl/tela:order-1 @3xl/tela:px-12">
          <Logo config={config} logo={logo} className="size-16 ring-border" />
          <h2 className="font-heading text-3xl leading-tight font-extrabold @3xl/tela:text-5xl">
            {nome}
          </h2>
          <p className="text-muted-foreground @3xl/tela:text-lg">{slogan}</p>
          <SeloAberto config={config} sobreFoto={false} />
        </div>
        <div className={cn("relative order-1 @3xl/tela:order-2", ALTURA_BANNER[alturaBanner])}>
          <ImagemLoja src={banner} sizes="640px" className="absolute inset-0" />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: escurecerBanner / 200 }}
            aria-hidden="true"
          />
          <div className="absolute top-2 right-3">
            <AcoesTopo config={config} sobreFoto />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className={cn("relative", ALTURA_BANNER[alturaBanner])}>
      <ImagemLoja src={banner} sizes="1280px" className="absolute inset-0" />
      <div
        className="absolute inset-0 bg-linear-to-b from-black/40 via-black to-black"
        style={{ opacity: escurecerBanner / 100 + 0.25 }}
        aria-hidden="true"
      />
      <div className="relative flex justify-end px-3 pt-2 @3xl/tela:px-8">
        <AcoesTopo config={config} sobreFoto />
      </div>
      <div className="relative flex flex-col items-center gap-2 px-4 pt-2 text-center text-white">
        <Logo config={config} logo={logo} />
        <h2 className="font-heading text-[28px] leading-tight font-extrabold @3xl/tela:text-4xl">
          {nome}
        </h2>
        <p className="max-w-[34ch] text-sm text-white/85 @3xl/tela:text-base">{slogan}</p>
        <SeloAberto config={config} sobreFoto />
      </div>
    </header>
  )
}

function PainelInfo({ config }: { config: Config }) {
  if (!config.inicio.painelInfo) return null
  const itens = [
    { icone: BikeIcon, rotulo: "Entrega", valor: clienteAtual.entrega.tempo },
    { icone: StoreIcon, rotulo: "Retirada", valor: clienteAtual.retirada.tempo },
    ...(config.recursos.pedidoMinimo
      ? [{ icone: WalletIcon, rotulo: "Pedido mínimo", valor: emReais(clienteAtual.pedidoMinimo) }]
      : []),
    ...(config.recursos.horario
      ? [{ icone: ClockIcon, rotulo: "Hoje", valor: "18h às 23h30" }]
      : []),
  ]

  return (
    <div className="relative z-10 -mt-7 px-3 @3xl/tela:px-8">
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 shadow-[0_20px_50px_-24px_rgb(0_0_0/0.4)] ring-1 ring-border @3xl/tela:flex-row @3xl/tela:items-center @3xl/tela:p-4">
        {config.recursos.busca && (
          <span className="flex h-11 items-center gap-2 rounded-2xl bg-muted px-4 text-sm text-muted-foreground @3xl/tela:order-last @3xl/tela:w-64">
            <SearchIcon className="size-4" />
            Buscar no cardápio
          </span>
        )}
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5 @3xl/tela:flex @3xl/tela:gap-6">
          {itens.map(({ icone: Icone, rotulo, valor }) => (
            <div key={rotulo} className="flex items-center gap-2">
              <dt className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icone className="size-4" />
                <span className="sr-only">{rotulo}</span>
              </dt>
              <dd className="min-w-0 leading-tight">
                <span className="block text-[11px] text-muted-foreground">{rotulo}</span>
                <span className="block truncate text-[13px] font-semibold">{valor}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function BarraCategorias({ config, blocos }: { config: Config; blocos: Bloco[] }) {
  if (!config.inicio.barraCategorias) return null
  const categorias = blocos.filter((bloco) => bloco.id.startsWith("categoria:"))
  return (
    <nav aria-label="Categorias" className="mt-4 px-3 @3xl/tela:px-8">
      <ul className="flex gap-2 overflow-hidden @3xl/tela:justify-center">
        {categorias.map((bloco, indice) => (
          <li
            key={bloco.id}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold",
              indice === 0 ? "bg-foreground text-background" : "bg-card ring-1 ring-border",
            )}
          >
            {nomeDoBloco(bloco.id)}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ------------------------------------------------------------------ */

function ListaProdutos({
  produtos,
  disposicao,
  config,
  destaque = false,
}: {
  produtos: Produto[]
  disposicao: Disposicao
  config: Config
  /** Faixas de destaque usam o card imersivo quando estão em carrossel. */
  destaque?: boolean
}) {
  const adicionar = usePrevia((estado) => estado.adicionar)
  const { cards } = config
  const variante = destaque && disposicao === "carrossel" ? "imersivo" : undefined

  const demoHover = useDemoAtiva("hover") > 0
  const item = (produto: Produto, indice: number) => (
    <CardProduto
      produto={produto}
      config={config}
      variante={variante}
      demo={demoHover && indice < 2}
      acao={
        <EfeitoAdicionar>
          <BotaoMais config={config} nome={produto.nome} aoClicar={adicionar} />
        </EfeitoAdicionar>
      }
    />
  )

  if (disposicao === "carrossel") {
    return (
      <ScrollArea className="-mx-3 @3xl/tela:-mx-8">
        <ul className={cn("flex px-3 pb-3 @3xl/tela:px-8", ESPACO[cards.espacamento])}>
          {produtos.map((produto, indice) => (
            <li
              key={produto.id}
              className={cn(
                "shrink-0",
                LARGURA_CARROSSEL_CELULAR[cards.colunasCelular],
                LARGURA_CARROSSEL_COMPUTADOR[cards.colunasComputador],
              )}
            >
              {item(produto, indice)}
            </li>
          ))}
        </ul>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    )
  }

  return (
    <ul
      className={cn(
        "grid",
        ESPACO[cards.espacamento],
        disposicao === "lista"
          ? "grid-cols-1"
          : [COLUNAS_CELULAR[cards.colunasCelular], COLUNAS_COMPUTADOR[cards.colunasComputador]],
        cards.variante === "compacto" && "gap-y-0",
      )}
    >
      {produtos.map((produto, indice) => (
        <li key={produto.id}>{item(produto, indice)}</li>
      ))}
    </ul>
  )
}

function BlocoPagina({ bloco, config }: { bloco: Bloco; config: Config }) {
  const disposicao = bloco.exibicao === "padrao" ? config.cards.disposicao : bloco.exibicao
  const estilo = config.tipografia.tituloSecao

  if (bloco.id === "promocional") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary to-marca-acento p-5 text-primary-foreground @3xl/tela:p-8">
        <span className="text-xs font-semibold opacity-85">Só nesta terça</span>
        <p className="mt-1 max-w-[18ch] font-heading text-2xl leading-tight font-extrabold @3xl/tela:text-3xl">
          2 pizzas grandes por {emReais(89.9)}
        </p>
        <span
          className={cn(
            "mt-3 inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-semibold text-neutral-900",
          )}
        >
          Aproveitar
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-10 -bottom-12 size-44 rounded-full bg-white/15"
        />
      </div>
    )
  }

  if (bloco.id === "avaliacoes") {
    const avaliacoes = [
      { nome: "Marina", texto: "Massa leve e chegou quentinha. Virei cliente!" },
      { nome: "Rafael", texto: "A borda recheada é absurda. Entrega rápida." },
      { nome: "Bia", texto: "Melhor marguerita da cidade, sem exagero." },
    ]
    return (
      <section className="flex flex-col gap-3">
        <TituloSecao estilo={estilo}>Quem pediu, aprovou</TituloSecao>
        <ul className="grid gap-3 @3xl/tela:grid-cols-3">
          {avaliacoes.map((avaliacao) => (
            <li key={avaliacao.nome} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex gap-0.5 text-[#F5B700]" role="img" aria-label="5 estrelas">
                {Array.from({ length: 5 }, (_, indice) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: estrelas fixas.
                  <StarIcon key={indice} className="size-3.5 fill-current" />
                ))}
              </div>
              <p className="mt-2 text-sm">{avaliacao.texto}</p>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">{avaliacao.nome}</p>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  let produtos: Produto[] = []
  let titulo = nomeDoBloco(bloco.id)
  if (bloco.id === "mais-pedidas") {
    produtos = todosProdutos.filter((produto) => produto.destaque)
    if (produtos.length === 0) produtos = todosProdutos.slice(0, 4)
  } else if (bloco.id === "ofertas") {
    produtos = todosProdutos.filter((produto) => produto.precoOriginal)
    if (produtos.length === 0) produtos = todosProdutos.slice(2, 5)
    titulo = "Ofertas do dia"
  } else {
    const categoria = cardapioCasaDaPizza.find((item) => `categoria:${item.id}` === bloco.id)
    produtos = categoria?.produtos ?? []
  }

  return (
    <section className="flex flex-col gap-3">
      <TituloSecao
        estilo={estilo}
        extra={
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
            {plural(produtos.length, "opção", "opções")}
          </span>
        }
      >
        {titulo}
      </TituloSecao>
      <ListaProdutos
        produtos={produtos}
        disposicao={disposicao}
        config={config}
        destaque={bloco.id === "mais-pedidas" || bloco.id === "ofertas"}
      />
    </section>
  )
}

function Fidelidade() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent p-3 text-accent-foreground">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <GiftIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Cartão fidelidade</p>
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: 10 }, (_, indice) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: selos fixos.
              key={indice}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                indice < 3 ? "bg-primary" : "bg-primary/20",
              )}
            />
          ))}
        </div>
      </div>
      <span className="text-xs font-semibold">3 de 10</span>
    </div>
  )
}

function PopupPromocao({ config }: { config: Config }) {
  const [aberto, setAberto] = useState(true)
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="absolute inset-0 z-40 grid place-items-center bg-black/45 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.9 } }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-[320px] rounded-3xl bg-card p-6 text-center shadow-2xl"
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0, transition: { delay: 0.9, type: "spring", bounce: 0.3 } }}
          >
            <button
              type="button"
              aria-label="Fechar promoção"
              onClick={() => setAberto(false)}
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-full hover:bg-muted"
            >
              <XIcon className="size-4" />
            </button>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <GiftIcon className="size-7" />
            </span>
            <p className="mt-3 font-heading text-xl font-extrabold">10% no primeiro pedido</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o cupom BEMVINDO na finalização.
            </p>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={cn(
                "mt-4 h-11 w-full rounded-full text-sm font-semibold",
                classeBotao(config.cores.botao),
              )}
            >
              Quero aproveitar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Página inicial da loja simulada, montada na ordem do wireframe. */
export function TelaInicio() {
  const config = useConfigAtual()
  const { fundo } = useImagensLoja()
  const adicionados = usePrevia((estado) => estado.adicionados)
  const blocosAtivos = config.inicio.blocos.filter((bloco) => bloco.ativo)

  return (
    <div className="relative flex min-h-full flex-col">
      {fundo && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${fundo})`,
            opacity: config.identidade.opacidadeFundo / 100,
          }}
        />
      )}
      <div className="relative flex-1">
        <Entrada indice={0} alvo="inicio.cabecalho">
          <Cabecalho config={config} />
        </Entrada>
        <Entrada indice={1} alvo="inicio.painelInfo">
          <PainelInfo config={config} />
        </Entrada>
        <Entrada indice={2} alvo="inicio.barraCategorias">
          <BarraCategorias config={config} blocos={blocosAtivos} />
        </Entrada>
        <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-3 pt-6 pb-10 @3xl/tela:px-8">
          {config.recursos.fidelidade && (
            <Entrada indice={3}>
              <Fidelidade />
            </Entrada>
          )}
          {blocosAtivos.map((bloco, indice) => (
            <Entrada key={bloco.id} indice={indice + 3} alvo={`bloco:${bloco.id}`}>
              <BlocoPagina bloco={bloco} config={config} />
            </Entrada>
          ))}
          <footer className="border-t border-border pt-5 text-center text-xs text-muted-foreground">
            {config.identidade.nome} · Feito com ClickPedido
          </footer>
        </main>
      </div>

      {/* Tudo que fica preso no rodapé da tela: a barra da sacola e, acima dela, o WhatsApp. */}
      <div className="sticky bottom-0 z-30">
        {config.recursos.whatsapp && (
          <span
            className={cn(
              "absolute right-4 grid size-13 place-items-center rounded-full bg-[#25D366] text-white shadow-lg @3xl/tela:bottom-6",
              adicionados > 0 ? "bottom-[calc(100%+0.25rem)]" : "bottom-6",
            )}
          >
            <MessageCircleIcon className="size-6" />
            <span className="sr-only">WhatsApp da loja</span>
          </span>
        )}
        {adicionados > 0 && (
          <div className="p-3 pb-6 @3xl/tela:hidden">
            <span
              className={cn(
                "flex h-13 items-center justify-between rounded-full px-5 text-sm font-semibold shadow-xl",
                classeBotao(config.cores.botao),
              )}
            >
              <span>Ver sacola</span>
              <span>{plural(adicionados, "item", "itens")}</span>
            </span>
          </div>
        )}
      </div>

      {config.recursos.popupPromocao && <PopupPromocao config={config} />}
    </div>
  )
}
