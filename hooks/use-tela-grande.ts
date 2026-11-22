import { useCallback, useSyncExternalStore } from "react"

function useConsultaDeTela(consulta: string) {
  const assinar = useCallback(
    (aoMudar: () => void) => {
      const lista = window.matchMedia(consulta)
      lista.addEventListener("change", aoMudar)
      return () => lista.removeEventListener("change", aoMudar)
    },
    [consulta],
  )
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}

/** Tablet para cima: painéis viram janela central em vez de subir de baixo. */
export function useTelaGrande() {
  return useConsultaDeTela("(min-width: 768px)")
}

/** Notebook para cima: o painel admin tem largura de sobra ao lado da barra lateral. */
export function useTelaLarga() {
  return useConsultaDeTela("(min-width: 1024px)")
}
