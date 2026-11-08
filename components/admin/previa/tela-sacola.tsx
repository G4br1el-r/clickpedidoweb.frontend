"use client"

import { ArrowLeftIcon, MinusIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { motion } from "motion/react"
import { Foto } from "@/components/foto"
import { Progress } from "@/components/ui/progress"
import type { Config } from "@/lib/admin/config"
import { clienteAtual } from "@/lib/cliente"
import { emReais } from "@/lib/formato"
import { cardapioCasaDaPizza } from "@/lib/mock/casa-da-pizza"
import { cn } from "@/lib/utils"
import { ImagemLoja, useConfigAtual, useImagensLoja } from "./comum"
import { usePrevia } from "./estado"
import { classeBotao } from "./estilos"

const todos = cardapioCasaDaPizza.flatMap((categoria) => categoria.produtos)
const itens = [
  { produto: todos.find((item) => item.id === "calabresa") ?? todos[1], quantidade: 1 },
  { produto: todos.find((item) => item.tipo === "bebida") ?? todos[6], quantidade: 2 },
].filter((item) => item.produto)
const sugestoes =
  cardapioCasaDaPizza.find((categoria) => categoria.id === "bebidas")?.produtos ?? []

function Conteudo({ config }: { config: Config }) {
  const subtotal = itens.reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0)
  const minimo = clienteAtual.pedidoMinimo
  const pagina = config.sacola.estilo === "pagina"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {pagina && <ArrowLeftIcon className="size-5" />}
          <div>
            <h2 className="font-heading text-xl font-bold">Sua sacola</h2>
            <p className="text-sm text-muted-foreground">{itens.length} itens</p>
          </div>
        </div>
        {!pagina && (
          <span className="grid size-9 place-items-center rounded-full hover:bg-muted">
            <XIcon className="size-4" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-2 [scrollbar-width:none]">
        {config.sacola.barraMinimo && config.recursos.pedidoMinimo && (
          <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
            <p className="text-sm font-semibold">
              {subtotal >= minimo
                ? "Pedido mínimo atingido"
                : `Faltam ${emReais(minimo - subtotal)} para o pedido mínimo`}
            </p>
            <Progress value={Math.min(100, (subtotal / minimo) * 100)} className="mt-2" />
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {itens.map(({ produto, quantidade }) => (
            <li key={produto.id} className="flex items-center gap-3">
              <Foto
                src={produto.imagem}
                alt=""
                sizes="64px"
                className="size-14 shrink-0 rounded-2xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{produto.nome}</p>
                <p className="text-sm font-bold tabular-nums">{emReais(produto.preco)}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                <span className="grid size-7 place-items-center rounded-full">
                  {quantidade === 1 ? (
                    <Trash2Icon className="size-3.5" />
                  ) : (
                    <MinusIcon className="size-3.5" />
                  )}
                </span>
                <span className="w-4 text-center text-sm font-bold">{quantidade}</span>
                <span className="grid size-7 place-items-center rounded-full">
                  <PlusIcon className="size-3.5" />
                </span>
              </div>
            </li>
          ))}
        </ul>
        {config.sacola.sugestoes && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Combina com seu pedido</h3>
            <div className="flex gap-2">
              {sugestoes.slice(0, 2).map((bebida) => (
                <div
                  key={bebida.id}
                  className="flex flex-1 items-center gap-2 rounded-2xl p-2 ring-1 ring-border"
                >
                  <Foto
                    src={bebida.imagem}
                    alt=""
                    sizes="40px"
                    className="size-10 shrink-0 rounded-xl"
                  />
                  <span className="min-w-0 text-xs leading-tight">
                    <span className="line-clamp-1 font-semibold">{bebida.nome}</span>
                    <span className="text-muted-foreground">+ {emReais(bebida.preco)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-border p-4 pb-7 @3xl/tela:pb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="text-lg font-bold tabular-nums">{emReais(subtotal)}</span>
        </div>
        <span
          className={cn(
            "flex h-12 items-center justify-center rounded-full text-sm font-semibold",
            classeBotao(config.cores.botao),
          )}
        >
          {config.sacola.textoBotao || "Continuar"}
        </span>
      </div>
    </div>
  )
}

/** Sacola aberta: ilha flutuante, gaveta lateral ou página inteira. */
export function TelaSacola() {
  const config = useConfigAtual()
  const celular = usePrevia((estado) => estado.dispositivo) === "celular"
  const { banner } = useImagensLoja()
  const { estilo } = config.sacola
  const velocidade = config.animacoes.velocidade

  if (estilo === "pagina") {
    return (
      <motion.div
        className="absolute inset-0 flex flex-col bg-card"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 * velocidade, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[640px] flex-1 flex-col">
          <Conteudo config={config} />
        </div>
      </motion.div>
    )
  }

  const gaveta = estilo === "gaveta"
  return (
    <div className="absolute inset-0 overflow-hidden">
      <ImagemLoja src={banner} sizes="1280px" className="absolute inset-0 scale-110 blur-md" />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <motion.div
        initial={gaveta ? { x: "100%" } : { opacity: 0, scale: 0.6, y: -40 }}
        animate={gaveta ? { x: 0 } : { opacity: 1, scale: 1, y: 0 }}
        transition={
          gaveta
            ? { duration: 0.45 * velocidade, ease: [0.32, 0.72, 0, 1] }
            : { type: "spring", duration: 0.55 * velocidade, bounce: 0.14 }
        }
        style={{ transformOrigin: "top right" }}
        className={cn(
          "absolute flex flex-col overflow-hidden bg-card shadow-2xl ring-1 ring-border",
          gaveta
            ? "inset-y-0 right-0 w-[86%] @3xl/tela:w-[420px]"
            : celular
              ? "inset-x-3 top-3 bottom-[18%] rounded-[28px]"
              : "top-16 right-8 h-[560px] w-[400px] rounded-[28px]",
        )}
      >
        <Conteudo config={config} />
      </motion.div>
    </div>
  )
}
