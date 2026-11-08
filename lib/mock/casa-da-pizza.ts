import bannerPizza from "@/public/mock/banner-pizza.jpg"
import calabresa from "@/public/mock/calabresa.jpg"
import calzone from "@/public/mock/calzone.jpg"
import doce from "@/public/mock/doce.jpg"
import forno from "@/public/mock/forno.jpg"
import frango from "@/public/mock/frango.jpg"
import logo from "@/public/mock/logo.webp"
import marguerita from "@/public/mock/marguerita.jpg"
import pepperoni from "@/public/mock/pepperoni.jpg"
import queijos from "@/public/mock/queijos.jpg"
import refrigerante from "@/public/mock/refrigerante.jpg"
import type { Categoria, GrupoOpcao, ItemOpcao, Loja } from "../tipos"

export const casaDaPizza: Loja<"pizzaria"> = {
  id: "casa-da-pizza",
  segmento: "pizzaria",
  nome: "Casa da Pizza",
  slogan: "Forno a lenha e tradição italiana",
  logo,
  banner: forno,
  status: { aberta: true, texto: "Aberto até 23h30" },
  entrega: {
    tempo: "35–50 min",
    taxa: 6,
    bairros: [
      { nome: "Centro", taxa: 6 },
      { nome: "Vila Ema", taxa: 7 },
      { nome: "Jardim Esplanada", taxa: 7 },
      { nome: "Jardim Aquarius", taxa: 8 },
      { nome: "Jardim Satélite", taxa: 9 },
      { nome: "Bosque dos Eucaliptos", taxa: 10 },
      { nome: "Urbanova", taxa: 12 },
    ],
  },
  retirada: { tempo: "20–30 min" },
  pedidoMinimo: 30,
  horarios: [
    { dia: "Segunda", horario: "Fechado" },
    { dia: "Terça a domingo", horario: "18h às 23h30" },
  ],
  endereco: "Av. da Tradição Italiana, 120, Centro",
  telefone: "(12) 99888-7766",
  pagamentos: ["Pix", "Cartão online", "Dinheiro", "Cartão na entrega"],
  tema: {
    primaria: "#0B4F9C",
    acento: "#C8321F",
    fundo: "#F5F6F8",
    tinta: "#14202E",
  },
  banners: [
    {
      id: "meio-a-meio",
      selo: "Monte a sua",
      titulo: "Meio a meio, do seu jeito",
      texto: "Dois sabores na mesma pizza e a borda que você quiser.",
      chamada: "Montar minha pizza",
      imagem: bannerPizza,
      acao: { tipo: "produto", produtoId: "meio-a-meio" },
    },
    {
      id: "doces",
      titulo: "Tem pizza doce",
      texto: "Chocolate com confeitos para fechar a noite.",
      imagem: doce,
      acao: { tipo: "categoria", categoriaId: "doces" },
    },
    {
      id: "bebidas",
      titulo: "Bebida gelada",
      texto: "Refri para acompanhar a sua pizza.",
      imagem: refrigerante,
      acao: { tipo: "categoria", categoriaId: "bebidas" },
    },
    {
      id: "oferta-calabresa",
      selo: "Preço especial",
      titulo: "Calabresa Especial",
      texto: "Calabresa artesanal, cebola e azeitonas pretas.",
      imagem: calabresa,
      acao: { tipo: "produto", produtoId: "calabresa" },
    },
  ],
}

const sabores: ItemOpcao[] = [
  {
    id: "calabresa",
    nome: "Calabresa Especial",
    descricao: "Calabresa artesanal, cebola e azeitonas pretas",
    extra: 0,
    imagem: calabresa,
  },
  {
    id: "mussarela",
    nome: "Mussarela Tradicional",
    descricao: "Mussarela derretida, tomate fresco e orégano",
    extra: 0,
    imagem: queijos,
  },
  {
    id: "frango",
    nome: "Frango com Catupiry",
    descricao: "Frango desfiado e Catupiry legítimo",
    extra: 0,
    imagem: frango,
  },
  {
    id: "marguerita",
    nome: "Marguerita Napolitana",
    descricao: "Mussarela, tomate, parmesão e manjericão",
    extra: 0,
    imagem: marguerita,
  },
  {
    id: "quatro-queijos",
    nome: "Quatro Queijos Nobres",
    descricao: "Mussarela, provolone, gorgonzola e Catupiry",
    extra: 4,
    imagem: queijos,
  },
  {
    id: "pepperoni",
    nome: "Pepperoni com Parmesão",
    descricao: "Pepperoni italiano gratinado com parmesão",
    extra: 5,
    imagem: pepperoni,
  },
]

const bordas: ItemOpcao[] = [
  {
    id: "tradicional",
    nome: "Tradicional",
    descricao: "Sem recheio, bem crocante",
    extra: 0,
    cor: "#D9A45B",
  },
  {
    id: "catupiry",
    nome: "Catupiry",
    descricao: "Recheada com Catupiry legítimo",
    extra: 10,
    cor: "#F4E7C8",
    realce: true,
  },
  {
    id: "cheddar",
    nome: "Cheddar",
    descricao: "Recheada com cheddar cremoso",
    extra: 10,
    cor: "#F0A92B",
    realce: true,
  },
  {
    id: "chocolate",
    nome: "Chocolate",
    descricao: "Recheada com chocolate ao leite",
    extra: 12,
    cor: "#5B3420",
    realce: true,
  },
]

const grupoBorda: GrupoOpcao<"pizzaria"> = {
  id: "borda",
  tipo: "borda",
  nome: "Borda",
  titulo: "Escolha a borda",
  obrigatorio: true,
  itens: bordas,
}

export const cardapioCasaDaPizza: Categoria<"pizzaria">[] = [
  {
    id: "monte",
    nome: "Monte a sua",
    produtos: [
      {
        id: "meio-a-meio",
        tipo: "pizza",
        nome: "Pizza meio a meio",
        descricao: "8 fatias. Escolha dois sabores e a borda.",
        preco: 58,
        imagem: pepperoni,
        destaque: true,
        grupos: [
          {
            id: "sabor-1",
            tipo: "sabor",
            nome: "1º sabor",
            titulo: "Escolha o 1º sabor",
            obrigatorio: true,
            metade: "esquerda",
            itens: sabores,
          },
          {
            id: "sabor-2",
            tipo: "sabor",
            nome: "2º sabor",
            titulo: "Escolha o 2º sabor",
            obrigatorio: true,
            metade: "direita",
            itens: sabores,
          },
          grupoBorda,
        ],
      },
    ],
  },
  {
    id: "tradicionais",
    nome: "Tradicionais",
    produtos: [
      {
        id: "calabresa",
        tipo: "pizza",
        nome: "Calabresa Especial",
        descricao: "Calabresa fatiada, cebola em rodelas, azeitonas pretas e orégano.",
        preco: 46,
        precoOriginal: 52,
        imagem: calabresa,
        destaque: true,
        grupos: [grupoBorda],
      },
      {
        id: "mussarela",
        tipo: "pizza",
        nome: "Mussarela da Casa",
        descricao: "Molho artesanal, muita mussarela derretida e rodelas de tomate.",
        preco: 44,
        imagem: queijos,
        grupos: [grupoBorda],
      },
      {
        id: "frango",
        tipo: "pizza",
        nome: "Frango com Catupiry",
        descricao: "Frango desfiado temperado com ervas e coberto com Catupiry.",
        preco: 48,
        imagem: frango,
        destaque: true,
        grupos: [grupoBorda],
      },
      {
        id: "marguerita",
        tipo: "pizza",
        nome: "Marguerita Napolitana",
        descricao: "Mussarela, tomate fresco, parmesão ralado e manjericão.",
        preco: 46,
        imagem: marguerita,
        destaque: true,
        grupos: [grupoBorda],
      },
    ],
  },
  {
    id: "nobres",
    nome: "Nobres",
    produtos: [
      {
        id: "pepperoni",
        tipo: "pizza",
        nome: "Pepperoni com Parmesão",
        descricao: "Mussarela coberta com pepperoni italiano e gratinada com parmesão.",
        preco: 56,
        imagem: pepperoni,
        destaque: true,
        grupos: [grupoBorda],
      },
      {
        id: "quatro-queijos",
        tipo: "pizza",
        nome: "Quatro Queijos Nobres",
        descricao: "Mussarela, provolone curado, gorgonzola e Catupiry.",
        preco: 54,
        imagem: queijos,
        destaque: true,
        grupos: [grupoBorda],
      },
    ],
  },
  {
    id: "doces",
    nome: "Doces",
    produtos: [
      {
        id: "chocolate-confeitos",
        tipo: "pizza",
        nome: "Chocolate com Confeitos",
        descricao: "Creme de chocolate ao leite com confeitos crocantes.",
        preco: 46,
        imagem: doce,
        destaque: true,
        grupos: [grupoBorda],
      },
    ],
  },
  {
    id: "entradas",
    nome: "Entradas",
    produtos: [
      {
        id: "calzone",
        tipo: "calzone",
        nome: "Calzone de Queijo",
        descricao: "Massa assada no forno a lenha, recheada com mussarela e tomate.",
        preco: 34,
        imagem: calzone,
      },
    ],
  },
  {
    id: "bebidas",
    nome: "Bebidas",
    produtos: [
      {
        id: "refrigerante-cola",
        tipo: "bebida",
        nome: "Refrigerante de cola 2L",
        descricao: "Garrafa de 2 litros bem gelada.",
        preco: 15,
        imagem: refrigerante,
      },
      {
        id: "refrigerante-guarana",
        tipo: "bebida",
        nome: "Refrigerante de guaraná 2L",
        descricao: "Garrafa de 2 litros bem gelada.",
        preco: 13,
        imagem: refrigerante,
      },
    ],
  },
]
