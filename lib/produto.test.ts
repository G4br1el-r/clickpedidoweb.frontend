import type { StaticImageData } from "next/image"
import { describe, expect, test } from "vitest"
import {
  acaoDoPasso,
  avisoDeFaltantes,
  escolhidosDe,
  gruposFaltantes,
  montarItemSacola,
  precoComExtras,
  textoDeBusca,
} from "./produto"
import type { GrupoOpcao, Produto } from "./tipos"

const IMAGEM = { src: "/pizza.jpg", width: 1, height: 1 } as StaticImageData

const SABOR_1 = {
  id: "sabor-1",
  tipo: "sabor",
  nome: "1º sabor",
  titulo: "Escolha o primeiro sabor",
  obrigatorio: true,
  itens: [
    { id: "calabresa", nome: "Calabresa", extra: 0 },
    { id: "camarao", nome: "Camarão", extra: 10 },
  ],
} as GrupoOpcao

const SABOR_2 = {
  id: "sabor-2",
  tipo: "sabor",
  nome: "2º sabor",
  titulo: "Escolha o segundo sabor",
  obrigatorio: true,
  itens: [{ id: "mussarela", nome: "Mussarela", extra: 0 }],
} as GrupoOpcao

const BORDA = {
  id: "borda",
  tipo: "borda",
  nome: "Borda",
  titulo: "Quer borda recheada?",
  obrigatorio: false,
  itens: [{ id: "catupiry", nome: "Catupiry", extra: 8.5 }],
} as GrupoOpcao

const GRUPOS = [SABOR_1, SABOR_2, BORDA]

const PRODUTO = {
  id: "pizza-montada",
  tipo: "pizza",
  nome: "Monte a sua",
  descricao: "",
  preco: 39.9,
  imagem: IMAGEM,
  grupos: GRUPOS,
} as Produto

describe("escolhidosDe", () => {
  test("devolve o item escolhido de cada grupo, na ordem dos grupos", () => {
    const escolhidos = escolhidosDe(GRUPOS, { borda: "catupiry", "sabor-1": "camarao" })

    expect(escolhidos.map(({ grupo, item }) => [grupo.id, item.id])).toEqual([
      ["sabor-1", "camarao"],
      ["borda", "catupiry"],
    ])
  })

  test("ignora escolha que não existe no grupo", () => {
    expect(escolhidosDe(GRUPOS, { "sabor-1": "portuguesa" })).toEqual([])
  })
})

describe("gruposFaltantes", () => {
  test("lista os grupos obrigatórios ainda sem escolha", () => {
    expect(gruposFaltantes(GRUPOS, {})).toEqual([SABOR_1, SABOR_2])
    expect(gruposFaltantes(GRUPOS, { "sabor-1": "calabresa" })).toEqual([SABOR_2])
  })

  test("grupo opcional nunca falta", () => {
    expect(gruposFaltantes(GRUPOS, { "sabor-1": "calabresa", "sabor-2": "mussarela" })).toEqual([])
  })
})

describe("avisoDeFaltantes", () => {
  test("com uma escolha faltando, usa o título do grupo", () => {
    expect(avisoDeFaltantes([SABOR_1])).toBe("Escolha o primeiro sabor para continuar")
  })

  test("com várias, conta e lista os nomes curtos", () => {
    expect(avisoDeFaltantes([SABOR_1, SABOR_2])).toBe("Faltam 2 escolhas: 1º sabor, 2º sabor")
  })
})

describe("precoComExtras", () => {
  test("soma ao preço do produto o extra de cada escolha", () => {
    const escolhidos = escolhidosDe(GRUPOS, { "sabor-1": "camarao", borda: "catupiry" })
    expect(precoComExtras(PRODUTO, escolhidos)).toBe(58.4)
  })

  test("sem escolhas, é o preço do produto", () => {
    expect(precoComExtras(PRODUTO, [])).toBe(39.9)
  })
})

describe("montarItemSacola", () => {
  test("monta o item com preço, quantidade e resumo das escolhas", () => {
    const escolhidos = escolhidosDe(GRUPOS, {
      "sabor-1": "camarao",
      "sabor-2": "mussarela",
      borda: "catupiry",
    })

    expect(montarItemSacola(PRODUTO, escolhidos, 2, "  sem cebola ")).toEqual({
      produtoId: "pizza-montada",
      nome: "Monte a sua",
      imagem: IMAGEM,
      precoUnitario: 58.4,
      quantidade: 2,
      resumo: ["Camarão", "Mussarela", "Borda catupiry"],
      observacao: "sem cebola",
    })
  })

  test("observação em branco não vai para o item", () => {
    expect(montarItemSacola(PRODUTO, [], 1, "   ").observacao).toBeUndefined()
  })
})

describe("na farmácia", () => {
  const remedio = (medicamento?: Produto["medicamento"]): Produto =>
    ({
      id: "amoxicilina-500",
      tipo: "medicamento",
      nome: "Amoxicilina 500 mg",
      descricao: "Antibiótico. Caixa com 21 cápsulas.",
      preco: 27.9,
      imagem: IMAGEM,
      ...(medicamento ? { medicamento } : {}),
    }) as Produto

  const amoxicilina = {
    tarja: "vermelha-retencao",
    tipo: "generico",
    principioAtivo: "Amoxicilina tri-hidratada",
    apresentacao: "500 mg, 21 cápsulas",
    laboratorio: "EMS",
    registroMs: "1023508930064",
    lista: "antimicrobiano",
  } as const

  test("o item da sacola guarda como o remédio pode ser vendido", () => {
    expect(montarItemSacola(remedio(amoxicilina), [], 1, "").venda).toBe("receita-retida")
    expect(montarItemSacola(remedio(), [], 1, "")).not.toHaveProperty("venda")
  })

  test("a busca também acha pelo princípio ativo e pelo laboratório", () => {
    expect(textoDeBusca(remedio(amoxicilina))).toBe(
      "amoxicilina 500 mg antibiotico. caixa com 21 capsulas. amoxicilina tri-hidratada ems",
    )
    expect(textoDeBusca(remedio())).toBe("amoxicilina 500 mg antibiotico. caixa com 21 capsulas.")
  })
})

describe("no açougue", () => {
  const picanha = {
    id: "picanha",
    tipo: "produto",
    nome: "Picanha",
    descricao: "",
    preco: 89.9,
    unidade: "kg",
    imagem: IMAGEM,
  } as Produto

  test("o corte por quilo entra com o peso escolhido e o preço estimado dele", () => {
    expect(montarItemSacola(picanha, [], 1, "", 500)).toMatchObject({
      produtoId: "picanha",
      precoUnitario: 44.95,
      quantidade: 1,
      resumo: ["500 g"],
      pesoGramas: 500,
    })
  })
})

describe("no salão", () => {
  test("o serviço leva a duração para a sacola", () => {
    const escova = {
      id: "escova",
      tipo: "produto",
      nome: "Escova",
      descricao: "",
      preco: 55,
      duracaoMin: 45,
      imagem: IMAGEM,
    } as Produto
    expect(montarItemSacola(escova, [], 1, "").duracaoMin).toBe(45)
  })
})

describe("grupos com várias escolhas (quiosque e adega)", () => {
  const ADICIONAIS = {
    id: "adicionais",
    tipo: "opcao",
    nome: "Adicionais",
    titulo: "Adicionais",
    obrigatorio: false,
    maximo: 3,
    gratisAte: 1,
    itens: [
      { id: "bacon", nome: "Bacon", extra: 4 },
      { id: "ovo", nome: "Ovo", extra: 2 },
      { id: "cheddar", nome: "Cheddar", extra: 3 },
    ],
  } as GrupoOpcao
  const PONTO = {
    id: "ponto",
    tipo: "opcao",
    nome: "Ponto",
    titulo: "Ponto da carne",
    obrigatorio: true,
    itens: [{ id: "ao-ponto", nome: "Ao ponto", extra: 0 }],
  } as GrupoOpcao
  const LANCHE = {
    id: "x-burger",
    tipo: "produto",
    nome: "X-Burger",
    descricao: "",
    preco: 20,
    imagem: IMAGEM,
    grupos: [PONTO, ADICIONAIS],
  } as Produto

  test("cada opção marcada vira uma escolha, na ordem em que foi marcada", () => {
    const escolhidos = escolhidosDe(LANCHE.grupos ?? [], {
      ponto: "ao-ponto",
      adicionais: ["cheddar", "bacon"],
    })
    expect(escolhidos.map(({ item }) => item.nome)).toEqual(["Ao ponto", "Cheddar", "Bacon"])
  })

  test("as primeiras até o limite grátis não cobram; as outras cobram o acréscimo", () => {
    const escolhidos = escolhidosDe(LANCHE.grupos ?? [], {
      ponto: "ao-ponto",
      adicionais: ["cheddar", "bacon", "ovo"],
    })
    // Cheddar sai grátis; bacon (4) e ovo (2) cobram.
    expect(precoComExtras(LANCHE, escolhidos)).toBe(26)
  })

  test("grupo de várias escolhas vazio só falta se for obrigatório", () => {
    expect(gruposFaltantes(LANCHE.grupos ?? [], { adicionais: [] }).map((g) => g.id)).toEqual([
      "ponto",
    ])
  })

  test("o resumo lista cada adicional", () => {
    const escolhidos = escolhidosDe(LANCHE.grupos ?? [], {
      ponto: "ao-ponto",
      adicionais: ["bacon", "ovo"],
    })
    expect(montarItemSacola(LANCHE, escolhidos, 1, "").resumo).toEqual(["Ao ponto", "Bacon", "Ovo"])
  })
})

describe("acaoDoPasso: o botão principal da folha, passo a passo", () => {
  const GRUPOS = [SABOR_1, SABOR_2, BORDA]

  test("antes do último passo, o botão avança; escolher não pula de passo sozinho", () => {
    expect(acaoDoPasso(GRUPOS, { "sabor-1": "calabresa" }, 0)).toEqual({
      tipo: "avancar",
      rotulo: "Avançar",
      para: 1,
    })
  })

  test("sem a escolha obrigatória do passo, avançar aponta o que falta nele", () => {
    expect(acaoDoPasso(GRUPOS, {}, 0)).toEqual({
      tipo: "falta",
      rotulo: "Avançar",
      grupo: SABOR_1,
    })
  })

  test("passo opcional avança mesmo sem escolha", () => {
    expect(acaoDoPasso([BORDA, SABOR_1], {}, 0)).toEqual({
      tipo: "avancar",
      rotulo: "Avançar",
      para: 1,
    })
  })

  test("no último passo, com tudo escolhido, o botão adiciona", () => {
    expect(
      acaoDoPasso(GRUPOS, { "sabor-1": "calabresa", "sabor-2": "mussarela", borda: "fina" }, 2),
    ).toEqual({ tipo: "adicionar", rotulo: "Adicionar" })
  })

  test("no último passo, faltando algo antes, o botão adiciona mas leva ao que falta", () => {
    expect(acaoDoPasso(GRUPOS, { borda: "fina" }, 2)).toEqual({
      tipo: "falta",
      rotulo: "Adicionar",
      grupo: SABOR_1,
    })
  })

  test("produto sem opções só adiciona", () => {
    expect(acaoDoPasso([], {}, 0)).toEqual({ tipo: "adicionar", rotulo: "Adicionar" })
  })
})
