import {
  Bricolage_Grotesque,
  DM_Sans,
  Figtree,
  Fraunces,
  Outfit,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google"
import type { FonteTexto, FonteTitulo } from "./config"

/* Só o painel carrega estas fontes: a loja continua baixando apenas as dela. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--fonte-bricolage",
  weight: ["600", "700", "800"],
})
const figtree = Figtree({ subsets: ["latin"], variable: "--fonte-figtree" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--fonte-fraunces" })
const space = Space_Grotesk({ subsets: ["latin"], variable: "--fonte-space" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--fonte-playfair" })
const dm = DM_Sans({ subsets: ["latin"], variable: "--fonte-dm" })
const outfit = Outfit({ subsets: ["latin"], variable: "--fonte-outfit" })

/** Classes que declaram as variáveis das fontes; vão no painel e nos portais da prévia. */
export const VARIAVEIS_FONTES = [bricolage, figtree, fraunces, space, playfair, dm, outfit]
  .map((fonte) => fonte.variable)
  .join(" ")

export const FONTES_TITULO: Record<FonteTitulo, { nome: string; css: string }> = {
  bricolage: { nome: "Bricolage", css: "var(--fonte-bricolage)" },
  figtree: { nome: "Figtree", css: "var(--fonte-figtree)" },
  fraunces: { nome: "Fraunces", css: "var(--fonte-fraunces)" },
  space: { nome: "Space Grotesk", css: "var(--fonte-space)" },
  playfair: { nome: "Playfair", css: "var(--fonte-playfair)" },
}

export const FONTES_TEXTO: Record<FonteTexto, { nome: string; css: string }> = {
  figtree: { nome: "Figtree", css: "var(--fonte-figtree)" },
  dm: { nome: "DM Sans", css: "var(--fonte-dm)" },
  outfit: { nome: "Outfit", css: "var(--fonte-outfit)" },
}
