import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { toast } from "sonner"
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
// A lista dos filtros (cmdk) leva a opção marcada até a vista.
Element.prototype.scrollIntoView ??= () => {}
// O Select do Radix captura o ponteiro ao abrir.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
// O Drawer (vaul) da janela do produto também captura o ponteiro ao tocar.
Element.prototype.setPointerCapture ??= () => {}

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
    Geist: fonte,
    Outfit: fonte,
    Playfair_Display: fonte,
    Space_Grotesk: fonte,
  }
})

afterEach(() => {
  cleanup()
  // O sonner guarda os avisos num estado global e repete os ainda ativos para o próximo
  // Toaster: sem dispensar, o aviso de um teste aparece no seguinte.
  toast.dismiss()
  localStorage.clear()
})

// O NumberFlow anima o número com um elemento próprio do navegador, que o jsdom não roda
// (quebra ao atualizar o valor). Nos testes, vira o número já formatado, com o mesmo rótulo.
vi.mock("@number-flow/react", async () => {
  const { createElement } = await import("react")
  return {
    default: ({
      value,
      locales,
      format,
      className,
      ...resto
    }: {
      value: number
      locales?: string
      format?: Intl.NumberFormatOptions
      className?: string
      "aria-hidden"?: boolean | "true" | "false"
      "aria-label"?: string
    }) =>
      createElement(
        "span",
        {
          className,
          "aria-hidden": resto["aria-hidden"],
          "aria-label": resto["aria-label"],
        },
        new Intl.NumberFormat(locales, format).format(value),
      ),
  }
})
