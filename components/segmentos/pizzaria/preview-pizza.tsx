"use client"

import { motion, useAnimationControls, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import type { Selecoes } from "@/lib/produto"
import type { GrupoOpcao, ItemOpcao, Produto } from "@/lib/tipos"
import { PizzaSvg } from "./pizza-svg"

const CURVA = [0.23, 1, 0.32, 1] as const

function escolhido(grupo: GrupoOpcao | undefined, selecoes: Selecoes) {
  return grupo?.itens.find((item) => item.id === selecoes[grupo.id])
}

/**
 * A pizza vai sendo montada conforme a pessoa escolhe sabores e borda.
 * A metade da vez se afasta um pouco, como uma fatia sendo servida; as abas logo abaixo
 * dizem em que passo a pessoa está. Pronta, ela solta vapor.
 */
export function PreviewPizza({
  produto,
  selecoes,
  grupoAtivo,
}: {
  produto: Produto
  selecoes: Selecoes
  grupoAtivo?: GrupoOpcao
}) {
  const grupos = produto.grupos ?? []
  const metades = grupos.filter((grupo) => grupo.metade)
  const grupoBorda = grupos.find((grupo) => grupo.tipo === "borda")
  const borda = escolhido(grupoBorda, selecoes)
  const esquerda = metades.find((grupo) => grupo.metade === "esquerda")
  const direita = metades.find((grupo) => grupo.metade === "direita")
  const pronta = grupos.every((grupo) => !grupo.obrigatorio || selecoes[grupo.id])

  const destaque = pronta
    ? null
    : !grupoAtivo
      ? null
      : grupoAtivo.tipo === "borda"
        ? "borda"
        : (grupoAtivo.metade ?? null)

  const sabores: [string | null] | [string | null, string | null] =
    metades.length > 0
      ? [escolhido(esquerda, selecoes)?.nome ?? null, escolhido(direita, selecoes)?.nome ?? null]
      : [produto.nome]

  // Um assentar curto a cada escolha: a pizza "pula" de leve no prato e gira um pouco,
  // como quem ajeita a pizza na pá. Com movimento reduzido, ela só muda o recheio.
  const reduzido = useReducedMotion()
  const pulo = useAnimationControls()
  const chave = JSON.stringify(selecoes)
  const anterior = useRef(chave)
  useEffect(() => {
    if (chave === anterior.current) return
    anterior.current = chave
    if (reduzido) return
    void pulo.start({
      y: [0, -6, 0],
      rotate: [0, -4, 0],
      scale: [1, 1.03, 1],
      transition: { duration: 0.42, ease: CURVA },
    })
  }, [chave, pulo, reduzido])

  return (
    <div className="flex w-full flex-col items-center" data-testid="preview-produto">
      <motion.div
        animate={pulo}
        className="relative size-32 sm:size-40 md:size-44 [@media(max-height:700px)]:size-28 [@media(max-height:500px)]:size-16"
      >
        {/* Sombra de prato, para a pizza não flutuar. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-4 -bottom-2 h-5 rounded-[50%] bg-black/20 blur-md dark:bg-black/50"
        />
        <PizzaSvg
          sabores={sabores}
          borda={{ cor: borda?.cor, recheada: borda?.realce }}
          destaque={destaque}
          pronta={pronta}
          className="relative size-full drop-shadow-lg"
        />
      </motion.div>
    </div>
  )
}

/** Miniatura de cada opção da lista: o sabor desenhado, ou a borda em volta de uma pizza simples. */
export function MiniaturaPizza({ grupo, item }: { grupo: GrupoOpcao; item: ItemOpcao }) {
  return grupo.tipo === "borda" ? (
    <PizzaSvg
      sabores={["mussarela"]}
      borda={{ cor: item.cor, recheada: item.realce }}
      estatica
      className="size-full"
    />
  ) : (
    <PizzaSvg sabores={[item.nome]} estatica className="size-full" />
  )
}
