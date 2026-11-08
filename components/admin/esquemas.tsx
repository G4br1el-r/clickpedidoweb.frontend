"use client"

import { motion } from "motion/react"
import type { CSSProperties, ReactNode } from "react"
import type {
  AberturaProduto,
  Disposicao,
  EfeitoAdicionar,
  EntradaPagina,
  EstiloBotao,
  EstiloCabecalho,
  EstiloSacola,
  EstiloTituloSecao,
  HoverCard,
  LayoutProduto,
  TopoAcompanhamento,
  VarianteCard,
} from "@/lib/admin/config"
import { useConfig } from "@/lib/admin/config"
import { variaveisClaras } from "@/lib/tema"
import { cn } from "@/lib/utils"
import { classeBotao } from "./previa/estilos"

/** Cores da loja aplicadas só dentro do desenho, para as amostras usarem a marca. */
function useCoresDaLoja(): CSSProperties {
  const { primaria, acento, fundo, tinta } = useConfig((estado) => estado.config.cores)
  return variaveisClaras({ primaria, acento, fundo, tinta }) as CSSProperties
}

function Moldura({ children, className }: { children: ReactNode; className?: string }) {
  const cores = useCoresDaLoja()
  return (
    <span
      style={cores}
      className={cn(
        "flex h-24 w-full items-center justify-center rounded-xl bg-background p-2.5 ring-1 ring-border/60",
        className,
      )}
    >
      {children}
    </span>
  )
}

const BARRA = "block rounded-[3px] bg-foreground/15"
const FOTO = "block rounded-md bg-linear-to-br from-marca-acento/45 to-primary/35"

export function EsquemaCard({ variante }: { variante: VarianteCard }) {
  const mais = <span className="block size-3 shrink-0 rounded-full bg-primary" />
  const conteudo: Record<VarianteCard, ReactNode> = {
    classico: (
      <span className="flex w-24 flex-col gap-1 rounded-lg bg-card p-1.5 ring-1 ring-border">
        <span className="flex gap-1.5">
          <span className={cn(FOTO, "size-7")} />
          <span className="flex flex-1 flex-col gap-1 pt-0.5">
            <span className={cn(BARRA, "h-1.5 w-4/5")} />
            <span className={cn(BARRA, "h-1 w-full opacity-60")} />
          </span>
        </span>
        <span className="flex items-center justify-between">
          <span className={cn(BARRA, "h-1.5 w-6")} />
          {mais}
        </span>
      </span>
    ),
    vitrine: (
      <span className="flex w-16 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border">
        <span className={cn(FOTO, "h-9 w-full rounded-none")} />
        <span className="flex flex-col gap-1 p-1.5">
          <span className={cn(BARRA, "h-1.5 w-4/5")} />
          <span className="flex items-center justify-between">
            <span className={cn(BARRA, "h-1.5 w-5")} />
            {mais}
          </span>
        </span>
      </span>
    ),
    compacto: (
      <span className="flex w-28 flex-col">
        {[0, 1].map((linha) => (
          <span key={linha} className="flex items-center gap-1.5 border-b border-border py-1.5">
            <span className="flex flex-1 flex-col gap-1">
              <span className={cn(BARRA, "h-1.5 w-3/4")} />
              <span className={cn(BARRA, "h-1 w-1/3")} />
            </span>
            <span className={cn(FOTO, "size-6")} />
          </span>
        ))}
      </span>
    ),
    imersivo: (
      <span
        className={cn(FOTO, "relative flex h-16 w-24 items-end justify-between rounded-lg p-1.5")}
      >
        <span className="flex flex-col gap-1">
          <span className="block h-1.5 w-10 rounded-[3px] bg-white/90" />
          <span className="block h-1 w-6 rounded-[3px] bg-white/70" />
        </span>
        <span className="block size-3 rounded-full bg-white" />
      </span>
    ),
    mosaico: (
      <span className="grid w-24 grid-cols-2 gap-1.5">
        {[0, 1].map((item) => (
          <span key={item} className="flex flex-col gap-1">
            <span className={cn(FOTO, "relative aspect-square w-full rounded-lg")}>
              <span className="absolute right-0.5 bottom-0.5 block size-2 rounded-full bg-primary" />
            </span>
            <span className={cn(BARRA, "h-1 w-4/5")} />
          </span>
        ))}
      </span>
    ),
  }
  return <Moldura>{conteudo[variante]}</Moldura>
}

export function EsquemaDisposicao({ disposicao }: { disposicao: Disposicao }) {
  const item = "block rounded-md bg-card ring-1 ring-border"
  const conteudo: Record<Disposicao, ReactNode> = {
    lista: (
      <span className="flex w-24 flex-col gap-1">
        {[0, 1, 2].map((linha) => (
          <span key={linha} className={cn(item, "flex h-4 items-center gap-1 px-1")}>
            <span className={cn(FOTO, "size-2.5 rounded-sm")} />
            <span className={cn(BARRA, "h-1 w-1/2")} />
          </span>
        ))}
      </span>
    ),
    grade: (
      <span className="grid w-24 grid-cols-3 gap-1">
        {[0, 1, 2, 3, 4, 5].map((celula) => (
          <span key={celula} className={cn(item, "h-6")} />
        ))}
      </span>
    ),
    carrossel: (
      <span className="flex w-28 gap-1 overflow-hidden">
        {[0, 1, 2].map((celula) => (
          <span
            key={celula}
            className={cn(item, "h-12 w-11 shrink-0", celula === 2 && "opacity-50")}
          />
        ))}
      </span>
    ),
  }
  return <Moldura>{conteudo[disposicao]}</Moldura>
}

export function EsquemaCabecalho({ estilo }: { estilo: EstiloCabecalho }) {
  const conteudo: Record<EstiloCabecalho, ReactNode> = {
    padrao: (
      <span className="flex w-28 flex-col items-center">
        <span
          className={cn(
            FOTO,
            "flex h-12 w-full flex-col items-center justify-center gap-1 rounded-lg",
          )}
        >
          <span className="block size-3 rounded-full bg-white" />
          <span className="block h-1 w-10 rounded bg-white/80" />
        </span>
        <span className="-mt-1.5 block h-3 w-[88%] rounded-md bg-card ring-1 ring-border" />
      </span>
    ),
    compacto: (
      <span className={cn(FOTO, "flex h-8 w-28 items-center gap-1.5 rounded-lg px-1.5")}>
        <span className="block size-4 rounded-full bg-white" />
        <span className="block h-1.5 w-12 rounded bg-white/80" />
      </span>
    ),
    dividido: (
      <span className="flex h-12 w-28 overflow-hidden rounded-lg ring-1 ring-border">
        <span className="flex flex-1 flex-col justify-center gap-1 bg-card px-1.5">
          <span className={cn(BARRA, "h-1.5 w-4/5")} />
          <span className={cn(BARRA, "h-1 w-1/2")} />
        </span>
        <span className={cn(FOTO, "h-full flex-1 rounded-none")} />
      </span>
    ),
  }
  return <Moldura>{conteudo[estilo]}</Moldura>
}

export function EsquemaTela({ tipo }: { tipo: LayoutProduto | EstiloSacola | TopoAcompanhamento }) {
  const painel = "block bg-card ring-1 ring-border"
  const fundo = "relative h-16 w-24 overflow-hidden rounded-lg bg-foreground/10"
  const conteudo: Record<string, ReactNode> = {
    painel: (
      <span className={fundo}>
        <span className={cn(painel, "absolute inset-x-1 top-4 bottom-0 rounded-t-md")} />
      </span>
    ),
    janela: (
      <span className={fundo}>
        <span className={cn(painel, "absolute inset-2.5 rounded-md")} />
      </span>
    ),
    "tela-cheia": (
      <span className={fundo}>
        <span className={cn(painel, "absolute inset-0")} />
      </span>
    ),
    ilha: (
      <span className={fundo}>
        <span className={cn(painel, "absolute top-1 right-1 h-11 w-12 rounded-md")} />
      </span>
    ),
    gaveta: (
      <span className={fundo}>
        <span className={cn(painel, "absolute inset-y-0 right-0 w-12")} />
      </span>
    ),
    pagina: (
      <span className={fundo}>
        <span className={cn(painel, "absolute inset-0")} />
      </span>
    ),
    neutro: (
      <span className={cn(fundo, "bg-background ring-1 ring-border")}>
        <span className={cn(painel, "absolute inset-x-0 top-0 h-6")} />
      </span>
    ),
    marca: (
      <span className={cn(fundo, "bg-background ring-1 ring-border")}>
        <span className="absolute inset-x-0 top-0 block h-6 bg-primary" />
      </span>
    ),
    foto: (
      <span className={cn(fundo, "bg-background ring-1 ring-border")}>
        <span className={cn(FOTO, "absolute inset-x-0 top-0 h-6 rounded-none")} />
      </span>
    ),
  }
  return <Moldura>{conteudo[tipo]}</Moldura>
}

export function AmostraBotao({ estilo }: { estilo: EstiloBotao }) {
  return (
    <Moldura className="h-16">
      <span
        className={cn(
          "inline-flex h-9 items-center rounded-full px-5 text-xs font-semibold",
          classeBotao(estilo),
        )}
      >
        Adicionar
      </span>
    </Moldura>
  )
}

export function AmostraTitulo({ estilo }: { estilo: EstiloTituloSecao }) {
  const texto = <span className="font-heading text-sm font-extrabold">Bebidas</span>
  const conteudo: Record<EstiloTituloSecao, ReactNode> = {
    barra: (
      <span className="flex w-28 items-center gap-1.5">
        <span className="block h-4 w-1 rounded-full bg-marca-acento" />
        {texto}
        <span className="block h-px flex-1 bg-border" />
      </span>
    ),
    sublinhado: (
      <span className="flex w-28 items-center gap-1.5">
        <span className="border-b-2 border-marca-acento">{texto}</span>
        <span className="block h-px flex-1 bg-border" />
      </span>
    ),
    simples: <span className="w-28">{texto}</span>,
    pilula: (
      <span className="w-28">
        <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">{texto}</span>
      </span>
    ),
  }
  return <Moldura className="h-14">{conteudo[estilo]}</Moldura>
}

const REPETIR = { repeat: Number.POSITIVE_INFINITY, repeatDelay: 1.1 }

/** Amostras animadas em laço para cada animação: mostram o movimento antes de escolher. */
export function AmostraAnimacao({
  tipo,
  valor,
}: {
  tipo: "entrada" | "abrir" | "adicionar" | "hover"
  valor: EntradaPagina | AberturaProduto | EfeitoAdicionar | HoverCard
}) {
  const bloco = "block rounded-md bg-card ring-1 ring-border"

  if (tipo === "entrada") {
    const inicio: Record<string, Record<string, number | string>> = {
      nenhuma: { opacity: 1 },
      suave: { opacity: 0 },
      subir: { opacity: 0, y: 10 },
      zoom: { opacity: 0, scale: 0.8 },
      desfoque: { opacity: 0, filter: "blur(4px)" },
      cascata: { opacity: 0, y: 14 },
    }
    return (
      <Moldura className="h-20 flex-col gap-1">
        {[0, 1, 2].map((indice) => (
          <motion.span
            key={indice}
            className={cn(bloco, "h-3.5 w-24")}
            initial={inicio[valor]}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: valor === "nenhuma" ? 0 : 0.6,
              delay: valor === "cascata" ? indice * 0.18 : indice * 0.05,
              ...REPETIR,
            }}
          />
        ))}
      </Moldura>
    )
  }

  if (tipo === "abrir") {
    const inicio: Record<string, Record<string, number | string>> = {
      deslizar: { y: 40 },
      escalar: { scale: 0.7, opacity: 0 },
      morph: { scale: 0.3, x: -22, y: 10, borderRadius: 16 },
    }
    return (
      <Moldura className="h-20">
        <span className="relative h-14 w-24 overflow-hidden rounded-lg bg-foreground/10">
          <motion.span
            className={cn(bloco, "absolute inset-1.5 rounded-md bg-card")}
            initial={inicio[valor]}
            animate={{ y: 0, x: 0, scale: 1, opacity: 1, borderRadius: 6 }}
            transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], ...REPETIR }}
          />
        </span>
      </Moldura>
    )
  }

  if (tipo === "adicionar") {
    return (
      <Moldura className="h-20">
        <span className="relative grid size-10 place-items-center">
          <motion.span
            className="block size-7 rounded-full bg-primary"
            animate={valor === "pulso" ? { scale: [1, 0.85, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, ...REPETIR }}
          />
          {valor === "voo" && (
            <motion.span
              className="absolute block size-3 rounded-full bg-marca-acento"
              animate={{
                x: [0, 14, 30],
                y: [0, -24, -10],
                opacity: [1, 1, 0],
                scale: [1, 0.8, 0.4],
              }}
              transition={{ duration: 0.7, ...REPETIR }}
            />
          )}
          {valor === "confete" &&
            [0, 1, 2, 3, 4, 5].map((indice) => (
              <motion.span
                key={indice}
                className="absolute block size-1.5 rounded-[1px]"
                style={{ background: indice % 2 ? "var(--primary)" : "var(--marca-acento)" }}
                animate={{
                  x: [0, Math.cos(indice) * 22],
                  y: [0, Math.sin(indice) * 22],
                  opacity: [1, 0],
                  rotate: [0, 180],
                }}
                transition={{ duration: 0.7, ...REPETIR }}
              />
            ))}
        </span>
      </Moldura>
    )
  }

  const animacao: Record<string, Record<string, number[] | string[]>> = {
    nenhum: {},
    levantar: { y: [0, -4, -4, 0] },
    zoom: { scale: [1, 1.08, 1.08, 1] },
    brilho: {
      boxShadow: [
        "0 0 0 0px var(--primary)",
        "0 0 0 2px var(--primary)",
        "0 0 0 2px var(--primary)",
        "0 0 0 0px var(--primary)",
      ],
    },
  }
  return (
    <Moldura className="h-20">
      <motion.span
        className={cn(FOTO, "block h-12 w-16 rounded-lg")}
        animate={animacao[valor]}
        transition={{ duration: 1.6, ...REPETIR, repeatDelay: 0.4 }}
      />
    </Moldura>
  )
}
