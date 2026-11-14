import { describe, expect, test } from "vitest"
import { camposDoProduto, esquemaProduto } from "./esquema-produto"

const VALIDO = {
  categoriaId: "cat-pizzas",
  nome: "Calabresa",
  descricao: "Calabresa e cebola",
  preco: 50,
  ativo: true,
  disponivel: true,
  destaque: false,
  oferta: false,
  grupos: [
    {
      id: "grp-1",
      nome: "Borda",
      minimo: 0,
      maximo: 1,
      gratisAte: 0,
      ativo: true,
      itens: [{ id: "opc-1", nome: "Catupiry", precoAdicional: 8, ativo: true }],
    },
  ],
}

/** Mensagens de erro por campo, como o formulário mostra. */
function erros(segmento: Parameters<typeof esquemaProduto>[0], valores: unknown) {
  const resultado = esquemaProduto(segmento).safeParse(valores)
  if (resultado.success) return {}
  return Object.fromEntries(
    resultado.error.issues.map((erro) => [erro.path.join("."), erro.message]),
  )
}

describe("imagem do produto", () => {
  test("aceita a foto enviada (data:image/) e o caminho local; sem foto também", () => {
    expect(erros("pizzaria", { ...VALIDO, imagem: "data:image/webp;base64,AAAA" })).toEqual({})
    expect(erros("pizzaria", { ...VALIDO, imagem: "/mock/pizzaria/calabresa.webp" })).toEqual({})
    expect(erros("pizzaria", VALIDO)).toEqual({})
  })

  test("recusa endereço externo, outro tipo de dado e caminho sem barra", () => {
    const mensagem = { imagem: "Envie a foto pelo botão." }
    expect(erros("pizzaria", { ...VALIDO, imagem: "https://exemplo.com/foto.png" })).toEqual(
      mensagem,
    )
    expect(erros("pizzaria", { ...VALIDO, imagem: "//exemplo.com/foto.png" })).toEqual(mensagem)
    expect(erros("pizzaria", { ...VALIDO, imagem: "javascript:alert(1)" })).toEqual(mensagem)
    expect(erros("pizzaria", { ...VALIDO, imagem: "data:text/html,<b>oi</b>" })).toEqual(mensagem)
    expect(erros("pizzaria", { ...VALIDO, imagem: "foto.png" })).toEqual(mensagem)
  })
})

describe("camposDoProduto", () => {
  test("cada segmento mostra só o que usa", () => {
    expect(camposDoProduto("salao")).toEqual({
      grupos: false,
      precoBalcao: true,
      unidade: false,
      duracao: true,
      video: true,
    })
    expect(camposDoProduto("acougue")).toMatchObject({ unidade: true, grupos: true })
    expect(camposDoProduto("lanchonete")).toMatchObject({ precoBalcao: false, grupos: true })
  })
})

describe("esquemaProduto", () => {
  test("um produto completo passa", () => {
    expect(erros("pizzaria", VALIDO)).toEqual({})
  })

  test("nome, categoria e preço são obrigatórios", () => {
    expect(erros("pizzaria", { ...VALIDO, nome: "  ", categoriaId: "", preco: 0 })).toEqual({
      nome: "Informe o nome do produto.",
      categoriaId: "Escolha a categoria.",
      preco: "Informe um preço maior que zero.",
    })
  })

  test("oferta precisa de um preço 'de' maior que o preço", () => {
    expect(erros("pizzaria", { ...VALIDO, oferta: true, precoOriginal: 40 })).toEqual({
      precoOriginal: "O preço “de” precisa ser maior que o preço.",
    })
  })

  test('oferta sem preço "de" também avisa', () => {
    expect(erros("pizzaria", { ...VALIDO, oferta: true })).toEqual({
      precoOriginal: "O preço “de” precisa ser maior que o preço.",
    })
  })

  test("no grupo, mínimo e grátis não passam do máximo, e há pelo menos uma opção", () => {
    const grupo = { ...VALIDO.grupos[0], minimo: 3, maximo: 2, gratisAte: 5, itens: [] }
    expect(erros("pizzaria", { ...VALIDO, grupos: [grupo] })).toEqual({
      "grupos.0.minimo": "O mínimo não pode passar do máximo.",
      "grupos.0.gratisAte": "Os grátis não podem passar do máximo.",
      "grupos.0.itens": "Inclua pelo menos uma opção.",
    })
  })

  test("no salão, a duração é obrigatória e os grupos não entram", () => {
    const servico = { ...VALIDO, duracaoMin: undefined }
    expect(erros("salao", servico)).toEqual({ duracaoMin: "Informe a duração em minutos." })
    const resultado = esquemaProduto("salao").parse({ ...servico, duracaoMin: 60 })
    expect(resultado).not.toHaveProperty("grupos")
  })

  test("opção sem preço sai como grátis", () => {
    const semPreco = {
      ...VALIDO,
      grupos: [{ ...VALIDO.grupos[0], itens: [{ id: "opc-1", nome: "Sem borda", ativo: true }] }],
    }
    const resultado = esquemaProduto("pizzaria").parse(semPreco) as typeof VALIDO
    expect(resultado.grupos[0].itens[0].precoAdicional).toBe(0)
  })

  test("no açougue, escolhe unidade ou quilo", () => {
    expect(esquemaProduto("acougue").parse({ ...VALIDO, unidade: "kg" }).unidade).toBe("kg")
  })
})

describe("esquemaProduto: vídeo do salão", () => {
  test("só link do YouTube, Shorts ou Reels", () => {
    const servico = { ...VALIDO, grupos: undefined, duracaoMin: 60 }
    expect(erros("salao", { ...servico, videoUrl: "https://youtu.be/abc123" })).toEqual({})
    expect(erros("salao", { ...servico, videoUrl: "https://exemplo.com/video.mp4" })).toEqual({
      videoUrl: "Use um link do YouTube, Shorts ou Reels.",
    })
  })
})
