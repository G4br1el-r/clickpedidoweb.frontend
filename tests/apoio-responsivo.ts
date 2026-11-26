import type { Page } from "@playwright/test"

/**
 * Todo controle visível precisa de 44 px para o dedo. O painel amplia o toque por fora, com um
 * `::after` absoluto (sem mexer no desenho), e numa caixa de marcar vale o rótulo inteiro; a medida
 * considera os dois, que é o que o dedo realmente alcança.
 */
export async function controlesPequenos(page: Page) {
  return page.evaluate(() => {
    const seletor =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="radio"], [role="switch"], [role="checkbox"], [role="combobox"], [role="menuitem"]'
    const MINIMO = 44
    return Array.from(document.querySelectorAll(seletor)).flatMap((elemento) => {
      if (!(elemento as HTMLElement).checkVisibility({ visibilityProperty: true })) return []
      if (elemento.closest("[aria-hidden='true'], [inert], .sr-only")) return []
      const caixa = elemento.getBoundingClientRect()
      if (caixa.width <= 1 || caixa.height <= 1) return []
      // Fora da tela (a barra lateral recolhida fica deslocada): o dedo não chega lá.
      if (caixa.right <= 0 || caixa.left >= window.innerWidth) return []
      let largura = caixa.width
      let altura = caixa.height
      const rotulo = elemento.closest("label")
      if (rotulo) {
        const c = rotulo.getBoundingClientRect()
        largura = Math.max(largura, c.width)
        altura = Math.max(altura, c.height)
      }
      for (const pseudo of ["::before", "::after"] as const) {
        const estilo = getComputedStyle(elemento, pseudo)
        if (estilo.content === "none" || estilo.position !== "absolute") continue
        largura = Math.max(largura, Number.parseFloat(estilo.width) || 0)
        altura = Math.max(altura, Number.parseFloat(estilo.height) || 0)
      }
      // Campo de texto é largo e o dedo cai em qualquer ponto: 32 px de altura bastam.
      const ehCampo = elemento.matches(
        'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [role="combobox"]',
      )
      const minimoAltura = ehCampo ? 32 : MINIMO
      const minimoLargura = ehCampo ? 44 : MINIMO
      if (Math.round(largura) >= minimoLargura && Math.round(altura) >= minimoAltura) return []
      const nome =
        elemento.getAttribute("aria-label") ?? elemento.textContent?.trim() ?? elemento.tagName
      return [`${nome.slice(0, 40)}: ${Math.round(largura)}x${Math.round(altura)}`]
    })
  })
}

/**
 * Botão ou link cujo texto visível passa da borda: o que ele diz fica cortado ou por cima do
 * vizinho. Texto só para leitor de tela e reticências de propósito (`truncate`) não contam.
 */
export async function botoesCortados(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a[href]")).flatMap((elemento) => {
      if (!(elemento as HTMLElement).checkVisibility({ visibilityProperty: true })) return []
      if (elemento.closest("[aria-hidden='true'], [inert], .sr-only")) return []
      const texto = elemento.textContent?.trim() ?? ""
      if (!texto) return []
      // Um botão que corta o que diz: o texto que se vê passa da borda do botão. O texto só para
      // leitor de tela (.sr-only) não conta.
      const caixa = elemento.getBoundingClientRect()
      const percorrer = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT)
      let passa = 0
      for (let no = percorrer.nextNode(); no; no = percorrer.nextNode()) {
        if (!no.textContent?.trim() || no.parentElement?.closest(".sr-only, number-flow-react"))
          continue
        // Reticências de propósito (`truncate`): o botão avisa que cortou, não esconde.
        let pai = no.parentElement
        let reticencias = false
        while (pai && pai !== elemento.parentElement) {
          if (getComputedStyle(pai).textOverflow === "ellipsis") reticencias = true
          pai = pai.parentElement
        }
        if (reticencias) continue
        const faixa = document.createRange()
        faixa.selectNodeContents(no)
        const { left, right, width } = faixa.getBoundingClientRect()
        if (width === 0) continue
        passa = Math.max(passa, caixa.left - left, right - caixa.right)
      }
      return passa > 1
        ? [
            `${texto.slice(0, 40)}: passa ${Math.round(passa)}px (botão com ${Math.round(caixa.width)}px)`,
          ]
        : []
    }),
  )
}
