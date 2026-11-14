"use client"

import { useEffect, useState } from "react"

/**
 * O valor só depois de ficar `espera` ms sem mudar. Começa com o valor inicial, sem esperar.
 * Serve para o que mexe no layout acompanhar a rolagem só quando ela assenta.
 */
export function useValorAssentado<T>(valor: T, espera: number): T {
  const [assentado, setAssentado] = useState(valor)
  useEffect(() => {
    const relogio = setTimeout(() => setAssentado(valor), espera)
    return () => clearTimeout(relogio)
  }, [valor, espera])
  return assentado
}
