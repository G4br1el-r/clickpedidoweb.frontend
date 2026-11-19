/**
 * Modelo de dados do painel. Espelha as entidades das lojas de hoje
 * (`ClickPedido.Web/Models/Entidades.cs`), com o que cada segmento precisa.
 * Datas são texto ISO; dinheiro é número em reais.
 */

export type TipoPedido = "entrega" | "retirada" | "mesa" | "atendimento"

export type StatusPedido =
  | "aguardando-pagamento"
  | "recebido"
  | "em-preparo"
  | "pronto"
  | "saiu-para-entrega"
  | "concluido"
  | "cancelado"

export type FormaPagamento =
  | "pix"
  | "cartao-online"
  | "dinheiro"
  | "cartao-na-entrega"
  | "pagar-apos-pesagem"

/** "estorno-pendente": estava pago e o pedido foi cancelado; a loja deve devolver. */
export type SituacaoPagamento =
  | "pendente"
  | "pago"
  | "na-entrega"
  | "cancelado"
  | "estorno-pendente"

/** Por onde o pedido entrou. "painel": agendamento marcado pela própria loja. */
export type OrigemPedido = "site" | "pdv" | "garcom" | "painel"

export type ItemPedido = {
  id: string
  /** `null` para item avulso, lançado sem produto do cardápio. */
  produtoId: string | null
  nome: string
  quantidade: number
  precoUnitario: number
  /** Resumo das opções escolhidas, já em texto. Exemplo: "1º sabor: Calabresa". */
  opcoes: string[]
  /** Combos: produtos ligados às opções escolhidas (cada um sai 1 por unidade do item). */
  produtosDasOpcoes?: string[]
  observacao?: string
  total: number
  /** Venda por quilo: peso pedido pelo cliente, de cada unidade. */
  pesoGramas?: number
  /** Venda por quilo: preço do quilo quando o pedido foi feito. */
  precoKg?: number
  /** Venda por quilo: peso da balança, da linha toda (todas as unidades). */
  pesoReal?: number
  /** Venda por quilo: total estimado antes da primeira pesagem. */
  totalEstimado?: number
  /** Comanda: em que lançamento o item entrou (o pedido do site é a rodada 1). */
  rodada?: number
  /** Comanda: se o item foi para a cozinha. Sem o campo, segue `Pedido.enviarParaCozinha`. */
  vaiParaCozinha?: boolean
  /** Comanda: quando o garçom lançou o item. */
  lancadoEm?: string
}

export type EnderecoEntrega = {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  referencia?: string
}

/** Por que a loja recusou ou cancelou o pedido. "outro" vem com texto. */
export type MotivoCancelamento =
  | "sem-estoque"
  | "fora-da-area"
  | "loja-cheia"
  | "cliente-pediu"
  | "cliente-nao-veio"
  | "endereco-invalido"
  | "receita-invalida"
  | "fraude"
  | "outro"

/** Uma linha da linha do tempo do pedido. A chegada não entra: é o `criadoEm`. */
export type EventoPedido =
  | { tipo: "etapa"; status: StatusPedido; em: string }
  | { tipo: "pago" | "impresso" | "aceito"; em: string }

export type Pedido = {
  id: number
  /** Número mostrado para a loja e o cliente. Na lanchonete, recomeça todo mês. */
  numero: number
  token: string
  origem: OrigemPedido
  tipo: TipoPedido
  status: StatusPedido
  cliente: { nome: string; telefone: string }
  endereco?: EnderecoEntrega
  mesa?: { id: string; numero: number; garcom?: string }
  itens: ItemPedido[]
  subtotal: number
  desconto: number
  taxaEntrega: number
  total: number
  pagamento: FormaPagamento
  situacaoPagamento: SituacaoPagamento
  /** Dinheiro: quanto o cliente vai entregar. */
  trocoPara?: number
  pagoEm?: string
  motoboyId?: string
  observacao?: string
  criadoEm: string
  atualizadoEm: string
  impressoEm?: string
  /** Mesa: se a rodada vai para a cozinha. */
  enviarParaCozinha: boolean
  /** Salão: data e hora marcadas e quanto dura. */
  agendamento?: { inicio: string; duracaoMin: number }
  /** Açougue: dia em que o cliente vai buscar. */
  dataRetirada?: string
  /** Açougue: resultado da pesagem. */
  pesagem?: { totalEstimado: number; diferenca: number; pesadoEm: string }
  /** O estoque já saiu por este pedido (para devolver no cancelamento uma vez só). */
  estoqueBaixado?: boolean
  /** O que aconteceu depois da chegada, do mais antigo para o mais novo. */
  historico?: EventoPedido[]
  /** Chegou pelo site com o aceite manual ligado: espera a loja aceitar ou recusar. */
  esperaAceite?: boolean
  /** Recusado no aceite ou cancelado depois: por quê e quando. */
  cancelamento?: Cancelamento
}

export type Cancelamento = {
  tipo: "recusa" | "cancelamento"
  motivo: MotivoCancelamento
  /** Texto do "Outro motivo". */
  detalhe?: string
  em: string
}

/** O que a pessoa escolhe ao recusar ou cancelar. */
export type MotivoEscolhido = { motivo: MotivoCancelamento; detalhe?: string }

export type Categoria = {
  id: string
  nome: string
  ordem: number
  /** Visível no cardápio. */
  ativa: boolean
}

export type ItemOpcao = {
  id: string
  nome: string
  precoAdicional: number
  ordem: number
  ativo: boolean
  /** Combos: a opção é este produto do cardápio; esgotar ou renomear o produto a acompanha. */
  produtoId?: string
}

export type GrupoOpcao = {
  id: string
  nome: string
  /** 0 = opcional. */
  minimo: number
  maximo: number
  /** Quantos itens saem sem cobrar o adicional. */
  gratisAte: number
  ordem: number
  ativo: boolean
  itens: ItemOpcao[]
}

export type UnidadeVenda = "un" | "kg"

export type Produto = {
  id: string
  categoriaId: string
  nome: string
  descricao: string
  /** Preço do cardápio; na venda por quilo, o preço do quilo. */
  preco: number
  /** Preço "de", quando está em oferta. */
  precoOriginal?: number
  /** Preço no balcão (PDV e mesa). */
  precoBalcao?: number
  /** Caminho da foto em `/public`. Sem foto, a tela mostra a inicial. */
  imagem?: string
  /** Visível no cardápio. */
  ativo: boolean
  /** Falso = esgotado: aparece, mas não pode ser pedido. */
  disponivel: boolean
  destaque: boolean
  oferta: boolean
  ordem: number
  unidade: UnidadeVenda
  videoUrl?: string
  /** Salão: duração do serviço. */
  duracaoMin?: number
  grupos: GrupoOpcao[]
  /** Farmácia: dados do medicamento. Sem o campo, é um item de venda livre (higiene, beleza). */
  medicamento?: DadosMedicamento
  /** Controle de estoque do produto; sem o campo, não é controlado. */
  estoque?: ControleEstoque
}

/** Estoque de um produto, na unidade dele (peças ou kg). */
export type ControleEstoque = {
  controlar: boolean
  quantidade: number
  minimo: number
  /** Custo de uma unidade (ou de 1 kg), para o valor parado em estoque. */
  custo?: number
  /** Zerou, esgota no cardápio; a entrada seguinte devolve. */
  esgotarAoZerar: boolean
  /** O estoque (e não a pessoa) esgotou o produto: só esse volta sozinho. */
  esgotadoPeloEstoque?: boolean
}

export type TipoMovimento = "entrada" | "saida" | "contagem" | "venda" | "devolucao" | "pesagem"

/** Uma linha do histórico do estoque geral. `quantidade` tem sinal: entra positivo, sai negativo. */
export type MovimentoEstoque = {
  id: string
  produtoId: string
  tipo: TipoMovimento
  quantidade: number
  /** Saldo depois do movimento. */
  saldo: number
  motivo?: string
  observacao?: string
  custoUnitario?: number
  pedidoId?: number
  criadoEm: string
}

/**
 * Tarja da embalagem. "vermelha-retencao": venda sob prescrição com retenção da receita
 * (antimicrobianos e controle especial). "preta": psicotrópicos, que causam dependência.
 */
export type Tarja = "sem-tarja" | "vermelha" | "vermelha-retencao" | "preta"

export type TipoMedicamento = "referencia" | "generico" | "similar"

/** Lista da Portaria 344/98 (controlados) ou antimicrobiano (RDC 471/2021). */
export type ListaControle = "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | "antimicrobiano"

export type DadosMedicamento = {
  tarja: Tarja
  tipo: TipoMedicamento
  principioAtivo: string
  /** Concentração e forma. Exemplo: "500 mg, 20 comprimidos". */
  apresentacao: string
  laboratorio: string
  /** Registro no Ministério da Saúde (Anvisa), 13 dígitos. */
  registroMs: string
  lista?: ListaControle
  /** Guardar entre 2 °C e 8 °C (insulinas, vacinas). */
  refrigerado?: boolean
  /** Preço máximo ao consumidor (tabela CMED). */
  pmc?: number
}

/** Receituário: o papel e as regras mudam com o que foi prescrito. */
export type TipoReceita =
  | "simples"
  | "antimicrobiano"
  | "controle-especial"
  | "notificacao-b"
  | "notificacao-a"

export type Receita = {
  id: string
  recebidaEm: string
  canal: "site" | "whatsapp" | "balcao"
  pedidoNumero?: number
  paciente: { nome: string; telefone: string }
  prescritor: { nome: string; conselho: "CRM" | "CRO"; numero: string; uf: string }
  tipo: TipoReceita
  /** Data escrita na receita (AAAA-MM-DD). */
  emitidaEm: string
  itens: { produtoId: string; quantidade: number; posologia: string }[]
}

/** Lote em estoque: a validade é a do lote, não a do produto. */
export type Lote = {
  id: string
  produtoId: string
  codigo: string
  /** AAAA-MM-DD. */
  validade: string
  quantidade: number
  /** Abaixo disso, pede reposição. */
  minimo: number
}

/** Escrituração de controlados: toda entrada e saída, com o documento. */
export type MovimentoControlado = {
  id: string
  produtoId: string
  em: string
  tipo: "entrada" | "saida" | "perda"
  quantidade: number
  /** Nota fiscal na entrada; número da receita ou notificação na saída. */
  documento: string
  /** Saída: paciente e prescritor. */
  paciente?: string
  prescritor?: string
}

export type Mesa = {
  id: string
  numero: number
  nome: string
  status: "livre" | "ocupada"
  pedidoAtivoId?: number
  clienteNome?: string
  ocupadaEm?: string
}

export type Motoboy = { id: string; nome: string; telefone: string; ativo: boolean }

export type Bairro = { id: string; cidade: string; nome: string; taxa: number; ativo: boolean }

/** Dia da semana: 0 = domingo. */
export type HorarioFuncionamento = { dia: number; aberto: boolean; abre: string; fecha: string }

export type SomAlerta = "suave" | "alto" | "muito-alto"

export type ConfigLoja = {
  nome: string
  slogan: string
  telefone: string
  whatsapp: string
  endereco: string
  /** Vazio: o texto é montado a partir dos horários. */
  textoHorario: string
  controleAutomatico: boolean
  aberta: boolean
  mensagemFechada: string
  horarios: HorarioFuncionamento[]
  aceitaEntrega: boolean
  aceitaRetirada: boolean
  taxaEntregaPadrao: number
  pedidoMinimo: number
  tempoEntrega: string
  tempoRetirada: string
  /** Vazio = qualquer cidade. */
  cidadesAtendidas: string[]
  pagamentos: Record<FormaPagamento, boolean>
  /** Conta de pagamento online (Mercado Pago) conectada: libera Pix e cartão online. */
  pagamentoOnlineConectado?: boolean
  /** Salão: quantos atendimentos cabem ao mesmo tempo. Sem o campo, 1. */
  capacidadeAtendimentos?: number
  impressaoAutomatica: boolean
  cortarPapel: boolean
  som: SomAlerta
  /** Pedido do site espera a loja aceitar ou recusar na fila. */
  aceiteManual: boolean
  /** Depois de quantos minutos sem aceite o cartão fica vermelho. A loja nunca recusa sozinha. */
  limiteAceiteMin: number
  /** Salão: vídeo do banner da loja (YouTube, Shorts ou Reels). */
  videoBanner?: string
  vitrines: {
    destaques: { titulo: string; ativo: boolean }
    ofertas: { titulo: string; ativo: boolean }
  }
}

/** Catálogo e cadastros de uma loja, sem os pedidos (que são gerados). */
export type CatalogoLoja = {
  loja: ConfigLoja
  categorias: Categoria[]
  produtos: Produto[]
  mesas: Mesa[]
  motoboys: Motoboy[]
  bairros: Bairro[]
  /** Nomes de clientes de exemplo, para os pedidos gerados. */
  clientes: { nome: string; telefone: string }[]
}

/** Tudo o que o painel de uma loja lê e altera. */
export type BaseLoja = CatalogoLoja & {
  pedidos: Pedido[]
  /** Histórico do estoque geral, do mais antigo para o mais novo. */
  movimentosEstoque: MovimentoEstoque[]
}
