import { useEffect, useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { cardapioCasaDaPizza } from "@/lib/mock/casa-da-pizza"
import { clienteAtual } from "../cliente"

/* ------------------------------------------------------------------ */
/* Opções de cada configuração                                         */
/* ------------------------------------------------------------------ */

export type VarianteCard = "classico" | "vitrine" | "compacto" | "imersivo" | "mosaico"
export type Disposicao = "lista" | "grade" | "carrossel"
export type ExibicaoBloco = "padrao" | Disposicao
export type Colunas = 1 | 2 | 3 | 4
export type Espacamento = "justo" | "padrao" | "amplo"
export type EstiloBotao = "solido" | "suave" | "contorno" | "degrade" | "brilho"
export type FonteTitulo = "bricolage" | "figtree" | "fraunces" | "space" | "playfair"
export type FonteTexto = "figtree" | "dm" | "outfit"
export type EstiloTituloSecao = "barra" | "sublinhado" | "simples" | "pilula"
export type EntradaPagina = "nenhuma" | "suave" | "subir" | "zoom" | "desfoque" | "cascata"
export type AberturaProduto = "deslizar" | "escalar" | "morph"
export type EfeitoAdicionar = "voo" | "pulso" | "confete"
export type HoverCard = "nenhum" | "levantar" | "zoom" | "brilho"
export type EstiloCabecalho = "padrao" | "compacto" | "dividido"
export type AlturaBanner = "baixo" | "padrao" | "alto"
export type LayoutProduto = "painel" | "janela" | "tela-cheia"
export type EstiloSacola = "ilha" | "gaveta" | "pagina"
export type FluxoFinalizar = "passos" | "pagina-unica"
export type CarregamentoEnvio = "simples" | "tematico"
export type TopoAcompanhamento = "neutro" | "marca" | "foto"
export type TemaPadrao = "sistema" | "claro" | "escuro"
export type MetodoPagamento = "pix" | "cartao-online" | "dinheiro" | "cartao-entrega"

/** Blocos fixos da página inicial; cada categoria do cardápio vira um bloco também. */
export type BlocoFixo = "mais-pedidas" | "ofertas" | "promocional" | "avaliacoes"
export type BlocoId = BlocoFixo | `categoria:${string}`
export type Bloco = { id: BlocoId; ativo: boolean; exibicao: ExibicaoBloco }

export type Config = {
  identidade: {
    nome: string
    slogan: string
    /** Imagens enviadas ficam como data URL; `null` usa a imagem atual da loja. */
    logo: string | null
    banner: string | null
    mostrarLogo: boolean
    escurecerBanner: number
    alturaBanner: AlturaBanner
    fundo: string | null
    opacidadeFundo: number
  }
  cores: {
    paleta: string
    primaria: string
    acento: string
    fundo: string
    tinta: string
    botao: EstiloBotao
    /** Arredondamento base em pixels. */
    cantos: number
    temaPadrao: TemaPadrao
  }
  tipografia: {
    titulo: FonteTitulo
    texto: FonteTexto
    /** Escala do texto, em porcentagem. */
    escala: number
    tituloSecao: EstiloTituloSecao
  }
  animacoes: {
    entrada: EntradaPagina
    /** Multiplicador da duração: menor é mais rápido. */
    velocidade: number
    abrirProduto: AberturaProduto
    aoAdicionar: EfeitoAdicionar
    hover: HoverCard
  }
  inicio: {
    cabecalho: EstiloCabecalho
    painelInfo: boolean
    barraCategorias: boolean
    blocos: Bloco[]
  }
  cards: {
    variante: VarianteCard
    disposicao: Disposicao
    colunasCelular: Colunas
    colunasComputador: Colunas
    espacamento: Espacamento
    descricao: boolean
    seloOferta: boolean
  }
  produto: {
    layout: LayoutProduto
    previaIlustrada: boolean
    passosEmAbas: boolean
    observacao: boolean
    sugestoes: boolean
    textoBotao: string
  }
  sacola: {
    estilo: EstiloSacola
    barraMinimo: boolean
    sugestoes: boolean
    textoBotao: string
  }
  finalizar: {
    fluxo: FluxoFinalizar
    pagamentos: Record<MetodoPagamento, boolean>
    cpfNaNota: boolean
    observacao: boolean
    cupom: boolean
    gorjeta: boolean
    carregamento: CarregamentoEnvio
    textoBotao: string
  }
  acompanhamento: {
    topo: TopoAcompanhamento
    linhaDoTempo: boolean
    mapa: boolean
    avaliar: boolean
    agradecimento: string
  }
  conversa: {
    ativa: boolean
    saudacao: string
    resumoNoChat: boolean
  }
  recursos: {
    busca: boolean
    compartilhar: boolean
    alternarTema: boolean
    horario: boolean
    seloAberto: boolean
    pedidoMinimo: boolean
    whatsapp: boolean
    fidelidade: boolean
    popupPromocao: boolean
  }
}

export type SecaoConfig = keyof Config

/* ------------------------------------------------------------------ */
/* Recursos pagos                                                      */
/* ------------------------------------------------------------------ */

/**
 * Opções do plano Pro, no formato `secao.campo` (liga/desliga) ou `secao.campo:valor` (escolha).
 * Ficam com cadeado até a loja liberar.
 */
export const CATALOGO_PRO: Record<string, { nome: string; preco: number }> = {
  "identidade.fundo": { nome: "Imagem de fundo", preco: 9.9 },
  "cores.paleta:noite": { nome: "Paleta Noite", preco: 4.9 },
  "cores.paleta:oliva": { nome: "Paleta Oliva", preco: 4.9 },
  "cores.botao:degrade": { nome: "Botão degradê", preco: 4.9 },
  "cores.botao:brilho": { nome: "Botão com brilho", preco: 6.9 },
  "tipografia.titulo:fraunces": { nome: "Fonte Fraunces", preco: 4.9 },
  "tipografia.titulo:space": { nome: "Fonte Space Grotesk", preco: 4.9 },
  "tipografia.titulo:playfair": { nome: "Fonte Playfair", preco: 4.9 },
  "tipografia.tituloSecao:pilula": { nome: "Títulos em pílula", preco: 2.9 },
  "animacoes.entrada:desfoque": { nome: "Entrada com desfoque", preco: 7.9 },
  "animacoes.entrada:cascata": { nome: "Entrada em cascata", preco: 7.9 },
  "animacoes.abrirProduto:morph": { nome: "Abertura Transformar", preco: 9.9 },
  "animacoes.aoAdicionar:confete": { nome: "Confete ao adicionar", preco: 5.9 },
  "animacoes.hover:brilho": { nome: "Contorno ao passar o mouse", preco: 3.9 },
  "inicio.cabecalho:dividido": { nome: "Cabeçalho dividido", preco: 9.9 },
  "inicio.bloco:promocional": { nome: "Banner promocional", preco: 14.9 },
  "inicio.bloco:avaliacoes": { nome: "Avaliações dos clientes", preco: 12.9 },
  "cards.variante:imersivo": { nome: "Card Imersivo", preco: 9.9 },
  "cards.variante:mosaico": { nome: "Card Mosaico", preco: 9.9 },
  "produto.layout:tela-cheia": { nome: "Produto em tela cheia", preco: 7.9 },
  "produto.sugestoes": { nome: "Peça também, no produto", preco: 19.9 },
  "sacola.estilo:pagina": { nome: "Sacola em página", preco: 6.9 },
  "sacola.sugestoes": { nome: "Sugestões na sacola", preco: 19.9 },
  "finalizar.cupom": { nome: "Cupom de desconto", preco: 14.9 },
  "finalizar.gorjeta": { nome: "Gorjeta para o entregador", preco: 9.9 },
  "finalizar.carregamento:tematico": { nome: "Carregamento temático", preco: 7.9 },
  "acompanhamento.topo:foto": { nome: "Topo com foto", preco: 4.9 },
  "acompanhamento.mapa": { nome: "Mapa da entrega", preco: 24.9 },
  "acompanhamento.avaliar": { nome: "Avaliação do pedido", preco: 12.9 },
  "conversa.resumoNoChat": { nome: "Resumo do pedido no chat", preco: 9.9 },
  "recursos.fidelidade": { nome: "Cartão fidelidade", preco: 29.9 },
  "recursos.popupPromocao": { nome: "Promoção ao entrar", preco: 14.9 },
}

/** Preço mensal do pacote com todos os recursos Pro. */
export const PRECO_PRO_COMPLETO = 79.9

export const OPCOES_PRO = new Set(Object.keys(CATALOGO_PRO))

export function ehPro(chave: string) {
  return OPCOES_PRO.has(chave)
}

/* ------------------------------------------------------------------ */
/* Valores iniciais                                                    */
/* ------------------------------------------------------------------ */

export const ROTULO_BLOCO: Record<BlocoFixo, string> = {
  "mais-pedidas": "Mais pedidas",
  ofertas: "Ofertas do dia",
  promocional: "Banner promocional",
  avaliacoes: "Avaliações dos clientes",
}

export function nomeDoBloco(id: BlocoId) {
  if (id.startsWith("categoria:")) {
    const categoria = cardapioCasaDaPizza.find((item) => `categoria:${item.id}` === id)
    return categoria?.nome ?? "Categoria"
  }
  return ROTULO_BLOCO[id as BlocoFixo]
}

const blocosIniciais: Bloco[] = [
  { id: "mais-pedidas", ativo: true, exibicao: "carrossel" },
  { id: "ofertas", ativo: false, exibicao: "carrossel" },
  { id: "promocional", ativo: false, exibicao: "padrao" },
  ...cardapioCasaDaPizza.map(
    (categoria): Bloco => ({
      id: `categoria:${categoria.id}`,
      ativo: true,
      exibicao: "padrao",
    }),
  ),
  { id: "avaliacoes", ativo: false, exibicao: "carrossel" },
]

export const CONFIG_PADRAO: Config = {
  identidade: {
    nome: clienteAtual.nome,
    slogan: clienteAtual.slogan,
    logo: null,
    banner: null,
    mostrarLogo: true,
    escurecerBanner: 45,
    alturaBanner: "padrao",
    fundo: null,
    opacidadeFundo: 12,
  },
  cores: {
    paleta: "marca",
    ...clienteAtual.tema,
    botao: "solido",
    cantos: 12,
    temaPadrao: "sistema",
  },
  tipografia: { titulo: "bricolage", texto: "figtree", escala: 100, tituloSecao: "barra" },
  animacoes: {
    entrada: "subir",
    velocidade: 1,
    abrirProduto: "deslizar",
    aoAdicionar: "voo",
    hover: "levantar",
  },
  inicio: { cabecalho: "padrao", painelInfo: true, barraCategorias: true, blocos: blocosIniciais },
  cards: {
    variante: "classico",
    disposicao: "grade",
    colunasCelular: 1,
    colunasComputador: 3,
    espacamento: "padrao",
    descricao: true,
    seloOferta: true,
  },
  produto: {
    layout: "painel",
    previaIlustrada: true,
    passosEmAbas: true,
    observacao: true,
    sugestoes: false,
    textoBotao: "Adicionar",
  },
  sacola: { estilo: "ilha", barraMinimo: true, sugestoes: false, textoBotao: "Continuar" },
  finalizar: {
    fluxo: "passos",
    pagamentos: { pix: true, "cartao-online": true, dinheiro: true, "cartao-entrega": true },
    cpfNaNota: true,
    observacao: true,
    cupom: false,
    gorjeta: false,
    carregamento: "simples",
    textoBotao: "Enviar pedido",
  },
  acompanhamento: {
    topo: "neutro",
    linhaDoTempo: true,
    mapa: false,
    avaliar: false,
    agradecimento: "Obrigado pela preferência! Seu pedido já está com a gente.",
  },
  conversa: {
    ativa: true,
    saudacao: "Olá! Recebemos seu pedido e já vamos começar a preparar.",
    resumoNoChat: false,
  },
  recursos: {
    busca: true,
    compartilhar: true,
    alternarTema: true,
    horario: true,
    seloAberto: true,
    pedidoMinimo: true,
    whatsapp: false,
    fidelidade: false,
    popupPromocao: false,
  },
}

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

type EstadoConfig = {
  config: Config
  /** Plano Pro liberado: as opções com cadeado ficam disponíveis e ganham brilho. */
  pro: boolean
  /** Recursos Pro contratados um a um, pela sacola do painel. */
  compradas: string[]
  /** O que está valendo no site: a última configuração aplicada. */
  publicada: Config
  publicadaEm: string | null
  /** Sacola do painel aberta (itens Pro escolhidos e ainda não contratados). */
  sacolaAberta: boolean
  /** A sacola abriu porque a pessoa pediu para aplicar no site. */
  sacolaParaAplicar: boolean
  hidratada: boolean
  atualizar: <S extends SecaoConfig>(secao: S, parcial: Partial<Config[S]>) => void
  restaurarSecao: (secao: SecaoConfig) => void
  restaurarTudo: () => void
  definirPro: (pro: boolean) => void
  abrirSacola: (aberta: boolean, paraAplicar?: boolean) => void
  /** Tira um recurso Pro da sacola: a opção volta ao padrão. */
  removerDaSacola: (chave: string) => void
  /** Contrata recursos Pro avulsos ou, com `"tudo"`, o pacote completo. */
  contratar: (chaves: string[] | "tudo") => void
  /** Aplica no site a configuração atual, só com o que está liberado. */
  aplicarNoSite: () => void
  /** Desfaz o que mudou desde a última aplicação. */
  descartar: () => void
  /** Volta o site e as configurações ao original da loja. */
  voltarAoOriginal: () => void
}

/** Guarda as configurações no navegador; o protótipo ainda não tem servidor. */
export const useConfig = create<EstadoConfig>()(
  persist(
    (set) => ({
      config: CONFIG_PADRAO,
      pro: false,
      compradas: [],
      publicada: CONFIG_PADRAO,
      publicadaEm: null,
      sacolaAberta: false,
      sacolaParaAplicar: false,
      hidratada: false,
      atualizar: (secao, parcial) =>
        set(({ config }) => ({
          config: { ...config, [secao]: { ...config[secao], ...parcial } },
        })),
      restaurarSecao: (secao) =>
        set(({ config }) => ({ config: { ...config, [secao]: CONFIG_PADRAO[secao] } })),
      restaurarTudo: () => set({ config: CONFIG_PADRAO }),
      definirPro: (pro) => set({ pro }),
      abrirSacola: (sacolaAberta, paraAplicar = false) =>
        set({ sacolaAberta, sacolaParaAplicar: sacolaAberta && paraAplicar }),
      removerDaSacola: (chave) => set(({ config }) => ({ config: reverterOpcao(config, chave) })),
      contratar: (chaves) =>
        set(({ compradas }) =>
          chaves === "tudo"
            ? { pro: true }
            : { compradas: [...new Set([...compradas, ...chaves])] },
        ),
      aplicarNoSite: () =>
        set(({ config, pro, compradas }) => ({
          publicada: aplicarPlano(config, (chave) => pro || compradas.includes(chave)),
          publicadaEm: new Date().toISOString(),
        })),
      descartar: () => set(({ publicada }) => ({ config: publicada })),
      voltarAoOriginal: () =>
        set({
          config: CONFIG_PADRAO,
          publicada: CONFIG_PADRAO,
          publicadaEm: new Date().toISOString(),
        }),
    }),
    {
      name: "clickpedido-admin",
      version: 1,
      skipHydration: true,
      partialize: ({ config, pro, compradas, publicada, publicadaEm }) => ({
        config,
        pro,
        compradas,
        publicada,
        publicadaEm,
      }),
      // Seções novas entram com o valor padrão, sem perder o que já foi salvo.
      merge: (salvo, atual) => {
        const parcial = (salvo ?? {}) as Partial<EstadoConfig>
        const config = { ...CONFIG_PADRAO }
        for (const secao of Object.keys(CONFIG_PADRAO) as SecaoConfig[]) {
          Object.assign(config, {
            [secao]: { ...CONFIG_PADRAO[secao], ...(parcial.config?.[secao] ?? {}) },
          })
        }
        // Grades salvas antes do limite de 4 colunas.
        config.cards = {
          ...config.cards,
          colunasCelular: Math.min(4, config.cards.colunasCelular) as Colunas,
          colunasComputador: Math.min(4, config.cards.colunasComputador) as Colunas,
        }
        return {
          ...atual,
          config,
          pro: parcial.pro ?? false,
          compradas: parcial.compradas ?? [],
          publicada: parcial.publicada ?? CONFIG_PADRAO,
          publicadaEm: parcial.publicadaEm ?? null,
        }
      },
      onRehydrateStorage: () => () => useConfig.setState({ hidratada: true }),
    },
  ),
)

type Secoes = Record<string, Record<string, unknown>>

function partes(chave: string) {
  const [caminho, valor] = chave.split(":")
  const [secao, campo] = caminho.split(".")
  return { secao, campo, valor }
}

/** A opção Pro está sendo usada na configuração? */
export function opcaoEmUso(config: Config, chave: string) {
  const { secao, campo, valor } = partes(chave)
  if (campo === "bloco")
    return config.inicio.blocos.some((bloco) => bloco.id === valor && bloco.ativo)
  const atual = (config as unknown as Secoes)[secao][campo]
  if (valor === undefined) return atual !== false && atual !== null && atual !== undefined
  return atual === valor
}

/** Volta uma opção Pro ao padrão: escolhas ao valor inicial, liga/desliga e blocos desligados. */
export function reverterOpcao(config: Config, chave: string): Config {
  if (!opcaoEmUso(config, chave)) return config
  const { secao, campo, valor } = partes(chave)
  const nova = structuredClone(config)
  const secoes = nova as unknown as Secoes
  const padrao = CONFIG_PADRAO as unknown as Secoes
  if (campo === "bloco") {
    nova.inicio.blocos = nova.inicio.blocos.map((bloco) =>
      bloco.id === valor ? { ...bloco, ativo: false } : bloco,
    )
  } else {
    secoes[secao][campo] = padrao[secao][campo]
    // Paleta paga: as cores dela também voltam às da marca.
    if (secao === "cores" && campo === "paleta") {
      const { primaria, acento, fundo, tinta } = CONFIG_PADRAO.cores
      Object.assign(nova.cores, { primaria, acento, fundo, tinta })
    }
  }
  return nova
}

/** O que vai para o site: as opções Pro sem liberação voltam ao padrão. */
export function aplicarPlano(config: Config, liberada: (chave: string) => boolean): Config {
  let resultado = config
  for (const chave of OPCOES_PRO) {
    if (!liberada(chave)) resultado = reverterOpcao(resultado, chave)
  }
  return resultado
}

/**
 * O que a prévia desenha: tudo o que foi escolhido, inclusive as opções Pro
 * que ainda estão na sacola. Assim dá para ver antes de contratar.
 */
export function useConfigEfetiva(): Config {
  return useConfig((estado) => estado.config)
}

/** Lê uma seção inteira das configurações. */
export function useSecao<S extends SecaoConfig>(secao: S): Config[S] {
  return useConfig((estado) => estado.config[secao])
}

/**
 * Estado de uma opção Pro: bloqueada (sem contratar), na sacola (escolhida e ainda
 * não contratada) ou liberada (Pro completo ou contratada), que é quando ela brilha.
 */
export function useOpcaoPro(chave: string) {
  const ehOpcaoPro = ehPro(chave)
  const liberada = useConfig(
    (estado) => ehOpcaoPro && (estado.pro || estado.compradas.includes(chave)),
  )
  const emUso = useConfig((estado) => ehOpcaoPro && opcaoEmUso(estado.config, chave))
  return {
    ehPro: ehOpcaoPro,
    bloqueada: ehOpcaoPro && !liberada,
    naSacola: ehOpcaoPro && !liberada && emUso,
    liberada,
  }
}

export type ItemSacolaAdmin = { chave: string; nome: string; preco: number }

/** Itens da sacola do painel: opções Pro em uso que ainda não foram contratadas. */
export function itensDaSacola(
  config: Config,
  pro: boolean,
  compradas: string[],
): ItemSacolaAdmin[] {
  if (pro) return []
  return [...OPCOES_PRO]
    .filter((chave) => !compradas.includes(chave) && opcaoEmUso(config, chave))
    .map((chave) => ({ chave, ...CATALOGO_PRO[chave] }))
}

export function useSacolaAdmin() {
  const config = useConfig((estado) => estado.config)
  const pro = useConfig((estado) => estado.pro)
  const compradas = useConfig((estado) => estado.compradas)
  return useMemo(() => itensDaSacola(config, pro, compradas), [config, pro, compradas])
}

/** Há mudanças que ainda não foram aplicadas no site? */
export function useMudancasPendentes() {
  const config = useConfig((estado) => estado.config)
  const publicada = useConfig((estado) => estado.publicada)
  return useMemo(() => JSON.stringify(config) !== JSON.stringify(publicada), [config, publicada])
}

/**
 * Garante que as configurações salvas no navegador foram lidas e diz quando terminou.
 * Quem precisa dos valores salvos (campos e prévia) usa este hook em vez de supor a leitura.
 */
export function useConfigCarregada() {
  const hidratada = useConfig((estado) => estado.hidratada)
  useEffect(() => {
    if (!useConfig.persist.hasHydrated()) void useConfig.persist.rehydrate()
  }, [])
  return hidratada
}
