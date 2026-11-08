import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// jsdom não implementa matchMedia; hooks de tela e animações dependem dele.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom também não tem os observadores usados pelas animações de entrada e de tamanho.
class ObservadorFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
// Atribuição direta, e não vi.stubGlobal: a config desfaz os stubs antes de cada teste.
Object.assign(globalThis, {
  IntersectionObserver: ObservadorFalso,
  ResizeObserver: ObservadorFalso,
})

// jsdom não rola elementos; a barra de categorias centraliza a ativa com scrollTo.
Element.prototype.scrollTo ??= () => {}

// next/font só funciona dentro do build do Next.
vi.mock("next/font/google", () => {
  const fonte = (opcoes?: { variable?: string }) => ({
    className: "fonte",
    style: { fontFamily: "fonte" },
    variable: opcoes?.variable ?? "--fonte",
  })
  return {
    Bricolage_Grotesque: fonte,
    DM_Sans: fonte,
    Figtree: fonte,
    Fraunces: fonte,
    Outfit: fonte,
    Playfair_Display: fonte,
    Space_Grotesk: fonte,
  }
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})
