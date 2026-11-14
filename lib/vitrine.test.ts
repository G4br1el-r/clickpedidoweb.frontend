import { describe, expect, test } from "vitest"
import { catalogoDeTeste } from "./admin/dados/catalogo-de-teste"
import type { HorarioFuncionamento } from "./admin/dados/tipos"
import { horariosDaSemana, vitrineDoCatalogo } from "./vitrine"

const semana = (mudar: (dia: number) => Partial<HorarioFuncionamento> = () => ({})) =>
  [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
    dia,
    aberto: true,
    abre: "18:00",
    fecha: "23:30",
    ...mudar(dia),
  }))

describe("horariosDaSemana", () => {
  test("a semana inteira igual vira uma linha só", () => {
    expect(horariosDaSemana(semana(() => ({ abre: "07:00", fecha: "23:00" })))).toEqual([
      { dia: "Todos os dias", horario: "7h às 23h" },
    ])
  })

  test("junta os dias seguidos com o mesmo horário, de segunda a domingo", () => {
    expect(horariosDaSemana(semana((dia) => (dia === 1 ? { aberto: false } : {})))).toEqual([
      { dia: "Segunda", horario: "Fechado" },
      { dia: "Terça a domingo", horario: "18h às 23h30" },
    ])
  })

  test("dias com horários diferentes ficam em linhas separadas", () => {
    const horarios = semana((dia) =>
      dia === 0 || dia === 1
        ? { aberto: false }
        : dia === 6
          ? { abre: "09:00", fecha: "14:00" }
          : { abre: "09:00", fecha: "19:00" },
    )
    expect(horariosDaSemana(horarios)).toEqual([
      { dia: "Segunda", horario: "Fechado" },
      { dia: "Terça a sexta", horario: "9h às 19h" },
      { dia: "Sábado", horario: "9h às 14h" },
      { dia: "Domingo", horario: "Fechado" },
    ])
  })
})

describe("vitrineDoCatalogo", () => {
  const TEMA = { primaria: "#9F1D1D", acento: "#E2A33B", fundo: "#F8F4F1", tinta: "#2A1712" }
  const INFO = {
    id: "acougue-teste",
    segmento: "acougue",
    tema: TEMA,
    logo: "/mock/admin/acougue/logo.jpg",
    banner: "/mock/admin/acougue/banner.jpg",
  } as const

  function catalogo() {
    const base = catalogoDeTeste()
    const lanche = base.produtos[0]
    return {
      ...base,
      categorias: [
        { id: "cat-carnes", nome: "Carnes", ordem: 2, ativa: true },
        { id: "cat-oculta", nome: "Oculta", ordem: 3, ativa: false },
        ...base.categorias,
      ],
      produtos: [
        lanche,
        {
          ...lanche,
          id: "prod-picanha",
          categoriaId: "cat-carnes",
          nome: "Picanha",
          descricao: "Peça com capa de gordura.",
          preco: 89.9,
          precoOriginal: 99.9,
          oferta: true,
          destaque: true,
          unidade: "kg" as const,
          imagem: "/mock/acougue/picanha.jpg",
          grupos: [],
        },
        { ...lanche, id: "prod-sumiu", categoriaId: "cat-carnes", nome: "Sumiu", ativo: false },
        {
          ...lanche,
          id: "prod-acabou",
          categoriaId: "cat-carnes",
          nome: "Acabou",
          disponivel: false,
        },
        { ...lanche, id: "prod-escondido", categoriaId: "cat-oculta", nome: "Escondido" },
      ],
    }
  }

  test("só entram categorias e produtos visíveis, na ordem, sem o prefixo dos ids", () => {
    const { categorias } = vitrineDoCatalogo(catalogo(), INFO)
    expect(categorias.map(({ id, produtos }) => [id, produtos.map((p) => p.id)])).toEqual([
      ["lanches", ["x-burger"]],
      ["carnes", ["picanha"]],
    ])
  })

  test("o produto leva a foto, a oferta, a venda por quilo e o destaque", () => {
    const picanha = vitrineDoCatalogo(catalogo(), INFO).categorias[1].produtos[0]
    expect(picanha).toMatchObject({
      nome: "Picanha",
      preco: 89.9,
      precoOriginal: 99.9,
      unidade: "kg",
      destaque: true,
      imagem: { src: "/mock/acougue/picanha.jpg", width: 800, height: 533 },
    })
    expect(picanha.imagem.blurDataURL).toMatch(/^data:image\//)
  })

  test("os grupos viram passos: obrigatório pelo mínimo, máximo e grátis do painel", () => {
    const lanche = vitrineDoCatalogo(catalogo(), INFO).categorias[0].produtos[0]
    expect(lanche.grupos).toEqual([
      {
        id: "grp-x-burger-1",
        tipo: "opcao",
        nome: "Adicional",
        titulo: "Adicional",
        obrigatorio: true,
        maximo: 1,
        gratisAte: 0,
        itens: [{ id: "opc-x-burger-1-1", nome: "Bacon", extra: 3 }],
      },
    ])
  })

  test("a loja traz entrega, horários, pagamentos e as cores do segmento", () => {
    const { loja } = vitrineDoCatalogo(catalogo(), INFO)
    expect(loja).toMatchObject({
      id: "acougue-teste",
      segmento: "acougue",
      nome: "Teste",
      status: { aberta: true, texto: "Aberto agora" },
      entrega: { tempo: "40 min", taxa: 5, bairros: [{ nome: "Centro", taxa: 5 }] },
      retirada: { tempo: "20 min" },
      horarios: [{ dia: "Todos os dias", horario: "18h às 23h" }],
      telefone: "(12) 3000-0000",
      pagamentos: ["Pix", "Cartão online", "Dinheiro", "Cartão na entrega"],
      tema: TEMA,
    })
    expect(loja.logo.src).toBe("/mock/admin/acougue/logo.jpg")
  })

  test("a loja leva a grade de horários, a capacidade e se faz entrega, para agendar", () => {
    const base = catalogo()
    const { loja } = vitrineDoCatalogo(
      { ...base, loja: { ...base.loja, aceitaEntrega: false, capacidadeAtendimentos: 2 } },
      INFO,
    )
    expect(loja.aceitaEntrega).toBe(false)
    expect(loja.capacidade).toBe(2)
    expect(loja.expediente).toEqual(base.loja.horarios)
    expect(vitrineDoCatalogo(base, INFO).loja).toMatchObject({ aceitaEntrega: true, capacidade: 1 })
  })

  test("os banners saem dos destaques e das ofertas", () => {
    const { loja } = vitrineDoCatalogo(catalogo(), INFO)
    expect(loja.banners?.[0]).toMatchObject({
      titulo: "Picanha",
      selo: "Oferta",
      acao: { tipo: "produto", produtoId: "picanha" },
    })
  })
})
