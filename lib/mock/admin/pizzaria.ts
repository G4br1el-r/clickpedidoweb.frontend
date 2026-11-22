import type { CatalogoLoja, GrupoOpcao, Produto } from "@/lib/admin/dados/tipos"
import { cardapioCasaDaPizza, casaDaPizza } from "@/lib/mock/casa-da-pizza"
import { clientesDemo } from "./clientes"

/**
 * Casa da Pizza no painel: o mesmo cardápio da vitrine do protótipo, convertido
 * para o modelo do painel, para a loja e o painel mostrarem os mesmos produtos.
 */
const produtos: Produto[] = cardapioCasaDaPizza.flatMap((categoria) =>
  categoria.produtos.map((produto, indice) => ({
    id: `prod-${produto.id}`,
    categoriaId: `cat-${categoria.id}`,
    nome: produto.nome,
    descricao: produto.descricao,
    preco: produto.preco,
    ...(produto.precoOriginal ? { precoOriginal: produto.precoOriginal } : {}),
    imagem: produto.imagem.src,
    ativo: true,
    disponivel: true,
    destaque: produto.destaque ?? false,
    oferta: Boolean(produto.precoOriginal),
    ordem: indice + 1,
    unidade: "un" as const,
    grupos: (produto.grupos ?? []).map(
      (grupo, posicao): GrupoOpcao => ({
        id: `grp-${produto.id}-${posicao + 1}`,
        nome: grupo.nome,
        minimo: grupo.obrigatorio ? 1 : 0,
        maximo: 1,
        gratisAte: 0,
        ordem: posicao + 1,
        ativo: true,
        itens: grupo.itens.map((item, ordem) => ({
          id: `opc-${produto.id}-${posicao + 1}-${ordem + 1}`,
          nome: item.nome,
          precoAdicional: item.extra,
          ordem: ordem + 1,
          ativo: true,
        })),
      }),
    ),
  })),
)

const soDigitos = (texto: string) => texto.replace(/\D/g, "")

export const catalogoPizzaria: CatalogoLoja = {
  loja: {
    nome: casaDaPizza.nome,
    slogan: casaDaPizza.slogan,
    telefone: soDigitos(casaDaPizza.telefone),
    whatsapp: soDigitos(casaDaPizza.telefone),
    endereco: casaDaPizza.endereco,
    textoHorario: "Terça a domingo, das 18h às 23h30",
    controleAutomatico: true,
    aberta: true,
    mensagemFechada: "Estamos fechados agora. Abrimos de terça a domingo, às 18h.",
    // Segunda fechada; terça a domingo, das 18h às 23h30.
    horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
      dia,
      aberto: dia !== 1,
      abre: "18:00",
      fecha: "23:30",
    })),
    aceitaEntrega: true,
    aceitaRetirada: true,
    taxaEntregaPadrao: casaDaPizza.entrega.taxa,
    pedidoMinimo: casaDaPizza.pedidoMinimo,
    tempoEntrega: casaDaPizza.entrega.tempo,
    tempoRetirada: casaDaPizza.retirada.tempo,
    prazos: { entrega: { min: 35, max: 50 }, retirada: { min: 20, max: 30 } },
    pracas: [
      {
        id: "praca-forno",
        nome: "Forno",
        cor: "ambar",
        categoriaIds: [
          "cat-monte",
          "cat-combos",
          "cat-tradicionais",
          "cat-nobres",
          "cat-doces",
          "cat-calzones",
          "cat-esfihas",
        ],
        imprime: true,
        tocaSom: true,
      },
      {
        id: "praca-montagem",
        nome: "Montagem",
        cor: "verde",
        categoriaIds: ["cat-massas", "cat-entradas", "cat-porcoes", "cat-sobremesas"],
        imprime: true,
        tocaSom: true,
      },
      {
        id: "praca-bebidas",
        nome: "Bebidas",
        cor: "azul",
        categoriaIds: ["cat-bebidas"],
        imprime: false,
        tocaSom: true,
      },
    ],
    cidadesAtendidas: ["São José dos Campos"],
    pagamentoOnlineConectado: true,
    taxasPagamento: { pixOnline: 0.99, cartaoOnline: 4.98, maquininha: 1.99 },
    pagamentos: {
      pix: true,
      "cartao-online": true,
      dinheiro: true,
      "cartao-na-entrega": true,
      "pagar-apos-pesagem": false,
    },
    impressaoAutomatica: false,
    cortarPapel: true,
    som: "alto",
    vitrines: {
      destaques: { titulo: "Mais pedidas", ativo: true },
      ofertas: { titulo: "Ofertas", ativo: true },
    },
  },
  categorias: cardapioCasaDaPizza.map((categoria, indice) => ({
    id: `cat-${categoria.id}`,
    nome: categoria.nome,
    ordem: indice + 1,
    ativa: true,
  })),
  produtos,
  mesas: Array.from({ length: 8 }, (_, indice) => ({
    id: `mesa-${indice + 1}`,
    numero: indice + 1,
    nome: `Mesa ${String(indice + 1).padStart(2, "0")}`,
    status: "livre" as const,
  })),
  motoboys: [
    { id: "moto-1", nome: "Diego Ramos", telefone: "12991457788", ativo: true },
    { id: "moto-2", nome: "Thiago Neves", telefone: "12992318844", ativo: true },
    { id: "moto-3", nome: "Marcos Vinícius", telefone: "12997642211", ativo: true },
  ],
  bairros: casaDaPizza.entrega.bairros.map((bairro) => ({
    id: `bairro-${bairro.nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "-")}`,
    cidade: "São José dos Campos",
    nome: bairro.nome,
    taxa: bairro.taxa,
    ativo: true,
  })),
  clientes: clientesDemo,
}
