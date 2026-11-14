"use client"

import { useEffect, useState } from "react"

/**
 * Hora atual, atualizada a cada minuto. Começa em `null`: o HTML do servidor é gerado
 * em outro momento, então o que depende de "agora" só aparece depois de montar.
 */
export function useAgora(intervaloMs = 60_000): Date | null {
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    setAgora(new Date())
    const relogio = setInterval(() => setAgora(new Date()), intervaloMs)
    return () => clearInterval(relogio)
  }, [intervaloMs])
  return agora
}
