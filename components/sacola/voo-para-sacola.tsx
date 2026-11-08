"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { useVoos } from "@/lib/voo"

const TAMANHO = 64

/** Camada dos itens em voo; não recebe cliques e fica fora da leitura de tela. */
export function VooParaSacola() {
  const voos = useVoos((estado) => estado.voos)
  const concluir = useVoos((estado) => estado.concluir)

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {voos.map(({ id, imagem, de, para }) => (
        <motion.div
          key={id}
          data-testid="voo"
          className="absolute top-0 left-0 overflow-hidden rounded-full ring-2 ring-white"
          style={{ width: TAMANHO, height: TAMANHO }}
          initial={{ x: de.x - TAMANHO / 2, y: de.y - TAMANHO / 2, scale: 0.7, opacity: 0 }}
          animate={{
            x: para.x - TAMANHO / 2,
            y: [de.y - TAMANHO / 2, Math.min(de.y, para.y) - 90, para.y - TAMANHO / 2],
            scale: [0.7, 1.05, 0.3],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 0.62,
            ease: [0.32, 0.72, 0, 1],
            y: { duration: 0.62, ease: "easeInOut" },
            opacity: { duration: 0.62, times: [0, 0.12, 0.85, 1] },
          }}
          onAnimationComplete={() => concluir(id)}
        >
          <Image src={imagem} alt="" fill sizes="64px" className="object-cover" />
        </motion.div>
      ))}
    </div>
  )
}
