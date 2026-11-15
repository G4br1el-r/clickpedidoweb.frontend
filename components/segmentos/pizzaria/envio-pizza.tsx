"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ItemSacola } from "@/lib/sacola"
import { MOLA, Palco, Pronto, SAIDA } from "../artes-envio"

export const MENSAGENS_ENVIO_PIZZA = [
  "Abrindo a massa",
  "Caprichando no recheio",
  "Cortando as fatias",
  "Saindo quentinha!",
]

/* Paleta de ilustração da pizza: só dentro da arte. */
const MASSA = "#EED7AE"
const BORDA = "#DDB27A"
const MOLHO = "#C8452C"
const QUEIJO = "#F5D27A"
const CORTE = "#FBEFD6"

/** Centro e raios da pizza no desenho de 200 × 200. */
const CX = 100
const CY = 106
const R_BORDA = 66
const R_MOLHO = 57

type Cobertura = "calabresa" | "queijo" | "frango" | "marguerita" | "portuguesa"

/** A cobertura de cada metade sai do sabor do pedido; sem pista, vai calabresa. */
function coberturaDo(sabor: string | null): Cobertura {
  const nome = (sabor ?? "").toLowerCase()
  if (/mussarela|queijo|quatro/.test(nome)) return "queijo"
  if (/frango/.test(nome)) return "frango"
  if (/marguerita|napolitana|tomate/.test(nome)) return "marguerita"
  if (/portuguesa/.test(nome)) return "portuguesa"
  return "calabresa"
}

/** Sabores da primeira pizza do pedido: as escolhas que não são borda, ou o próprio nome. */
function saboresDoPedido(itens: ItemSacola[]): [Cobertura, Cobertura] {
  const pizza = itens.find((item) => item.resumo.some((parte) => !parte.startsWith("Borda")))
  const sabores = pizza?.resumo.filter((parte) => !parte.startsWith("Borda")) ?? []
  const primeiro = coberturaDo(sabores[0] ?? pizza?.nome ?? itens[0]?.nome ?? null)
  return [primeiro, coberturaDo(sabores[1] ?? sabores[0] ?? null) ?? primeiro]
}

/** Pontos de cobertura de uma metade (esquerda: x < CX). */
const PONTOS_ESQUERDA = [
  [72, 86],
  [80, 112],
  [66, 128],
  [88, 136],
  [86, 76],
  [62, 104],
]
const espelhar = ([x, y]: number[]) => [2 * CX - x, y]

function Cobertura({
  tipo,
  pontos,
  atraso,
}: {
  tipo: Cobertura
  pontos: number[][]
  atraso: number
}) {
  return (
    <>
      {pontos.map(([x, y], indice) => {
        const transicao = { ...MOLA, delay: atraso + indice * 0.05 }
        const chave = `${x}-${y}`
        const origem = { transformOrigin: `${x}px ${y}px` }
        const entrada = { initial: { scale: 0.3, opacity: 0 }, animate: { scale: 1, opacity: 1 } }
        if (tipo === "calabresa")
          return (
            <motion.g key={chave} style={origem} {...entrada} transition={transicao}>
              <circle cx={x} cy={y} r={7} fill="#B3302B" />
              <circle cx={x - 2} cy={y - 2} r={1.6} fill="#E8826E" />
            </motion.g>
          )
        if (tipo === "queijo")
          return (
            <motion.ellipse
              key={chave}
              cx={x}
              cy={y}
              rx={8}
              ry={5}
              fill="#FFF3C4"
              style={origem}
              {...entrada}
              transition={transicao}
            />
          )
        if (tipo === "frango")
          return (
            <motion.rect
              key={chave}
              x={x - 6}
              y={y - 4}
              width={12}
              height={8}
              rx={3}
              fill="#E9C9A0"
              style={origem}
              {...entrada}
              transition={transicao}
            />
          )
        if (tipo === "marguerita")
          return indice % 2 ? (
            <motion.path
              key={chave}
              d={`M${x - 6} ${y} q6 -8 12 0 q-6 6 -12 0 Z`}
              fill="#5E8C3A"
              style={origem}
              {...entrada}
              transition={transicao}
            />
          ) : (
            <motion.circle
              key={chave}
              cx={x}
              cy={y}
              r={7}
              fill="#E0533B"
              stroke="#F3A08F"
              strokeWidth={1.5}
              style={origem}
              {...entrada}
              transition={transicao}
            />
          )
        return indice % 2 ? (
          <motion.circle
            key={chave}
            cx={x}
            cy={y}
            r={4}
            fill="#2E2A25"
            style={origem}
            {...entrada}
            transition={transicao}
          />
        ) : (
          <motion.g key={chave} style={origem} {...entrada} transition={transicao}>
            <circle cx={x} cy={y} r={7} fill="#FFFFFF" />
            <circle cx={x} cy={y} r={3.2} fill="#F2B233" />
          </motion.g>
        )
      })}
    </>
  )
}

/** A fatia de cima à direita (de -90° a -45°), em coordenadas do desenho. */
function setor(raio: number) {
  const fim = (-45 * Math.PI) / 180
  const x = CX + Math.cos(fim) * raio
  const y = CY + Math.sin(fim) * raio
  return `M${CX} ${CY} L${CX} ${CY - raio} A${raio} ${raio} 0 0 1 ${x} ${y} Z`
}

/**
 * Pizzaria: a massa abre, o recheio entra metade a metade (pela cobertura de cada sabor),
 * a pizza é cortada em oito e uma fatia sai fumegando. Desenho plano, no mesmo palco,
 * traço e selo dos outros nichos.
 */
export function ArteEnvioPizza({ etapa, itens }: { etapa: number; itens: ItemSacola[] }) {
  const reduzido = useReducedMotion()
  const [esquerda, direita] = saboresDoPedido(itens)
  const cortes = [0, 45, 90, 135]

  return (
    <Palco segmento="pizzaria" etapa={etapa}>
      <defs>
        <clipPath id="pizza-metade-esquerda">
          <rect x={0} y={0} width={CX} height={200} />
        </clipPath>
        <clipPath id="pizza-metade-direita">
          <rect x={CX} y={0} width={100} height={200} />
        </clipPath>
      </defs>

      {/* A massa aberta, com a borda */}
      <motion.g
        data-parte="massa"
        style={{ transformOrigin: `${CX}px ${CY}px` }}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={MOLA}
      >
        <circle cx={CX} cy={CY} r={R_BORDA} fill={BORDA} />
        <circle cx={CX} cy={CY} r={R_BORDA - 6} fill={MASSA} />
      </motion.g>

      {/* Molho do centro para fora, queijo e a cobertura de cada metade */}
      <AnimatePresence>
        {etapa >= 1 && (
          <motion.g key="recheio" data-parte="recheio">
            <motion.circle
              cx={CX}
              cy={CY}
              r={R_MOLHO}
              fill={MOLHO}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              initial={{ scale: 0.2 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.55, ease: SAIDA }}
            />
            <motion.circle
              cx={CX}
              cy={CY}
              r={R_MOLHO - 5}
              fill={QUEIJO}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: SAIDA }}
            />
            <g clipPath="url(#pizza-metade-esquerda)">
              <Cobertura tipo={esquerda} pontos={PONTOS_ESQUERDA} atraso={0.4} />
            </g>
            <g clipPath="url(#pizza-metade-direita)">
              <Cobertura tipo={direita} pontos={PONTOS_ESQUERDA.map(espelhar)} atraso={0.55} />
            </g>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Oito fatias: quatro cortes riscados um depois do outro */}
      <AnimatePresence>
        {etapa >= 2 && (
          <g key="cortes" data-parte="cortes">
            {cortes.map((angulo, indice) => {
              const rad = (angulo * Math.PI) / 180
              const dx = Math.cos(rad) * (R_BORDA - 2)
              const dy = Math.sin(rad) * (R_BORDA - 2)
              return (
                <motion.line
                  key={angulo}
                  x1={CX - dx}
                  y1={CY - dy}
                  x2={CX + dx}
                  y2={CY + dy}
                  stroke={CORTE}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: indice * 0.18, ease: SAIDA }}
                />
              )
            })}
          </g>
        )}
      </AnimatePresence>

      {/* A fatia sai: o lugar dela fica vazio e ela se afasta, inteira */}
      <AnimatePresence>
        {etapa >= 3 && (
          <g key="fatia" data-parte="fatia">
            <path d={setor(R_BORDA + 1)} fill="var(--accent)" />
            <motion.g
              initial={{ x: 0, y: 0, rotate: 0 }}
              animate={{ x: 16, y: -16, rotate: 6 }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              transition={MOLA}
            >
              <path d={setor(R_BORDA)} fill={BORDA} />
              <path d={setor(R_BORDA - 6)} fill={MASSA} />
              <path d={setor(R_MOLHO)} fill={MOLHO} />
              <path d={setor(R_MOLHO - 5)} fill={QUEIJO} />
              <circle cx={CX + 18} cy={CY - 34} r={6} fill="#B3302B" />
            </motion.g>
          </g>
        )}
      </AnimatePresence>

      {/* Vapor saindo da fatia quente */}
      {etapa >= 3 && (
        <g data-parte="vapor">
          {[118, 130, 142].map((x, indice) => (
            <motion.path
              key={x}
              d={`M${x} 46 c-4 -6 4 -9 0 -15 c-4 -6 4 -9 0 -15`}
              fill="none"
              stroke="var(--marca-acento)"
              strokeWidth={2.6}
              strokeLinecap="round"
              initial={{ opacity: reduzido ? 0.6 : 0 }}
              animate={reduzido ? undefined : { opacity: [0, 0.8, 0], y: [6, -2, -10] }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: indice * 0.3,
                ease: "easeOut",
              }}
            />
          ))}
        </g>
      )}

      <Pronto x={48} y={52} visivel={etapa >= 3} />
    </Palco>
  )
}
