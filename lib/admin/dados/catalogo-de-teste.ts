import type { CatalogoLoja } from "./tipos"

/** Lanchonete mínima: um lanche de R$ 20 com adicional obrigatório de R$ 3, entrega a R$ 5. */
export function catalogoDeTeste(): CatalogoLoja {
  return {
    loja: {
      nome: "Teste",
      slogan: "",
      telefone: "1230000000",
      whatsapp: "12999990000",
      endereco: "Rua A, 1",
      textoHorario: "",
      controleAutomatico: true,
      aberta: true,
      mensagemFechada: "",
      horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        dia,
        aberto: true,
        abre: "18:00",
        fecha: "23:00",
      })),
      aceitaEntrega: true,
      aceitaRetirada: true,
      taxaEntregaPadrao: 8,
      pedidoMinimo: 0,
      tempoEntrega: "40 min",
      tempoRetirada: "20 min",
      cidadesAtendidas: [],
      pagamentoOnlineConectado: true,
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
      aceiteManual: false,
      limiteAceiteMin: 5,
      vitrines: {
        destaques: { titulo: "Destaques", ativo: true },
        ofertas: { titulo: "Ofertas", ativo: true },
      },
    },
    categorias: [{ id: "cat-lanches", nome: "Lanches", ordem: 1, ativa: true }],
    produtos: [
      {
        id: "prod-x-burger",
        categoriaId: "cat-lanches",
        nome: "X-Burger",
        descricao: "",
        preco: 20,
        ativo: true,
        disponivel: true,
        destaque: false,
        oferta: false,
        ordem: 1,
        unidade: "un",
        grupos: [
          {
            id: "grp-x-burger-1",
            nome: "Adicional",
            minimo: 1,
            maximo: 1,
            gratisAte: 0,
            ordem: 1,
            ativo: true,
            itens: [
              { id: "opc-x-burger-1-1", nome: "Bacon", precoAdicional: 3, ordem: 1, ativo: true },
            ],
          },
        ],
      },
    ],
    mesas: [
      { id: "mesa-1", numero: 1, nome: "Mesa 01", status: "livre" },
      { id: "mesa-2", numero: 2, nome: "Mesa 02", status: "livre" },
    ],
    motoboys: [{ id: "moto-1", nome: "Carlos", telefone: "12991110000", ativo: true }],
    bairros: [
      { id: "bairro-centro", cidade: "Cachoeira Paulista", nome: "Centro", taxa: 5, ativo: true },
    ],
    clientes: [
      { nome: "Ana Souza", telefone: "12991230001" },
      { nome: "Bruno Lima", telefone: "12991230002" },
      { nome: "Carla Dias", telefone: "12991230003" },
    ],
  }
}
