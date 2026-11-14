import { vitrineDoCatalogo } from "../vitrine"
import { catalogoAcougue } from "./admin/acougue"
import { catalogoAdega } from "./admin/adega"
import { catalogoLanchonete } from "./admin/lanchonete"
import { catalogoSalao } from "./admin/salao"

/**
 * As vitrines das lojas de referência do painel: o mesmo catálogo, visto pelo cliente.
 * As cores de cada uma combinam com o segmento.
 */

export const vitrineAdega = vitrineDoCatalogo(catalogoAdega, {
  id: "adega-da-vila",
  segmento: "adega",
  // Vinho escuro com dourado de rótulo.
  tema: { primaria: "#5B1A3A", acento: "#C99A1E", fundo: "#F7F3F5", tinta: "#1E1218" },
  logo: "/mock/admin/adega/logo.jpg",
  banner: "/mock/admin/adega/banner.jpg",
})

export const vitrineAcougue = vitrineDoCatalogo(catalogoAcougue, {
  id: "acougue-sabor-da-carne",
  segmento: "acougue",
  // Vermelho de carne com dourado de brasa.
  tema: { primaria: "#9F1D1D", acento: "#E2A33B", fundo: "#F8F4F1", tinta: "#2A1712" },
  logo: "/mock/admin/acougue/logo.jpg",
  banner: "/mock/admin/acougue/banner.jpg",
})

export const vitrineSalao = vitrineDoCatalogo(catalogoSalao, {
  id: "emporio-das-deusas",
  segmento: "salao",
  // Rosé com dourado.
  tema: { primaria: "#9D3C6E", acento: "#B8892A", fundo: "#FBF5F7", tinta: "#2B1622" },
  logo: "/mock/admin/salao/logo.jpg",
  banner: "/mock/admin/salao/banner.jpg",
})

export const vitrineQuiosque = vitrineDoCatalogo(catalogoLanchonete, {
  id: "quiosque-do-mineiro",
  segmento: "lanchonete",
  // Laranja de fogão a lenha com verde de Minas.
  tema: { primaria: "#C2410C", acento: "#15803D", fundo: "#FBF7EF", tinta: "#2A1A0E" },
  logo: "/mock/admin/lanchonete/logo.jpg",
  banner: "/mock/vitrine/quiosque-banner.jpg",
})
