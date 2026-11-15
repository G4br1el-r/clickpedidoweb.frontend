"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import type { ItemSacola } from "@/lib/sacola"

/**
 * Artes do envio do pedido, uma por nicho, em quatro etapas (0 a 3), uma a cada mensagem.
 * Cada etapa acrescenta uma peça ao desenho: a pessoa vê o pedido sendo feito, não uma barra.
 * Cores da loja (`--primary`, `--marca-acento`) e tons neutros: vestem qualquer marca.
 */
type ArteProps = { etapa: number; itens: ItemSacola[] }

export const SAIDA = [0.23, 1, 0.32, 1] as const
export const MOLA = { type: "spring", duration: 0.55, bounce: 0.28 } as const

/** O palco comum das artes: o disco suave da loja e o desenho em 200 × 200 por cima. */
export function Palco({
  segmento,
  etapa,
  children,
}: {
  segmento: string
  etapa: number
  children: ReactNode
}) {
  return (
    <div
      className="relative grid size-72 place-items-center md:size-80"
      data-testid={`arte-envio-${segmento}`}
      data-etapa={etapa}
    >
      {/* O chão: um disco suave na cor da loja, que dá lugar ao desenho. */}
      <div
        aria-hidden="true"
        data-parte="chao"
        className="absolute inset-[8%] rounded-full bg-accent"
      />
      <svg viewBox="0 0 200 200" aria-hidden="true" className="relative size-full overflow-visible">
        {children}
      </svg>
    </div>
  )
}

/** Selo de pronto: um círculo que cresce com o visto desenhado por dentro. */
export function Pronto({ x, y, visivel }: { x: number; y: number; visivel: boolean }) {
  return (
    <AnimatePresence>
      {visivel && (
        <motion.g
          key="pronto"
          data-parte="pronto"
          style={{ transformOrigin: `${x}px ${y}px` }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={MOLA}
        >
          <circle cx={x} cy={y} r={20} fill="var(--sucesso)" />
          <motion.path
            d={`M${x - 9} ${y} l6 6 l12 -13`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, delay: 0.15, ease: SAIDA }}
          />
        </motion.g>
      )}
    </AnimatePresence>
  )
}

/** Farmácia: a receita chega, os comprimidos enchem a cartela, tudo vai para a sacola lacrada. */
export function ArteEnvioFarmacia({ etapa }: ArteProps) {
  const celulas = [0, 1, 2, 3, 4, 5]
  const ensacado = etapa >= 2
  return (
    <Palco segmento="farmacia" etapa={etapa}>
      {/* A receita, de pé atrás, com as linhas sendo escritas */}
      <motion.g
        initial={{ y: 12, opacity: 0, rotate: -6 }}
        animate={{ y: ensacado ? 26 : 0, opacity: ensacado ? 0 : 1, rotate: -6 }}
        style={{ transformOrigin: "78px 120px" }}
        transition={{ duration: 0.5, ease: SAIDA }}
      >
        <rect x={50} y={46} width={62} height={80} rx={6} fill="#FFFFFF" />
        <rect
          x={50}
          y={46}
          width={62}
          height={80}
          rx={6}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
        />
        <path
          d="M60 60 v12 M54 66 h12"
          stroke="var(--primary)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {[82, 94, 106].map((y, indice) => (
          <motion.line
            key={y}
            x1={60}
            y1={y}
            x2={indice === 2 ? 86 : 102}
            y2={y}
            stroke="#C9D3D2"
            strokeWidth={4}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, delay: 0.2 + indice * 0.12, ease: SAIDA }}
          />
        ))}
      </motion.g>

      {/* A cartela de comprimidos, à frente */}
      <motion.g
        initial={false}
        animate={{ y: ensacado ? 24 : 0, opacity: ensacado ? 0 : 1 }}
        transition={{ duration: 0.45, ease: SAIDA }}
      >
        <rect x={92} y={92} width={66} height={48} rx={10} fill="#EEF4F3" />
        <rect
          x={92}
          y={92}
          width={66}
          height={48}
          rx={10}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
        />
        {celulas.map((indice) => {
          const x = 106 + (indice % 3) * 19
          const y = 106 + Math.floor(indice / 3) * 20
          return (
            <g key={indice}>
              <circle cx={x} cy={y} r={7} fill="#FFFFFF" />
              {etapa >= 1 && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={5}
                  fill={indice % 2 ? "var(--marca-acento)" : "var(--primary)"}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...MOLA, delay: indice * 0.07 }}
                />
              )}
            </g>
          )
        })}
      </motion.g>

      {/* A sacola da farmácia sobe e fecha com a cruz */}
      <AnimatePresence>
        {ensacado && (
          <motion.g
            key="sacola"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={MOLA}
          >
            <path
              d="M64 78 h72 l6 82 a6 6 0 0 1 -6 6 h-72 a6 6 0 0 1 -6 -6 Z"
              fill="var(--primary)"
            />
            <path
              d="M84 78 v-8 a16 16 0 0 1 32 0 v8"
              fill="none"
              stroke="var(--primary)"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <path
              d="M100 104 v28 M86 118 h28"
              stroke="#FFFFFF"
              strokeWidth={8}
              strokeLinecap="round"
            />
          </motion.g>
        )}
      </AnimatePresence>
      <Pronto x={142} y={70} visivel={etapa >= 3} />
    </Palco>
  )
}

/** Adega: o copo enche a cada etapa, as bolhas sobem e, no fim, cai o gelo. */
export function ArteEnvioAdega({ etapa }: ArteProps) {
  const reduzido = useReducedMotion()
  const nivel = [150, 118, 86, 64][Math.min(etapa, 3)]
  const copo = "M64 40 h72 l-9 116 a10 10 0 0 1 -10 9 h-34 a10 10 0 0 1 -10 -9 Z"
  return (
    <Palco segmento="adega" etapa={etapa}>
      <defs>
        <clipPath id="arte-copo-adega">
          <path d={copo} />
        </clipPath>
      </defs>
      <path d={copo} fill="#FFFFFF" fillOpacity={0.7} />
      <g clipPath="url(#arte-copo-adega)">
        <motion.g
          initial={false}
          animate={{ y: nivel }}
          transition={{ duration: 0.9, ease: SAIDA }}
        >
          <rect x={40} y={0} width={120} height={200} fill="var(--marca-acento)" />
          <rect x={40} y={-8} width={120} height={12} rx={6} fill="#FFF8E7" />
        </motion.g>
        {!reduzido &&
          [80, 100, 118].map((x, indice) => (
            <motion.circle
              key={x}
              cx={x}
              r={3}
              fill="#FFFFFF"
              fillOpacity={0.7}
              initial={{ cy: 160, opacity: 0 }}
              animate={{ cy: [160, nivel + 6], opacity: [0, 1, 0] }}
              transition={{
                duration: 1.4,
                repeat: Number.POSITIVE_INFINITY,
                delay: indice * 0.45,
                ease: "easeOut",
              }}
            />
          ))}
        <AnimatePresence>
          {etapa >= 3 && (
            <motion.rect
              key="gelo"
              x={86}
              width={26}
              height={26}
              rx={6}
              fill="#E8F4FF"
              stroke="#FFFFFF"
              strokeWidth={2}
              initial={{ y: -30, rotate: -20 }}
              animate={{ y: 70, rotate: 12 }}
              transition={MOLA}
            />
          )}
        </AnimatePresence>
      </g>
      <path d={copo} fill="none" stroke="var(--primary)" strokeWidth={4} strokeLinejoin="round" />
      <Pronto x={140} y={44} visivel={etapa >= 3} />
    </Palco>
  )
}

/** Açougue: a balança espera, o corte chega, o ponteiro acha o peso e a peça é embalada. */
export function ArteEnvioAcougue({ etapa }: ArteProps) {
  const angulo = etapa >= 2 ? 32 : -60
  return (
    <Palco segmento="acougue" etapa={etapa}>
      {/* Mostrador */}
      <circle cx={100} cy={82} r={42} fill="#FFFFFF" stroke="var(--primary)" strokeWidth={4} />
      {[-60, -30, 0, 30, 60].map((marca) => (
        <line
          key={marca}
          x1={100}
          y1={46}
          x2={100}
          y2={53}
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          transform={`rotate(${marca} 100 82)`}
        />
      ))}
      <motion.line
        x1={100}
        y1={82}
        x2={100}
        y2={50}
        stroke="var(--marca-acento)"
        strokeWidth={4.5}
        strokeLinecap="round"
        style={{ transformOrigin: "100px 82px" }}
        initial={false}
        animate={{ rotate: angulo }}
        transition={{ type: "spring", duration: 1, bounce: 0.45 }}
      />
      <circle cx={100} cy={82} r={6} fill="var(--primary)" />
      {/* Prato da balança */}
      <rect x={90} y={124} width={20} height={14} fill="var(--primary)" />
      <rect x={50} y={138} width={100} height={10} rx={5} fill="var(--primary)" />
      {/* O corte */}
      <AnimatePresence>
        {etapa >= 1 && (
          <motion.g
            key="corte"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={MOLA}
          >
            <path
              d="M66 136 c4 -18 22 -24 40 -22 c16 2 30 8 30 18 c0 4 -2 4 -6 4 Z"
              fill="#B3302B"
            />
            <path
              d="M76 132 c10 -8 26 -10 40 -6"
              stroke="#F3D3C4"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>
        )}
      </AnimatePresence>
      {/* Embalagem a vácuo, que veste o corte */}
      <motion.rect
        x={60}
        y={108}
        width={82}
        height={32}
        rx={12}
        fill="#FFFFFF"
        fillOpacity={0.45}
        stroke="#FFFFFF"
        strokeWidth={3}
        style={{ transformOrigin: "101px 140px" }}
        initial={false}
        animate={{ scaleY: etapa >= 3 ? 1 : 0, opacity: etapa >= 3 ? 1 : 0 }}
        transition={{ duration: 0.45, ease: SAIDA }}
      />
      <Pronto x={146} y={50} visivel={etapa >= 3} />
    </Palco>
  )
}

/** Salão: no espelho, a tesoura apara as pontas, o cabelo ganha brilho e o horário é confirmado. */
export function ArteEnvioSalao({ etapa }: ArteProps) {
  const aparado = etapa >= 2
  const cabeloLongo =
    "M70 98 c0 -30 14 -46 30 -46 s30 16 30 46 c0 18 4 34 8 46 c-10 4 -20 4 -26 0 c-2 -8 -4 -16 -12 -18 c-8 2 -10 10 -12 18 c-6 4 -16 4 -26 0 c4 -12 8 -28 8 -46 Z"
  const cabeloCurto =
    "M70 98 c0 -30 14 -46 30 -46 s30 16 30 46 c0 10 2 20 4 28 c-8 3 -16 3 -22 0 c-2 -6 -4 -10 -12 -12 c-8 2 -10 6 -12 12 c-6 3 -14 3 -22 0 c2 -8 4 -18 4 -28 Z"
  return (
    <Palco segmento="salao" etapa={etapa}>
      {/* O espelho de bancada, com o pé */}
      <rect x={94} y={150} width={12} height={14} fill="var(--primary)" />
      <rect x={72} y={162} width={56} height={6} rx={3} fill="var(--primary)" />
      <ellipse cx={100} cy={96} rx={52} ry={62} fill="#FFFFFF" />
      <ellipse
        cx={100}
        cy={96}
        rx={52}
        ry={62}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={5}
      />
      <defs>
        <clipPath id="arte-espelho-salao">
          <ellipse cx={100} cy={96} rx={48} ry={58} />
        </clipPath>
      </defs>
      <g clipPath="url(#arte-espelho-salao)">
        {/* Ombros e rosto */}
        <path d="M58 160 c6 -20 24 -28 42 -28 s36 8 42 28 Z" fill="#F1E3EA" />
        <circle cx={100} cy={98} r={20} fill="#F3D9C8" />
        {/* Cabelo: longo até a etapa do corte, aparado depois */}
        <motion.path
          initial={false}
          animate={{ d: aparado ? cabeloCurto : cabeloLongo }}
          transition={{ duration: 0.5, ease: SAIDA }}
          fill="var(--marca-acento)"
          fillRule="evenodd"
        />
        <circle cx={100} cy={100} r={17} fill="#F3D9C8" />
        {/* Brilho do cabelo pronto */}
        <AnimatePresence>
          {aparado &&
            [
              [80, 74, 0],
              [118, 82, 0.12],
              [88, 120, 0.22],
            ].map(([x, y, atraso]) => (
              <motion.path
                key={`${x}-${y}`}
                d={`M${x} ${y - 7} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z`}
                fill="#FFFFFF"
                style={{ transformOrigin: `${x}px ${y}px` }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...MOLA, delay: atraso }}
              />
            ))}
        </AnimatePresence>
      </g>
      {/* A tesoura passa nas pontas e os fios caem */}
      <AnimatePresence>
        {etapa === 1 && (
          <motion.g
            key="corte"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 30, opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: SAIDA }}
          >
            <path
              d="M62 138 L96 124 M62 124 L96 138"
              stroke="var(--primary)"
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <circle cx={56} cy={122} r={6} fill="none" stroke="var(--primary)" strokeWidth={3.5} />
            <circle cx={56} cy={140} r={6} fill="none" stroke="var(--primary)" strokeWidth={3.5} />
          </motion.g>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {etapa === 1 &&
          [84, 100, 116].map((x, indice) => (
            <motion.line
              key={x}
              x1={x}
              y1={140}
              x2={x + 4}
              y2={148}
              stroke="var(--marca-acento)"
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: 26, opacity: [0, 1, 0] }}
              transition={{ duration: 0.9, delay: 0.35 + indice * 0.1, ease: "easeIn" }}
            />
          ))}
      </AnimatePresence>
      <Pronto x={148} y={48} visivel={etapa >= 3} />
    </Palco>
  )
}

/** Lanchonete: o pão na chapa, o hambúrguer cai chiando, o queijo derrete e o pão fecha. */
export function ArteEnvioLanchonete({ etapa }: ArteProps) {
  const reduzido = useReducedMotion()
  const camada = (visivel: boolean, chave: string, children: ReactNode, atraso = 0) => (
    <AnimatePresence>
      {visivel && (
        <motion.g
          key={chave}
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...MOLA, delay: atraso }}
        >
          {children}
        </motion.g>
      )}
    </AnimatePresence>
  )
  return (
    <Palco segmento="lanchonete" etapa={etapa}>
      {/* Chapa */}
      <rect x={34} y={150} width={132} height={10} rx={5} fill="var(--primary)" />
      {/* Pão de baixo */}
      <path
        d="M62 132 h76 a6 6 0 0 1 6 6 v4 a8 8 0 0 1 -8 8 h-72 a8 8 0 0 1 -8 -8 v-4 a6 6 0 0 1 6 -6 Z"
        fill="#E7A957"
      />
      {camada(
        etapa >= 1,
        "carne",
        <rect x={58} y={116} width={84} height={18} rx={9} fill="#6B3420" />,
      )}
      {camada(
        etapa >= 2,
        "recheio",
        <>
          <path
            d="M56 116 h88 l-8 10 l-8 -6 l-10 8 l-10 -8 l-10 8 l-10 -8 l-10 8 l-8 -6 Z"
            fill="#F4C430"
          />
          <path
            d="M54 112 q12 -8 22 0 q12 -8 24 0 q12 -8 24 0 q12 -8 22 0 v4 h-92 Z"
            fill="#7DB247"
          />
        </>,
      )}
      {camada(
        etapa >= 3,
        "pao",
        <>
          <path d="M58 108 c0 -26 18 -38 42 -38 s42 12 42 38 Z" fill="#E7A957" />
          {[
            [84, 86],
            [100, 80],
            [116, 88],
            [92, 96],
            [110, 98],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={2.6} ry={1.6} fill="#FFF3DA" />
          ))}
        </>,
      )}
      {/* Vapor da chapa */}
      {!reduzido &&
        etapa >= 1 &&
        etapa < 3 &&
        [70, 100, 130].map((x, indice) => (
          <motion.path
            key={x}
            d={`M${x} 104 c-5 -7 5 -11 0 -18 c-5 -7 5 -11 0 -18`}
            fill="none"
            stroke="var(--marca-acento)"
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0], y: [6, -4, -14] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: indice * 0.3,
              ease: "easeOut",
            }}
          />
        ))}
      <Pronto x={150} y={70} visivel={etapa >= 3} />
    </Palco>
  )
}
