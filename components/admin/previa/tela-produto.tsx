"use client"

import { ArrowLeftIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react"
import { motion, type TargetAndTransition } from "motion/react"
import { useState } from "react"
import { Foto } from "@/components/foto"
import { PizzaSvg } from "@/components/segmentos/pizzaria/pizza-svg"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Config } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import { cardapioCasaDaPizza } from "@/lib/mock/casa-da-pizza"
import type { GrupoOpcao } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { EfeitoAdicionar, ImagemLoja, useConfigAtual, useImagensLoja } from "./comum"
import { usePrevia } from "./estado"
import { classeBotao } from "./estilos"

const produto = cardapioCasaDaPizza[0].produtos[0]
const grupos = (produto.grupos ?? []) as GrupoOpcao[]
const bebidas = cardapioCasaDaPizza.find((categoria) => categoria.id === "bebidas")?.produtos ?? []

type Escolhas = Record<string, string>

const CURVA = [0.23, 1, 0.32, 1] as const

/** Como o produto aparece ao abrir, conforme a animação e o formato escolhidos. */
function abertura(
  config: Config,
  celular: boolean,
): { inicial: TargetAndTransition; final: TargetAndTransition } {
  const { abrirProduto, velocidade } = config.animacoes
  const transicao = { duration: 0.5 * velocidade, ease: CURVA }
  if (abrirProduto === "escalar") {
    return {
      inicial: { opacity: 0, scale: 0.9 },
      final: { opacity: 1, scale: 1, transition: transicao },
    }
  }
  if (abrirProduto === "morph") {
    // Cresce a partir do card, como se a foto virasse a tela.
    return {
      inicial: { opacity: 0.6, scale: 0.32, borderRadius: 48, x: "-18%", y: "8%" },
      final: {
        opacity: 1,
        scale: 1,
        borderRadius: 28,
        x: 0,
        y: 0,
        transition: { type: "spring", duration: 0.65 * velocidade, bounce: 0.14 },
      },
    }
  }
  const lateral = !celular && config.produto.layout === "painel"
  return {
    inicial: lateral
      ? { x: "100%" }
      : {
          y: config.produto.layout === "janela" ? 40 : "100%",
          opacity: config.produto.layout === "janela" ? 0 : 1,
        },
    final: { x: 0, y: 0, opacity: 1, transition: transicao },
  }
}

function ListaOpcoes({
  grupo,
  escolhas,
  aoEscolher,
}: {
  grupo: GrupoOpcao
  escolhas: Escolhas
  aoEscolher: (grupo: string, item: string) => void
}) {
  return (
    <RadioGroup
      value={escolhas[grupo.id] ?? ""}
      onValueChange={(valor) => aoEscolher(grupo.id, valor)}
      aria-label={grupo.titulo}
      className="gap-2"
    >
      {grupo.itens.slice(0, 4).map((item) => {
        const id = `previa-${grupo.id}-${item.id}`
        return (
          <label
            key={item.id}
            htmlFor={id}
            className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-border has-data-checked:bg-accent has-data-checked:ring-primary"
          >
            <span
              className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted"
              aria-hidden="true"
            >
              {grupo.tipo === "sabor" ? (
                <PizzaSvg sabores={[item.nome]} estatica className="size-10" />
              ) : (
                <span
                  className="size-7 rounded-full ring-4 ring-black/5"
                  style={{ background: item.cor }}
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{item.nome}</span>
              {item.descricao && (
                <span className="block truncate text-xs text-muted-foreground">
                  {item.descricao}
                </span>
              )}
            </span>
            {item.extra > 0 && (
              <span className="text-xs font-semibold tabular-nums">+ {emReais(item.extra)}</span>
            )}
            <RadioGroupItem value={item.id} id={id} aria-label={item.nome} />
          </label>
        )
      })}
    </RadioGroup>
  )
}

function Passos({
  config,
  escolhas,
  aoEscolher,
}: {
  config: Config
  escolhas: Escolhas
  aoEscolher: (grupo: string, item: string) => void
}) {
  if (!config.produto.passosEmAbas) {
    return (
      <div className="flex flex-col gap-5">
        {grupos.map((grupo) => (
          <section key={grupo.id} className="flex flex-col gap-2">
            <h3 className="flex items-center justify-between text-sm font-bold">
              {grupo.titulo}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                {escolhas[grupo.id] ? "Escolhido" : "Obrigatório"}
              </span>
            </h3>
            <ListaOpcoes grupo={grupo} escolhas={escolhas} aoEscolher={aoEscolher} />
          </section>
        ))}
      </div>
    )
  }

  return (
    <Tabs defaultValue={grupos[0]?.id} className="gap-3">
      <TabsList variant="line" className="w-full justify-start">
        {grupos.map((grupo, indice) => (
          <TabsTrigger key={grupo.id} value={grupo.id} className="gap-1.5">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-[11px] font-bold",
                escolhas[grupo.id] ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {escolhas[grupo.id] ? <CheckIcon className="size-3" /> : indice + 1}
            </span>
            {grupo.nome}
          </TabsTrigger>
        ))}
      </TabsList>
      {grupos.map((grupo) => (
        <TabsContent key={grupo.id} value={grupo.id}>
          <ListaOpcoes grupo={grupo} escolhas={escolhas} aoEscolher={aoEscolher} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function Conteudo({ config, celular }: { config: Config; celular: boolean }) {
  const adicionar = usePrevia((estado) => estado.adicionar)
  const [escolhas, setEscolhas] = useState<Escolhas>({ "sabor-1": "calabresa" })
  const [quantidade, setQuantidade] = useState(1)
  const nomeDe = (grupo: string) =>
    grupos.find((item) => item.id === grupo)?.itens.find((item) => item.id === escolhas[grupo])
  const borda = nomeDe("borda")
  const completa = grupos.every((grupo) => escolhas[grupo.id])
  const total =
    (produto.preco + grupos.reduce((soma, grupo) => soma + (nomeDe(grupo.id)?.extra ?? 0), 0)) *
    quantidade
  const lado = config.produto.layout === "janela" && !celular

  const ilustracao = config.produto.previaIlustrada ? (
    <div className="grid place-items-center bg-linear-to-b from-accent to-card px-6 py-5">
      <PizzaSvg
        sabores={[nomeDe("sabor-1")?.nome ?? null, nomeDe("sabor-2")?.nome ?? null]}
        borda={borda ? { cor: borda.cor, recheada: borda.realce } : undefined}
        pronta={completa}
        className="size-44 @3xl/tela:size-56"
      />
    </div>
  ) : (
    <Foto src={produto.imagem} alt="" sizes="480px" className="aspect-[16/10] w-full" />
  )

  return (
    <div className={cn("flex min-h-0 flex-1", lado ? "flex-row" : "flex-col")}>
      <div className={cn("shrink-0", lado && "w-[45%]")}>{ilustracao}</div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-width:none]">
          <div>
            <h2 className="font-heading text-2xl leading-tight font-extrabold">{produto.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{produto.descricao}</p>
          </div>
          <Passos
            config={config}
            escolhas={escolhas}
            aoEscolher={(grupo, item) => setEscolhas((atual) => ({ ...atual, [grupo]: item }))}
          />
          {config.produto.sugestoes && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Peça também</h3>
              <div className="grid grid-cols-2 gap-2">
                {bebidas.slice(0, 2).map((bebida) => (
                  <div
                    key={bebida.id}
                    className="flex items-center gap-2 rounded-2xl p-2 ring-1 ring-border"
                  >
                    <Foto
                      src={bebida.imagem}
                      alt=""
                      sizes="48px"
                      className="size-10 shrink-0 rounded-xl"
                    />
                    <span className="min-w-0 text-xs leading-tight">
                      <span className="line-clamp-1 font-semibold">{bebida.nome}</span>
                      <span className="text-muted-foreground">{emReais(bebida.preco)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {config.produto.observacao && (
            <section className="flex flex-col gap-2">
              <label htmlFor="previa-observacao" className="text-sm font-bold">
                Alguma observação?
              </label>
              <Textarea id="previa-observacao" placeholder="Ex.: sem cebola, bem assada" rows={2} />
            </section>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border p-3 pb-6 @3xl/tela:pb-3">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              aria-label="Diminuir"
              onClick={() => setQuantidade((valor) => Math.max(1, valor - 1))}
              className="grid size-8 place-items-center rounded-full hover:bg-card"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="w-5 text-center text-sm font-bold tabular-nums">{quantidade}</span>
            <button
              type="button"
              aria-label="Aumentar"
              onClick={() => setQuantidade((valor) => valor + 1)}
              className="grid size-8 place-items-center rounded-full hover:bg-card"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
          <EfeitoAdicionar className="flex-1" demonstravel>
            <button
              type="button"
              onClick={adicionar}
              className={cn(
                "flex h-12 w-full items-center justify-between gap-2 rounded-full px-5 text-sm font-semibold",
                classeBotao(config.cores.botao),
              )}
            >
              <span>{config.produto.textoBotao || "Adicionar"}</span>
              <span className="tabular-nums">{emReais(total)}</span>
            </button>
          </EfeitoAdicionar>
        </div>
      </div>
    </div>
  )
}

/** Produto aberto, no formato e com a animação de abertura escolhidos. */
export function TelaProduto() {
  const config = useConfigAtual()
  const dispositivo = usePrevia((estado) => estado.dispositivo)
  const { banner } = useImagensLoja()
  const celular = dispositivo === "celular"
  const { inicial, final } = abertura(config, celular)
  const { layout } = config.produto

  if (layout === "tela-cheia") {
    return (
      <motion.div
        initial={inicial}
        animate={final}
        className="absolute inset-0 flex flex-col overflow-hidden bg-card"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="grid size-9 place-items-center rounded-full hover:bg-muted">
            <ArrowLeftIcon className="size-5" />
          </span>
          <span className="text-sm font-semibold">Voltar ao cardápio</span>
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[960px] flex-1">
          <Conteudo
            config={{ ...config, produto: { ...config.produto, layout: "janela" } }}
            celular={celular}
          />
        </div>
      </motion.div>
    )
  }

  const painelLateral = layout === "painel" && !celular

  return (
    <div className="absolute inset-0 overflow-hidden">
      <ImagemLoja src={banner} sizes="1280px" className="absolute inset-0 scale-110 blur-md" />
      <motion.div
        className="absolute inset-0 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div
        initial={inicial}
        animate={final}
        className={cn(
          "absolute flex flex-col overflow-hidden bg-card shadow-2xl",
          layout === "janela"
            ? "inset-x-3 top-[6%] bottom-[6%] rounded-[28px] @3xl/tela:inset-x-[12%] @3xl/tela:top-[8%] @3xl/tela:bottom-[8%]"
            : painelLateral
              ? "inset-y-0 right-0 w-[440px] rounded-l-[28px]"
              : "inset-x-0 top-[7%] bottom-0 rounded-t-[28px]",
        )}
      >
        <span className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-card/90 shadow-sm backdrop-blur">
          <XIcon className="size-4" />
        </span>
        <Conteudo config={config} celular={celular} />
      </motion.div>
    </div>
  )
}
