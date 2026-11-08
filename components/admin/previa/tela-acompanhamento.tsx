"use client"

import { BikeIcon, CheckIcon, ChefHatIcon, HomeIcon, ReceiptTextIcon, StarIcon } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import type { Config } from "@/lib/admin/config"
import { cn } from "@/lib/utils"
import { Entrada, ImagemLoja, useConfigAtual, useImagensLoja } from "./comum"

const ETAPAS = [
  { titulo: "Pedido recebido", hora: "19:42", icone: ReceiptTextIcon },
  { titulo: "Em preparo", hora: "19:45", icone: ChefHatIcon },
  { titulo: "Saiu para entrega", hora: "—", icone: BikeIcon },
  { titulo: "Entregue", hora: "—", icone: HomeIcon },
]
const ATUAL = 1

function Topo({ config }: { config: Config }) {
  const { banner } = useImagensLoja()
  const { topo } = config.acompanhamento
  const escuro = topo !== "neutro"

  return (
    <header
      className={cn(
        "relative overflow-hidden px-5 pt-6 pb-8",
        topo === "neutro" && "border-b border-border bg-card",
        topo === "marca" && "bg-primary text-primary-foreground",
        topo === "foto" && "text-white",
      )}
    >
      {topo === "foto" && (
        <>
          <ImagemLoja src={banner} sizes="1280px" className="absolute inset-0" />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 to-black/30" />
        </>
      )}
      <div className="relative mx-auto max-w-[720px]">
        <p className={cn("text-sm", escuro ? "opacity-85" : "text-muted-foreground")}>
          Pedido #1042 · {config.identidade.nome}
        </p>
        <h2 className="mt-1 font-heading text-3xl font-extrabold">Em preparo</h2>
        <p className={cn("mt-1 text-sm", escuro ? "opacity-85" : "text-muted-foreground")}>
          Previsão de entrega: 20:20 a 20:35
        </p>
      </div>
    </header>
  )
}

function Mapa() {
  return (
    <div className="relative h-44 overflow-hidden rounded-3xl bg-muted ring-1 ring-border">
      <svg viewBox="0 0 320 176" className="absolute inset-0 size-full" aria-hidden="true">
        <g stroke="var(--border)" strokeWidth="10" fill="none" strokeLinecap="round">
          <path d="M-10 40 H330" />
          <path d="M-10 120 H330" />
          <path d="M70 -10 V190" />
          <path d="M210 -10 V190" />
        </g>
        <motion.path
          d="M70 140 V120 H210 V40 H260"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 0"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        <circle cx="70" cy="140" r="8" fill="var(--marca-acento)" />
        <circle cx="260" cy="40" r="8" fill="var(--primary)" />
      </svg>
      <span className="absolute bottom-3 left-3 rounded-full bg-card px-3 py-1 text-xs font-semibold shadow">
        Entregador a 2,1 km
      </span>
    </div>
  )
}

function Avaliar() {
  const [nota, setNota] = useState(0)
  return (
    <div className="rounded-3xl bg-card p-4 text-center ring-1 ring-border">
      <p className="font-heading font-bold">Como foi seu pedido?</p>
      <div className="mt-2 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((valor) => (
          <button
            key={valor}
            type="button"
            aria-label={`${valor} estrelas`}
            onClick={() => setNota(valor)}
            className="grid size-9 place-items-center"
          >
            <StarIcon
              className={cn(
                "size-7 transition-transform duration-150",
                valor <= nota ? "scale-110 fill-[#F5B700] text-[#F5B700]" : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Acompanhamento do pedido com o topo, a linha do tempo e os extras escolhidos. */
export function TelaAcompanhamento() {
  const config = useConfigAtual()
  const { acompanhamento } = config

  return (
    <div className="min-h-full bg-background">
      <Entrada indice={0}>
        <Topo config={config} />
      </Entrada>
      <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-5">
        {acompanhamento.agradecimento && (
          <Entrada indice={1}>
            <p className="rounded-2xl bg-accent p-4 text-sm font-medium text-accent-foreground">
              {acompanhamento.agradecimento}
            </p>
          </Entrada>
        )}
        {acompanhamento.mapa && (
          <Entrada indice={2}>
            <Mapa />
          </Entrada>
        )}
        {acompanhamento.linhaDoTempo && (
          <Entrada indice={3}>
            <ol className="flex flex-col rounded-3xl bg-card p-4 ring-1 ring-border">
              {ETAPAS.map(({ titulo, hora, icone: Icone }, indice) => (
                <li key={titulo} className="relative flex gap-3 pb-5 last:pb-0">
                  {indice < ETAPAS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-9 bottom-0 left-[17px] w-0.5",
                        indice < ATUAL ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative grid size-9 shrink-0 place-items-center rounded-full",
                      indice < ATUAL && "bg-primary text-primary-foreground",
                      indice === ATUAL && "bg-accent text-accent-foreground ring-2 ring-primary",
                      indice > ATUAL && "bg-muted text-muted-foreground",
                    )}
                  >
                    {indice < ATUAL ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <Icone className="size-4" />
                    )}
                  </span>
                  <span className="pt-1.5">
                    <span
                      className={cn(
                        "block text-sm font-semibold",
                        indice > ATUAL && "text-muted-foreground",
                      )}
                    >
                      {titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">{hora}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Entrada>
        )}
        {acompanhamento.avaliar && (
          <Entrada indice={4}>
            <Avaliar />
          </Entrada>
        )}
      </div>
    </div>
  )
}
