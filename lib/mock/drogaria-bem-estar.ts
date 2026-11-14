import type { StaticImageData } from "next/image"
import alcoolGel from "@/public/mock/farmacia/alcool-gel.jpg"
import amoxicilina500 from "@/public/mock/farmacia/amoxicilina-500.jpg"
import antigripal from "@/public/mock/farmacia/antigripal.jpg"
import azitromicina500 from "@/public/mock/farmacia/azitromicina-500.jpg"
import banner from "@/public/mock/farmacia/banner.jpg"
import cefalexina500 from "@/public/mock/farmacia/cefalexina-500.jpg"
import clonazepam2 from "@/public/mock/farmacia/clonazepam-2.jpg"
import cremeDental from "@/public/mock/farmacia/creme-dental.jpg"
import dipirona500 from "@/public/mock/farmacia/dipirona-500.jpg"
import dorflex from "@/public/mock/farmacia/dorflex.jpg"
import escovaDental from "@/public/mock/farmacia/escova-dental.jpg"
import fluoxetina20 from "@/public/mock/farmacia/fluoxetina-20.jpg"
import fraldaG from "@/public/mock/farmacia/fralda-g.jpg"
import hidratante from "@/public/mock/farmacia/hidratante.jpg"
import ibuprofeno400 from "@/public/mock/farmacia/ibuprofeno-400.jpg"
import insulinaNph from "@/public/mock/farmacia/insulina-nph.jpg"
import levotiroxina50 from "@/public/mock/farmacia/levotiroxina-50.jpg"
import logo from "@/public/mock/farmacia/logo.png"
import losartana50 from "@/public/mock/farmacia/losartana-50.jpg"
import metformina850 from "@/public/mock/farmacia/metformina-850.jpg"
import metilfenidato10 from "@/public/mock/farmacia/metilfenidato-10.jpg"
import omega3 from "@/public/mock/farmacia/omega-3.jpg"
import paracetamol750 from "@/public/mock/farmacia/paracetamol-750.jpg"
import pomadaAssaduras from "@/public/mock/farmacia/pomada-assaduras.jpg"
import protetor50 from "@/public/mock/farmacia/protetor-50.jpg"
import sertralina50 from "@/public/mock/farmacia/sertralina-50.jpg"
import sinvastatina20 from "@/public/mock/farmacia/sinvastatina-20.jpg"
import soroNasal from "@/public/mock/farmacia/soro-nasal.jpg"
import vitaminaC from "@/public/mock/farmacia/vitamina-c.jpg"
import vitaminaD from "@/public/mock/farmacia/vitamina-d.jpg"
import xaropeTosse from "@/public/mock/farmacia/xarope-tosse.jpg"
import zolpidem10 from "@/public/mock/farmacia/zolpidem-10.jpg"
import type { Categoria, Loja, Produto } from "../tipos"
import { catalogoFarmacia } from "./admin/farmacia"

/**
 * Drogaria Bem Estar na vitrine: o mesmo catálogo do painel (lib/mock/admin/farmacia.ts),
 * com as fotos das embalagens desenhadas para a demonstração.
 */

const FOTOS: Record<string, StaticImageData> = {
  "alcool-gel": alcoolGel,
  "amoxicilina-500": amoxicilina500,
  antigripal,
  "azitromicina-500": azitromicina500,
  "cefalexina-500": cefalexina500,
  "clonazepam-2": clonazepam2,
  "creme-dental": cremeDental,
  "dipirona-500": dipirona500,
  dorflex,
  "escova-dental": escovaDental,
  "fluoxetina-20": fluoxetina20,
  "fralda-g": fraldaG,
  hidratante,
  "ibuprofeno-400": ibuprofeno400,
  "insulina-nph": insulinaNph,
  "levotiroxina-50": levotiroxina50,
  "losartana-50": losartana50,
  "metformina-850": metformina850,
  "metilfenidato-10": metilfenidato10,
  "omega-3": omega3,
  "paracetamol-750": paracetamol750,
  "pomada-assaduras": pomadaAssaduras,
  "protetor-50": protetor50,
  "sertralina-50": sertralina50,
  "sinvastatina-20": sinvastatina20,
  "soro-nasal": soroNasal,
  "vitamina-c": vitaminaC,
  "vitamina-d": vitaminaD,
  "xarope-tosse": xaropeTosse,
  "zolpidem-10": zolpidem10,
}

const TIPOS: Record<string, Produto<"farmacia">["tipo"]> = {
  vitaminas: "vitamina",
  dermocosmeticos: "dermocosmetico",
  higiene: "higiene",
  "mamae-bebe": "infantil",
}

const semPrefixo = (id: string) => id.replace(/^(prod|cat)-/, "")

export const cardapioDrogariaBemEstar: Categoria<"farmacia">[] = catalogoFarmacia.categorias
  .toSorted((a, b) => a.ordem - b.ordem)
  .map((categoria) => ({
    id: semPrefixo(categoria.id),
    nome: categoria.nome,
    produtos: catalogoFarmacia.produtos
      .filter((produto) => produto.categoriaId === categoria.id && produto.ativo)
      .toSorted((a, b) => a.ordem - b.ordem)
      .map((produto) => {
        const id = semPrefixo(produto.id)
        return {
          id,
          tipo: TIPOS[semPrefixo(categoria.id)] ?? "medicamento",
          nome: produto.nome,
          descricao: produto.descricao,
          preco: produto.preco,
          ...(produto.precoOriginal ? { precoOriginal: produto.precoOriginal } : {}),
          imagem: FOTOS[id],
          ...(produto.destaque ? { destaque: true } : {}),
          ...(produto.medicamento ? { medicamento: produto.medicamento } : {}),
        }
      }),
  }))

const { loja } = catalogoFarmacia

export const drogariaBemEstar: Loja<"farmacia"> = {
  id: "drogaria-bem-estar",
  segmento: "farmacia",
  nome: loja.nome,
  slogan: loja.slogan,
  logo,
  banner,
  status: { aberta: true, texto: "Aberto até 23h" },
  entrega: {
    tempo: "30–50 min",
    taxa: Math.min(...catalogoFarmacia.bairros.map((bairro) => bairro.taxa)),
    bairros: catalogoFarmacia.bairros.map(({ nome, taxa }) => ({ nome, taxa })),
  },
  retirada: { tempo: "15 min" },
  pedidoMinimo: loja.pedidoMinimo,
  horarios: [{ dia: "Todos os dias", horario: "7h às 23h" }],
  endereco: "Av. São João, 870, Jardim Esplanada",
  telefone: "(12) 98877-6655",
  pagamentos: ["Pix", "Cartão online", "Dinheiro", "Cartão na entrega"],
  // As mesmas cores da farmácia no painel (lib/admin/tema-segmento.ts).
  tema: { primaria: "#0F766E", acento: "#16A34A", fundo: "#F2F7F6", tinta: "#10201F" },
  banners: [
    {
      id: "receita",
      selo: "Receita pelo app",
      titulo: "Remédio de uso contínuo sem fila",
      texto: "Escolha, mande a foto da receita no fim do pedido e receba em casa.",
      chamada: "Ver uso contínuo",
      imagem: losartana50,
      acao: { tipo: "categoria", categoriaId: "uso-continuo" },
    },
    {
      id: "dermo",
      titulo: "Proteção solar",
      texto: "Protetor e hidratante para todo dia.",
      imagem: protetor50,
      acao: { tipo: "categoria", categoriaId: "dermocosmeticos" },
    },
    {
      id: "vitaminas",
      titulo: "Imunidade em dia",
      texto: "Vitaminas e suplementos.",
      imagem: vitaminaC,
      acao: { tipo: "categoria", categoriaId: "vitaminas" },
    },
    {
      id: "oferta-omega",
      selo: "Oferta da semana",
      titulo: "Ômega 3 1.000 mg",
      texto: "Frasco com 120 cápsulas.",
      imagem: omega3,
      acao: { tipo: "produto", produtoId: "omega-3" },
    },
  ],
}
