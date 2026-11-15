import type { StaticImageData } from "next/image"
import agua from "@/public/mock/agua.jpg"
import aguaGas from "@/public/mock/agua-gas.jpg"
import alho from "@/public/mock/alho.jpg"
import aneisCebola from "@/public/mock/aneis-cebola.jpg"
import antepasto from "@/public/mock/antepasto.jpg"
import asinhas from "@/public/mock/asinhas.jpg"
import atum from "@/public/mock/atum.jpg"
import banana from "@/public/mock/banana.jpg"
import bannerPizza from "@/public/mock/banner-pizza.jpg"
import barbecue from "@/public/mock/barbecue.jpg"
import batata from "@/public/mock/batata.jpg"
import batataRustica from "@/public/mock/batata-rustica.jpg"
import broto from "@/public/mock/broto.jpg"
import brownie from "@/public/mock/brownie.jpg"
import bruschetta from "@/public/mock/bruschetta.jpg"
import burrata from "@/public/mock/burrata.jpg"
import calabresa from "@/public/mock/calabresa.jpg"
import calzone from "@/public/mock/calzone.jpg"
import calzone2 from "@/public/mock/calzone-2.jpg"
import camarao from "@/public/mock/camarao.jpg"
import caprese from "@/public/mock/caprese.jpg"
import carpaccio from "@/public/mock/carpaccio.jpg"
import cerveja from "@/public/mock/cerveja.jpg"
import chaGelado from "@/public/mock/cha-gelado.jpg"
import cheesecake from "@/public/mock/cheesecake.jpg"
import chocolateBranco from "@/public/mock/chocolate-branco.jpg"
import churros from "@/public/mock/churros.jpg"
import coco from "@/public/mock/coco.jpg"
import combo from "@/public/mock/combo.jpg"
import doce from "@/public/mock/doce.jpg"
import esfiha from "@/public/mock/esfiha.jpg"
import esfihaEspinafre from "@/public/mock/esfiha-espinafre.jpg"
import espaguete from "@/public/mock/espaguete.jpg"
import festa from "@/public/mock/festa.jpg"
import fettuccine from "@/public/mock/fettuccine.jpg"
import focaccia from "@/public/mock/focaccia.jpg"
import forno from "@/public/mock/forno.jpg"
import frango from "@/public/mock/frango.jpg"
import funghi from "@/public/mock/funghi.jpg"
import lasanha from "@/public/mock/lasanha.jpg"
import lata from "@/public/mock/lata.jpg"
import limonada from "@/public/mock/limonada.jpg"
import logo from "@/public/mock/logo.webp"
import marguerita from "@/public/mock/marguerita.jpg"
import morango from "@/public/mock/morango.jpg"
import napolitana from "@/public/mock/napolitana.jpg"
import nhoque from "@/public/mock/nhoque.jpg"
import palitosQueijo from "@/public/mock/palitos-queijo.jpg"
import paoDeAlho from "@/public/mock/pao-de-alho.jpg"
import penne from "@/public/mock/penne.jpg"
import pepperoni from "@/public/mock/pepperoni.jpg"
import petitGateau from "@/public/mock/petit-gateau.jpg"
import portuguesa from "@/public/mock/portuguesa.jpg"
import pudim from "@/public/mock/pudim.jpg"
import queijos from "@/public/mock/queijos.jpg"
import ravioli from "@/public/mock/ravioli.jpg"
import refrigerante from "@/public/mock/refrigerante.jpg"
import rucula from "@/public/mock/rucula.jpg"
import sorvete from "@/public/mock/sorvete.jpg"
import sucoLaranja from "@/public/mock/suco-laranja.jpg"
import tiramisu from "@/public/mock/tiramisu.jpg"
import toscana from "@/public/mock/toscana.jpg"
import vegetariana from "@/public/mock/vegetariana.jpg"
import vinho from "@/public/mock/vinho.jpg"
import type { Categoria, GrupoOpcao, ItemOpcao, Loja, Produto } from "../tipos"

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
  {
    id: "portuguesa",
    nome: "Portuguesa",
    descricao: "Presunto, ovos, cebola, ervilha e azeitonas",
    extra: 0,
    imagem: portuguesa,
  },
  {
    id: "napolitana",
    nome: "Napolitana",
    descricao: "Tomate, parmesão e alho dourado",
    extra: 0,
    imagem: napolitana,
  },
  {
    id: "toscana",
    nome: "Toscana",
    descricao: "Linguiça toscana moída e cebola",
    extra: 0,
    imagem: toscana,
  },
  {
    id: "funghi",
    nome: "Funghi",
    descricao: "Mix de cogumelos e mussarela de búfala",
    extra: 6,
    imagem: funghi,
  },
]

const saboresNobres: ItemOpcao[] = [
  ...sabores.filter(({ id }) => ["quatro-queijos", "pepperoni", "funghi"].includes(id)),
  {
    id: "parma-rucula",
    nome: "Parma com rúcula",
    descricao: "Presunto parma, rúcula e tomate seco",
    extra: 8,
    imagem: rucula,
  },
  {
    id: "camarao",
    nome: "Camarão",
    descricao: "Camarões no alho com Catupiry",
    extra: 12,
    imagem: camarao,
  },
  {
    id: "burrata",
    nome: "Burrata",
    descricao: "Burrata inteira e manjericão",
    extra: 10,
    imagem: burrata,
  },
]

const saboresDoces: ItemOpcao[] = [
  {
    id: "chocolate",
    nome: "Chocolate com confeitos",
    descricao: "Chocolate ao leite e confeitos",
    extra: 0,
    imagem: doce,
  },
  {
    id: "brigadeiro",
    nome: "Brigadeiro",
    descricao: "Brigadeiro de panela e granulado",
    extra: 0,
    imagem: doce,
  },
  {
    id: "prestigio",
    nome: "Prestígio",
    descricao: "Chocolate e coco ralado",
    extra: 0,
    imagem: coco,
  },
  {
    id: "banana",
    nome: "Banana com canela",
    descricao: "Banana caramelizada e canela",
    extra: 0,
    imagem: banana,
  },
  {
    id: "morango",
    nome: "Morango com chocolate",
    descricao: "Chocolate e morangos frescos",
    extra: 4,
    imagem: morango,
  },
  {
    id: "chocolate-branco",
    nome: "Chocolate branco",
    descricao: "Chocolate branco e frutas vermelhas",
    extra: 4,
    imagem: chocolateBranco,
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

type ProdutoPizzaria = Produto<"pizzaria">
type Tipo = ProdutoPizzaria["tipo"]

/** Atalhos para montar o cardápio sem repetir os mesmos campos em cada item. */
function item(
  tipo: Tipo,
  id: string,
  nome: string,
  descricao: string,
  preco: number,
  imagem: StaticImageData,
  extra: Partial<ProdutoPizzaria> = {},
): ProdutoPizzaria {
  return { id, tipo, nome, descricao, preco, imagem, ...extra }
}

/** Pizza inteira de um sabor: só escolhe a borda. */
const pizza = (
  id: string,
  nome: string,
  descricao: string,
  preco: number,
  imagem: StaticImageData,
  extra: Partial<ProdutoPizzaria> = {},
) =>
  item("pizza", id, nome, descricao, preco, imagem, {
    grupos: [grupoBorda],
    medida: "Grande · 8 fatias",
    ...extra,
  })

function metade(numero: 1 | 2, itens: ItemOpcao[]): GrupoOpcao<"pizzaria"> {
  return {
    id: `sabor-${numero}`,
    tipo: "sabor",
    nome: `${numero}º sabor`,
    titulo: `Escolha o ${numero}º sabor`,
    obrigatorio: true,
    metade: numero === 1 ? "esquerda" : "direita",
    itens,
  }
}

/** Dois sabores e a borda: a prévia monta cada metade. */
const meioAMeio = (esquerda: ItemOpcao[], direita: ItemOpcao[] = esquerda) => [
  metade(1, esquerda),
  metade(2, direita),
  grupoBorda,
]

export const cardapioCasaDaPizza: Categoria<"pizzaria">[] = [
  {
    id: "monte",
    nome: "Monte a sua",
    produtos: [
      item(
        "pizza",
        "meio-a-meio",
        "Pizza meio a meio",
        "8 fatias. Escolha dois sabores e a borda.",
        58,
        pepperoni,
        { destaque: true, grupos: meioAMeio(sabores) },
      ),
      item(
        "pizza",
        "broto-meio-a-meio",
        "Broto meio a meio",
        "4 fatias. Dois sabores na pizza pequena, para uma pessoa.",
        36,
        broto,
        { grupos: meioAMeio(sabores) },
      ),
      item(
        "pizza",
        "media-meio-a-meio",
        "Média meio a meio",
        "6 fatias. Dois sabores, na medida para duas pessoas.",
        48,
        portuguesa,
        { grupos: meioAMeio(sabores) },
      ),
      item(
        "pizza",
        "gigante-meio-a-meio",
        "Gigante meio a meio",
        "12 fatias. Dois sabores para a família toda.",
        76,
        festa,
        { grupos: meioAMeio(sabores) },
      ),
      item(
        "pizza",
        "nobre-meio-a-meio",
        "Nobre meio a meio",
        "8 fatias. Dois sabores da seleção nobre da casa.",
        68,
        funghi,
        { grupos: meioAMeio(saboresNobres) },
      ),
      item(
        "pizza",
        "doce-meio-a-meio",
        "Doce meio a meio",
        "8 fatias. Dois sabores doces para fechar a noite.",
        52,
        morango,
        { grupos: meioAMeio(saboresDoces) },
      ),
      item(
        "pizza",
        "salgada-e-doce",
        "Meio salgada, meio doce",
        "8 fatias. Metade salgada, metade doce: jantar e sobremesa.",
        56,
        chocolateBranco,
        { grupos: meioAMeio(sabores, saboresDoces) },
      ),
      item(
        "pizza",
        "broto-doce",
        "Broto doce meio a meio",
        "4 fatias. Dois sabores doces na pizza pequena.",
        34,
        banana,
        { grupos: meioAMeio(saboresDoces) },
      ),
      item(
        "pizza",
        "gigante-salgada-e-doce",
        "Gigante salgada e doce",
        "12 fatias. Metade salgada e metade doce para dividir.",
        82,
        coco,
        { grupos: meioAMeio(sabores, saboresDoces) },
      ),
      item(
        "pizza",
        "integral-meio-a-meio",
        "Integral meio a meio",
        "8 fatias. Massa integral com fermentação natural e dois sabores.",
        62,
        vegetariana,
        { grupos: meioAMeio(sabores) },
      ),
    ],
  },
  {
    id: "combos",
    nome: "Combos",
    produtos: [
      item(
        "combo",
        "combo-casal",
        "Combo casal",
        "Pizza meio a meio grande e refrigerante de 2 litros.",
        69,
        combo,
        { grupos: meioAMeio(sabores) },
      ),
      item(
        "combo",
        "combo-familia",
        "Combo família",
        "Pizza gigante meio a meio e refrigerante de 2 litros.",
        89,
        festa,
        { grupos: meioAMeio(sabores) },
      ),
      item(
        "combo",
        "combo-duas-grandes",
        "Duas grandes",
        "Uma de calabresa e uma de mussarela, as mais pedidas da casa.",
        92,
        calabresa,
        { precoOriginal: 98 },
      ),
      item(
        "combo",
        "combo-pizza-e-calzone",
        "Pizza e calzone",
        "Pizza grande de frango com Catupiry e calzone de queijo.",
        79,
        calzone2,
      ),
      item(
        "combo",
        "combo-festa",
        "Combo festa",
        "Três pizzas grandes tradicionais e dois refrigerantes de 2 litros.",
        169,
        festa,
        { precoOriginal: 184 },
      ),
      item(
        "combo",
        "combo-filme",
        "Noite de filme",
        "Broto de pepperoni, batata frita e refrigerante em lata.",
        52,
        broto,
      ),
      item(
        "combo",
        "combo-doce-final",
        "Salgada e sobremesa",
        "Pizza grande tradicional e broto doce de brigadeiro.",
        84,
        chocolateBranco,
      ),
      item(
        "combo",
        "combo-massa-vinho",
        "Massa e vinho",
        "Lasanha à bolonhesa para dois e uma taça de vinho tinto.",
        74,
        lasanha,
      ),
      item(
        "combo",
        "combo-esfihas",
        "Dúzia de esfihas",
        "Doze esfihas abertas sortidas e refrigerante de 2 litros.",
        59,
        esfiha,
      ),
      item(
        "combo",
        "combo-kids",
        "Combo kids",
        "Broto de mussarela, suco de laranja e uma bola de sorvete.",
        45,
        sorvete,
      ),
    ],
  },
  {
    id: "tradicionais",
    nome: "Tradicionais",
    produtos: [
      pizza(
        "calabresa",
        "Calabresa Especial",
        "Calabresa fatiada, cebola em rodelas, azeitonas pretas e orégano.",
        46,
        calabresa,
        { precoOriginal: 52, destaque: true },
      ),
      pizza(
        "mussarela",
        "Mussarela da Casa",
        "Molho artesanal, muita mussarela derretida e rodelas de tomate.",
        44,
        queijos,
      ),
      pizza(
        "frango",
        "Frango com Catupiry",
        "Frango desfiado temperado com ervas e coberto com Catupiry.",
        48,
        frango,
        { destaque: true },
      ),
      pizza(
        "marguerita",
        "Marguerita Napolitana",
        "Mussarela, tomate fresco, parmesão ralado e manjericão.",
        46,
        marguerita,
        { destaque: true },
      ),
      pizza(
        "portuguesa",
        "Portuguesa",
        "Presunto, ovos, cebola, ervilha, azeitonas e mussarela.",
        48,
        portuguesa,
      ),
      pizza(
        "napolitana",
        "Napolitana",
        "Mussarela, rodelas de tomate, parmesão e alho dourado.",
        45,
        napolitana,
      ),
      pizza("atum", "Atum", "Atum sólido, cebola roxa, azeitonas e mussarela.", 49, atum),
      pizza(
        "toscana",
        "Toscana",
        "Linguiça toscana moída, cebola e mussarela gratinada.",
        47,
        toscana,
      ),
      pizza(
        "alho-e-oleo",
        "Alho e óleo",
        "Mussarela, alho laminado dourado no azeite e salsinha.",
        43,
        alho,
      ),
      pizza(
        "vegetariana",
        "Vegetariana",
        "Pimentões, cebola, champignon, milho, azeitonas e mussarela.",
        46,
        vegetariana,
      ),
    ],
  },
  {
    id: "nobres",
    nome: "Nobres",
    produtos: [
      pizza(
        "pepperoni",
        "Pepperoni com Parmesão",
        "Mussarela coberta com pepperoni italiano e gratinada com parmesão.",
        56,
        pepperoni,
        { destaque: true },
      ),
      pizza(
        "quatro-queijos",
        "Quatro Queijos Nobres",
        "Mussarela, provolone curado, gorgonzola e Catupiry.",
        54,
        queijos,
        { destaque: true },
      ),
      pizza(
        "parma-rucula",
        "Parma com rúcula",
        "Presunto parma, rúcula fresca, tomate seco e lascas de parmesão.",
        64,
        rucula,
      ),
      pizza("camarao", "Camarão", "Camarões salteados no alho, Catupiry e cebolinha.", 72, camarao),
      pizza(
        "funghi-trufado",
        "Funghi trufado",
        "Mix de cogumelos, mussarela de búfala e azeite trufado.",
        66,
        funghi,
      ),
      pizza(
        "burrata",
        "Burrata",
        "Molho de tomate San Marzano, burrata inteira e manjericão.",
        68,
        burrata,
      ),
      pizza(
        "frango-barbecue",
        "Frango barbecue",
        "Frango desfiado, molho barbecue defumado, cebola roxa e cheddar.",
        58,
        barbecue,
      ),
      pizza(
        "brie-damasco",
        "Brie com damasco",
        "Queijo brie, damasco, nozes e um fio de mel.",
        64,
        queijos,
      ),
      pizza(
        "lombo-catupiry",
        "Lombo com Catupiry",
        "Lombo canadense fatiado, Catupiry e cebola caramelizada.",
        59,
        portuguesa,
      ),
      pizza(
        "rucula-tomate-seco",
        "Rúcula e tomate seco",
        "Mussarela de búfala, rúcula, tomate seco e pesto de manjericão.",
        57,
        rucula,
      ),
    ],
  },
  {
    id: "doces",
    nome: "Doces",
    produtos: [
      pizza(
        "chocolate-confeitos",
        "Chocolate com Confeitos",
        "Creme de chocolate ao leite com confeitos crocantes.",
        46,
        doce,
        { destaque: true },
      ),
      pizza(
        "brigadeiro",
        "Brigadeiro",
        "Brigadeiro cremoso de panela coberto com granulado belga.",
        46,
        doce,
      ),
      pizza("prestigio", "Prestígio", "Chocolate ao leite com coco ralado fresco.", 47, coco),
      pizza(
        "banana-canela",
        "Banana com canela",
        "Banana caramelizada, açúcar, canela e leite condensado.",
        42,
        banana,
      ),
      pizza(
        "morango-chocolate",
        "Morango com chocolate",
        "Chocolate ao leite e morangos frescos fatiados.",
        52,
        morango,
      ),
      pizza(
        "chocolate-branco",
        "Chocolate branco",
        "Creme de chocolate branco com raspas e frutas vermelhas.",
        50,
        chocolateBranco,
      ),
      pizza(
        "romeu-julieta",
        "Romeu e Julieta",
        "Mussarela derretida com goiabada cascão.",
        44,
        queijos,
      ),
      pizza(
        "doce-de-leite",
        "Doce de leite",
        "Doce de leite mineiro com banana e canela.",
        45,
        banana,
      ),
      pizza(
        "avela-morango",
        "Avelã com morango",
        "Creme de avelã com cacau e morangos frescos.",
        56,
        morango,
      ),
      pizza(
        "churros-pizza",
        "Churros",
        "Doce de leite, açúcar e canela, como um churros quentinho.",
        48,
        churros,
      ),
    ],
  },
  {
    id: "calzones",
    nome: "Calzones",
    produtos: [
      item(
        "calzone",
        "calzone",
        "Calzone de Queijo",
        "Massa assada no forno a lenha, recheada com mussarela e tomate.",
        34,
        calzone,
      ),
      item(
        "calzone",
        "calzone-calabresa",
        "Calzone de calabresa",
        "Calabresa, cebola e mussarela, fechado e dourado no forno.",
        36,
        calzone2,
      ),
      item(
        "calzone",
        "calzone-frango",
        "Calzone de frango",
        "Frango desfiado com Catupiry e milho.",
        37,
        calzone,
      ),
      item(
        "calzone",
        "calzone-portuguesa",
        "Calzone português",
        "Presunto, ovos, cebola, azeitonas e mussarela.",
        38,
        calzone2,
      ),
      item(
        "calzone",
        "calzone-quatro-queijos",
        "Calzone quatro queijos",
        "Mussarela, provolone, gorgonzola e Catupiry.",
        40,
        calzone,
      ),
      item(
        "calzone",
        "calzone-pepperoni",
        "Calzone de pepperoni",
        "Pepperoni italiano, mussarela e orégano.",
        40,
        calzone2,
      ),
      item(
        "calzone",
        "calzone-vegetariano",
        "Calzone vegetariano",
        "Abobrinha, berinjela, pimentões e mussarela de búfala.",
        37,
        calzone,
      ),
      item(
        "calzone",
        "calzone-carne-seca",
        "Calzone de carne seca",
        "Carne seca desfiada, Catupiry e cebola roxa.",
        42,
        calzone2,
      ),
      item(
        "calzone",
        "calzone-palmito",
        "Calzone de palmito",
        "Palmito pupunha, tomate, azeitonas e mussarela.",
        38,
        calzone,
      ),
      item(
        "calzone",
        "calzone-chocolate",
        "Calzone de chocolate",
        "Chocolate ao leite e morangos, fechado e polvilhado com açúcar.",
        36,
        calzone2,
      ),
    ],
  },
  {
    id: "esfihas",
    nome: "Esfihas",
    produtos: [
      item(
        "esfiha",
        "esfiha-carne",
        "Esfiha de carne",
        "Aberta, com carne moída temperada, tomate e cebola.",
        8,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-queijo",
        "Esfiha de queijo",
        "Aberta, com mussarela gratinada e orégano.",
        8,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-calabresa",
        "Esfiha de calabresa",
        "Aberta, com calabresa moída e cebola.",
        8.5,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-frango",
        "Esfiha de frango com Catupiry",
        "Aberta, com frango desfiado e Catupiry.",
        9,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-espinafre",
        "Esfiha de espinafre",
        "Fechada, com espinafre refogado e ricota.",
        8.5,
        esfihaEspinafre,
      ),
      item(
        "esfiha",
        "esfiha-escarola",
        "Esfiha de escarola",
        "Fechada, com escarola, alho e azeitonas.",
        8.5,
        esfihaEspinafre,
      ),
      item(
        "esfiha",
        "esfiha-zaatar",
        "Esfiha de zaatar",
        "Aberta, com zaatar, azeite e coalhada seca.",
        9,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-carne-seca",
        "Esfiha de carne seca",
        "Aberta, com carne seca desfiada e Catupiry.",
        10,
        esfiha,
      ),
      item(
        "esfiha",
        "esfiha-ricota",
        "Esfiha de ricota com tomate",
        "Fechada, com ricota temperada e tomate.",
        8.5,
        esfihaEspinafre,
      ),
      item(
        "esfiha",
        "esfiha-chocolate",
        "Esfiha de chocolate",
        "Aberta, com chocolate ao leite e granulado.",
        9,
        esfiha,
      ),
    ],
  },
  {
    id: "massas",
    nome: "Massas",
    produtos: [
      item(
        "massa",
        "espaguete-bolonhesa",
        "Espaguete à bolonhesa",
        "Molho de tomate com carne moída cozido lentamente.",
        42,
        espaguete,
      ),
      item(
        "massa",
        "espaguete-alho-oleo",
        "Espaguete alho e óleo",
        "Alho dourado no azeite, pimenta calabresa e salsinha.",
        36,
        espaguete,
      ),
      item(
        "massa",
        "lasanha-bolonhesa",
        "Lasanha à bolonhesa",
        "Camadas de massa fresca, bolonhesa, presunto e queijo gratinado.",
        48,
        lasanha,
      ),
      item(
        "massa",
        "lasanha-quatro-queijos",
        "Lasanha quatro queijos",
        "Molho branco com mussarela, provolone, gorgonzola e parmesão.",
        50,
        lasanha,
      ),
      item(
        "massa",
        "penne-arrabbiata",
        "Penne arrabbiata",
        "Molho de tomate apimentado com alho e manjericão.",
        39,
        penne,
      ),
      item(
        "massa",
        "penne-frango",
        "Penne com frango e creme",
        "Frango em cubos, creme de leite e champignon.",
        44,
        penne,
      ),
      item(
        "massa",
        "nhoque-sugo",
        "Nhoque ao sugo",
        "Nhoque de batata com molho de tomate e parmesão.",
        40,
        nhoque,
      ),
      item(
        "massa",
        "nhoque-quatro-queijos",
        "Nhoque quatro queijos",
        "Nhoque de batata com molho cremoso de quatro queijos.",
        46,
        nhoque,
      ),
      item(
        "massa",
        "fettuccine-alfredo",
        "Fettuccine Alfredo",
        "Massa fresca com molho de manteiga, creme e parmesão.",
        45,
        fettuccine,
      ),
      item(
        "massa",
        "ravioli-ricota",
        "Ravióli de ricota",
        "Recheado com ricota e espinafre, ao molho de tomate fresco.",
        47,
        ravioli,
      ),
    ],
  },
  {
    id: "entradas",
    nome: "Entradas",
    produtos: [
      item(
        "entrada",
        "pao-de-alho",
        "Pão de alho",
        "Pão italiano com manteiga de alho, assado no forno a lenha.",
        18,
        paoDeAlho,
      ),
      item(
        "entrada",
        "pao-de-alho-queijo",
        "Pão de alho com queijo",
        "Pão de alho gratinado com mussarela.",
        22,
        paoDeAlho,
      ),
      item(
        "entrada",
        "bruschetta-tomate",
        "Bruschetta de tomate",
        "Pão tostado, tomate, manjericão e azeite extravirgem.",
        24,
        bruschetta,
      ),
      item(
        "entrada",
        "bruschetta-cogumelos",
        "Bruschetta de cogumelos",
        "Pão tostado com cogumelos salteados e parmesão.",
        26,
        bruschetta,
      ),
      item(
        "entrada",
        "caprese",
        "Salada caprese",
        "Tomate, mussarela de búfala, manjericão e redução de balsâmico.",
        32,
        caprese,
      ),
      item(
        "entrada",
        "carpaccio",
        "Carpaccio",
        "Lâminas de carne crua, alcaparras, rúcula e parmesão.",
        38,
        carpaccio,
      ),
      item(
        "entrada",
        "focaccia",
        "Focaccia de alecrim",
        "Massa aerada com alecrim, sal grosso e azeite.",
        20,
        focaccia,
      ),
      item(
        "entrada",
        "antepasto",
        "Antepasto da casa",
        "Berinjela, pimentões, azeitonas e queijos com torradas.",
        36,
        antepasto,
      ),
      item(
        "entrada",
        "tabua-frios",
        "Tábua de frios",
        "Salame, presunto parma, provolone e azeitonas.",
        54,
        antepasto,
      ),
      item(
        "entrada",
        "salada-folhas",
        "Salada de folhas",
        "Folhas verdes, tomate cereja, palmito e molho de mostarda e mel.",
        28,
        caprese,
      ),
    ],
  },
  {
    id: "porcoes",
    nome: "Porções",
    produtos: [
      item(
        "porcao",
        "batata-frita",
        "Batata frita",
        "Porção de batata frita crocante com sal.",
        26,
        batata,
      ),
      item(
        "porcao",
        "batata-cheddar-bacon",
        "Batata com cheddar e bacon",
        "Batata frita coberta com cheddar cremoso e bacon crocante.",
        36,
        batata,
      ),
      item(
        "porcao",
        "batata-rustica",
        "Batata rústica",
        "Gomos de batata com casca, alecrim e alho.",
        29,
        batataRustica,
      ),
      item(
        "porcao",
        "aneis-cebola",
        "Anéis de cebola",
        "Empanados e fritos, com molho barbecue.",
        28,
        aneisCebola,
      ),
      item(
        "porcao",
        "asinhas",
        "Asinhas de frango",
        "Asinhas temperadas e assadas, com molho da casa.",
        38,
        asinhas,
      ),
      item(
        "porcao",
        "asinhas-barbecue",
        "Asinhas barbecue",
        "Asinhas glaceadas no molho barbecue defumado.",
        40,
        asinhas,
      ),
      item(
        "porcao",
        "palitos-queijo",
        "Palitos de queijo",
        "Palitos empanados com molho de tomate para mergulhar.",
        32,
        palitosQueijo,
      ),
      item(
        "porcao",
        "frango-passarinho",
        "Frango a passarinho",
        "Frango frito com alho dourado e limão.",
        42,
        asinhas,
      ),
      item(
        "porcao",
        "calabresa-acebolada",
        "Calabresa acebolada",
        "Calabresa fatiada e cebola na chapa, com pão.",
        34,
        calabresa,
      ),
      item(
        "porcao",
        "mix-porcoes",
        "Mix da casa",
        "Batata rústica, anéis de cebola e palitos de queijo.",
        56,
        batataRustica,
      ),
    ],
  },
  {
    id: "sobremesas",
    nome: "Sobremesas",
    produtos: [
      item(
        "sobremesa",
        "petit-gateau",
        "Petit gâteau",
        "Bolinho de chocolate com recheio cremoso e sorvete de creme.",
        26,
        petitGateau,
      ),
      item(
        "sobremesa",
        "tiramisu",
        "Tiramisù",
        "Biscoito no café, creme de mascarpone e cacau.",
        24,
        tiramisu,
      ),
      item(
        "sobremesa",
        "pudim",
        "Pudim de leite",
        "Pudim cremoso com calda de caramelo.",
        16,
        pudim,
      ),
      item(
        "sobremesa",
        "brownie-sorvete",
        "Brownie com sorvete",
        "Brownie quente, sorvete de creme e calda de chocolate.",
        24,
        brownie,
      ),
      item(
        "sobremesa",
        "cheesecake",
        "Cheesecake de frutas vermelhas",
        "Base crocante, creme de queijo e calda de frutas vermelhas.",
        22,
        cheesecake,
      ),
      item(
        "sobremesa",
        "sorvete",
        "Sorvete três bolas",
        "Creme, chocolate e morango, com farofa de castanhas.",
        18,
        sorvete,
      ),
      item(
        "sobremesa",
        "churros",
        "Churros com doce de leite",
        "Seis mini churros com açúcar, canela e doce de leite.",
        20,
        churros,
      ),
      item(
        "sobremesa",
        "mousse-chocolate",
        "Mousse de chocolate",
        "Mousse aerado de chocolate meio amargo.",
        16,
        brownie,
      ),
      item(
        "sobremesa",
        "torta-limao",
        "Torta de limão",
        "Massa amanteigada, creme de limão e merengue tostado.",
        18,
        cheesecake,
      ),
      item(
        "sobremesa",
        "banana-split",
        "Banana split",
        "Banana, três bolas de sorvete, chantili e caldas.",
        26,
        sorvete,
      ),
    ],
  },
  {
    id: "bebidas",
    nome: "Bebidas",
    produtos: [
      item(
        "bebida",
        "refrigerante-cola",
        "Refrigerante de cola 2L",
        "Garrafa de 2 litros bem gelada.",
        15,
        refrigerante,
      ),
      item(
        "bebida",
        "refrigerante-lata",
        "Refrigerante em lata",
        "Lata de 350 ml, cola, guaraná ou laranja.",
        7,
        lata,
      ),
      item("bebida", "agua", "Água sem gás", "Garrafa de 500 ml.", 5, agua),
      item("bebida", "agua-gas", "Água com gás", "Garrafa de 500 ml.", 6, aguaGas),
      item(
        "bebida",
        "suco-laranja",
        "Suco de laranja",
        "Natural, feito na hora, 500 ml.",
        12,
        sucoLaranja,
      ),
      item(
        "bebida",
        "limonada",
        "Limonada suíça",
        "Limão batido com casca, açúcar e gelo, 500 ml.",
        12,
        limonada,
      ),
      item(
        "bebida",
        "cha-gelado",
        "Chá gelado de limão",
        "Chá preto gelado com limão, 500 ml.",
        9,
        chaGelado,
      ),
      item("bebida", "cerveja", "Cerveja long neck", "Pilsen bem gelada, 355 ml.", 10, cerveja),
      item("bebida", "vinho", "Taça de vinho tinto", "Tinto seco da casa, 150 ml.", 18, vinho),
      item(
        "bebida",
        "refrigerante-guarana",
        "Refrigerante de guaraná 2L",
        "Garrafa de 2 litros bem gelada.",
        13,
        refrigerante,
      ),
    ],
  },
]
