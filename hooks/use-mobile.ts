import * as React from "react"

/**
 * Abaixo disto a barra lateral do painel vira gaveta. Com 768 px (tablet em pé) a lateral aberta
 * deixava ~480 px para o conteúdo, que ainda usa os layouts de 768: tabelas cortadas e colunas
 * espremidas. A gaveta devolve a largura toda.
 */
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
