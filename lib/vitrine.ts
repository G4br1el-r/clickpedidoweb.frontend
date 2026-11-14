import type { StaticImageData } from "next/image"
import type {
  CatalogoLoja,
  FormaPagamento,
  HorarioFuncionamento,
  Produto as ProdutoPainel,
} from "./admin/dados/tipos"
import { formatarTelefone } from "./admin/regras/mensagens"
import { type SegmentoId, segmentos, type TipoOpcaoDe, type TipoProdutoDe } from "./segmentos"
import type { Banner, Categoria, GrupoOpcao, HorarioDia, Loja, Produto, Tema } from "./tipos"

/** Segunda a domingo, como a loja mostra os dias. */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0]
const NOMES_DOS_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** "07:00" vira "7h"; "23:30" vira "23h30". */
function hora(texto: string) {
  const [h, m] = texto.split(":")
  return `${Number(h)}h${m === "00" ? "" : m}`
}

/** A grade do painel em linhas para a loja: dias seguidos com o mesmo horário ficam juntos. */
export function horariosDaSemana(horarios: HorarioFuncionamento[]): HorarioDia[] {
  const textos = ORDEM_DOS_DIAS.map((dia) => {
    const horario = horarios.find((item) => item.dia === dia)
    return horario?.aberto ? `${hora(horario.abre)} às ${hora(horario.fecha)}` : "Fechado"
  })
  if (textos.every((texto) => texto === textos[0])) {
    return [{ dia: "Todos os dias", horario: textos[0] }]
  }

  const linhas: HorarioDia[] = []
  let inicio = 0
  for (let indice = 1; indice <= textos.length; indice += 1) {
    if (indice < textos.length && textos[indice] === textos[inicio]) continue
    const primeiro = NOMES_DOS_DIAS[ORDEM_DOS_DIAS[inicio]]
    const ultimo = NOMES_DOS_DIAS[ORDEM_DOS_DIAS[indice - 1]]
    linhas.push({
      dia: indice - 1 === inicio ? primeiro : `${primeiro} a ${ultimo.toLowerCase()}`,
      horario: textos[inicio],
    })
    inicio = indice
  }
  return linhas
}

const semPrefixo = (id: string) => id.replace(/^(prod|cat)-/, "")

const PAGAMENTOS: Record<FormaPagamento, string> = {
  pix: "Pix",
  "cartao-online": "Cartão online",
  dinheiro: "Dinheiro",
  "cartao-na-entrega": "Cartão na entrega",
  "pagar-apos-pesagem": "Pagar após a pesagem",
}

/** Uma cor lisa, do fundo da loja, enquanto a foto chega. */
function desfoqueDa(cor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><rect width="3" height="2" fill="${cor}"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** Foto do `/public` no formato que o next/image espera de uma importação estática. */
const foto = (src: string, desfoque: string): StaticImageData => ({
  src,
  width: 800,
  height: 533,
  blurDataURL: desfoque,
})

export type InfoVitrine<S extends SegmentoId> = {
  id: string
  segmento: S
  tema: Tema
  logo: string
  banner: string
  /** Banners escritos à mão; sem eles, saem dos destaques e das ofertas. */
  banners?: Banner[]
}

/**
 * A vitrine do cliente a partir do catálogo do painel: o mesmo cadastro para os dois lados.
 * Só entra o que está visível e disponível; os ids perdem o prefixo `prod-` e `cat-`.
 */
export function vitrineDoCatalogo<S extends SegmentoId>(
  catalogo: CatalogoLoja,
  info: InfoVitrine<S>,
): { loja: Loja<S>; categorias: Categoria<S>[] } {
  const desfoque = desfoqueDa(info.tema.fundo)
  const tipoProduto = segmentos[info.segmento].tiposProduto[0] as TipoProdutoDe<S>
  const tipoOpcao = (segmentos[info.segmento].tiposOpcao as readonly string[])[0] as TipoOpcaoDe<S>

  const paraVitrine = (produto: ProdutoPainel): Produto<S> => ({
    id: semPrefixo(produto.id),
    tipo: tipoProduto,
    nome: produto.nome,
    descricao: produto.descricao,
    preco: produto.preco,
    ...(produto.oferta && (produto.precoOriginal ?? 0) > produto.preco
      ? { precoOriginal: produto.precoOriginal }
      : {}),
    imagem: foto(produto.imagem ?? info.logo, desfoque),
    ...(produto.destaque ? { destaque: true } : {}),
    ...(produto.unidade === "kg" ? { unidade: "kg" as const } : {}),
    ...(produto.duracaoMin ? { duracaoMin: produto.duracaoMin } : {}),
    ...(produto.medicamento ? { medicamento: produto.medicamento } : {}),
    grupos: produto.grupos
      .filter((grupo) => grupo.ativo && grupo.itens.some((item) => item.ativo))
      .toSorted((a, b) => a.ordem - b.ordem)
      .map(
        (grupo): GrupoOpcao<S> => ({
          id: grupo.id,
          tipo: tipoOpcao,
          nome: grupo.nome,
          titulo: grupo.nome,
          obrigatorio: grupo.minimo > 0,
          maximo: grupo.maximo,
          gratisAte: grupo.gratisAte,
          itens: grupo.itens
            .filter((item) => item.ativo)
            .toSorted((a, b) => a.ordem - b.ordem)
            .map((item) => ({ id: item.id, nome: item.nome, extra: item.precoAdicional })),
        }),
      ),
  })

  const visiveis = catalogo.produtos.filter((produto) => produto.ativo && produto.disponivel)
  const categorias = catalogo.categorias
    .filter((categoria) => categoria.ativa)
    .toSorted((a, b) => a.ordem - b.ordem)
    .map((categoria) => ({
      id: semPrefixo(categoria.id),
      nome: categoria.nome,
      produtos: visiveis
        .filter((produto) => produto.categoriaId === categoria.id)
        .toSorted((a, b) => a.ordem - b.ordem)
        .map(paraVitrine),
    }))
    .filter((categoria) => categoria.produtos.length > 0)

  const todos = categorias.flatMap((categoria) => categoria.produtos)
  const vitrine = [
    ...todos.filter((produto) => produto.destaque),
    ...todos.filter((produto) => produto.precoOriginal && !produto.destaque),
  ].slice(0, 4)
  const banners: Banner[] =
    info.banners ??
    vitrine.map((produto, indice) => ({
      id: `banner-${produto.id}`,
      ...(produto.precoOriginal ? { selo: "Oferta" } : {}),
      titulo: produto.nome,
      texto: produto.descricao,
      ...(indice === 0 ? { chamada: "Ver produto" } : {}),
      imagem: produto.imagem,
      acao: { tipo: "produto", produtoId: produto.id },
    }))

  const { loja } = catalogo
  const bairros = catalogo.bairros.filter((bairro) => bairro.ativo)
  return {
    categorias,
    loja: {
      id: info.id,
      segmento: info.segmento,
      nome: loja.nome,
      slogan: loja.slogan,
      logo: foto(info.logo, desfoque),
      banner: foto(info.banner, desfoque),
      status: { aberta: loja.aberta, texto: loja.aberta ? "Aberto agora" : "Fechado agora" },
      entrega: {
        tempo: loja.tempoEntrega,
        taxa: bairros.length ? Math.min(...bairros.map((bairro) => bairro.taxa)) : 0,
        bairros: bairros.map(({ nome, taxa }) => ({ nome, taxa })),
      },
      retirada: { tempo: loja.tempoRetirada },
      pedidoMinimo: loja.pedidoMinimo,
      horarios: horariosDaSemana(loja.horarios),
      expediente: loja.horarios,
      capacidade: loja.capacidadeAtendimentos ?? 1,
      aceitaEntrega: loja.aceitaEntrega,
      endereco: loja.endereco,
      telefone: formatarTelefone(loja.telefone),
      pagamentos: (Object.keys(PAGAMENTOS) as FormaPagamento[])
        .filter((forma) => loja.pagamentos[forma])
        .map((forma) => PAGAMENTOS[forma]),
      tema: info.tema,
      ...(banners.length > 0 ? { banners } : {}),
    },
  }
}
