import type { SegmentoPainelId } from "../segmentos-painel"
import type { CatalogoLoja } from "./tipos"

/**
 * Catálogo de demonstração de cada segmento. Cada um entra por importação dinâmica:
 * o painel só baixa o do segmento escolhido (a adega sozinha tem 255 produtos).
 */
export function carregarCatalogo(segmento: SegmentoPainelId): Promise<CatalogoLoja> {
  switch (segmento) {
    case "adega":
      return import("@/lib/mock/admin/adega").then((modulo) => modulo.catalogoAdega)
    case "acougue":
      return import("@/lib/mock/admin/acougue").then((modulo) => modulo.catalogoAcougue)
    case "pizzaria":
      return import("@/lib/mock/admin/pizzaria").then((modulo) => modulo.catalogoPizzaria)
    case "salao":
      return import("@/lib/mock/admin/salao").then((modulo) => modulo.catalogoSalao)
    case "lanchonete":
      return import("@/lib/mock/admin/lanchonete").then((modulo) => modulo.catalogoLanchonete)
    case "farmacia":
      return import("@/lib/mock/admin/farmacia").then((modulo) => modulo.catalogoFarmacia)
  }
}
