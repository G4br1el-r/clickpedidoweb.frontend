import type { Banner, Categoria, Loja } from "../tipos"
import { vitrineDoCatalogo } from "../vitrine"
import { catalogoFarmacia } from "./admin/farmacia"

/**
 * Drogaria Bem Estar na vitrine: o mesmo catálogo do painel (lib/mock/admin/farmacia.ts),
 * com as fotos das embalagens desenhadas para a demonstração e banners escritos à mão.
 */
const base = vitrineDoCatalogo(catalogoFarmacia, {
  id: "drogaria-bem-estar",
  segmento: "farmacia",
  // As mesmas cores da farmácia no painel (lib/admin/tema-segmento.ts).
  tema: { primaria: "#0F766E", acento: "#16A34A", fundo: "#F2F7F6", tinta: "#10201F" },
  logo: "/mock/farmacia/logo.png",
  banner: "/mock/farmacia/banner.jpg",
})

const fotoDe = (id: string) => {
  const produto = base.categorias
    .flatMap((categoria) => categoria.produtos)
    .find((item) => item.id === id)
  if (!produto) throw new Error(`O banner aponta para um produto que não existe: ${id}`)
  return produto.imagem
}

const banners: Banner[] = [
  {
    id: "receita",
    selo: "Receita pelo app",
    titulo: "Remédio de uso contínuo sem fila",
    texto: "Escolha, mande a foto da receita no fim do pedido e receba em casa.",
    chamada: "Ver uso contínuo",
    imagem: fotoDe("losartana-50"),
    acao: { tipo: "categoria", categoriaId: "uso-continuo" },
  },
  {
    id: "dermo",
    titulo: "Proteção solar",
    texto: "Protetor e hidratante para todo dia.",
    imagem: fotoDe("protetor-50"),
    acao: { tipo: "categoria", categoriaId: "dermocosmeticos" },
  },
  {
    id: "vitaminas",
    titulo: "Imunidade em dia",
    texto: "Vitaminas e suplementos.",
    imagem: fotoDe("vitamina-c"),
    acao: { tipo: "categoria", categoriaId: "vitaminas" },
  },
  {
    id: "oferta-omega",
    selo: "Oferta da semana",
    titulo: "Ômega 3 1.000 mg",
    texto: "Frasco com 120 cápsulas.",
    imagem: fotoDe("omega-3"),
    acao: { tipo: "produto", produtoId: "omega-3" },
  },
]

export const drogariaBemEstar: Loja<"farmacia"> = { ...base.loja, banners }

export const cardapioDrogariaBemEstar: Categoria<"farmacia">[] = base.categorias
