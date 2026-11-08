import { useSyncExternalStore } from "react"

const CONSULTA = "(min-width: 768px)"

function assinar(aoMudar: () => void) {
  const consulta = window.matchMedia(CONSULTA)
  consulta.addEventListener("change", aoMudar)
  return () => consulta.removeEventListener("change", aoMudar)
}

/** Tablet para cima: painéis viram janela central em vez de subir de baixo. */
export function useTelaGrande() {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  )
}
