"use client"

import { useEffect, useState } from "react"

/**
 * Largura que um elemento tem de fato, e não a da janela: com a barra lateral aberta, um tablet
 * de 768 px deixa menos de 500 px para o conteúdo. `null` até a primeira medida (no servidor e
 * no primeiro quadro), para quem usa decidir com cuidado o que mostrar enquanto não se sabe.
 */
export function useLarguraDoElemento() {
  const [elemento, ref] = useState<HTMLElement | null>(null)
  const [largura, setLargura] = useState<number | null>(null)

  useEffect(() => {
    if (!elemento) return
    setLargura(Math.round(elemento.getBoundingClientRect().width))
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setLargura(Math.round(entrada.contentRect.width))
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [elemento])

  return { ref, largura }
}
