import { describe, expect, test } from "vitest"
import { catalogoDeTeste } from "../dados/catalogo-de-teste"
import { esquemaLoja } from "./esquema-loja"

const VALIDA = { ...catalogoDeTeste().loja, pagamentoOnlineConectado: true }

/** Mensagens de erro por campo, como o formulário mostra. */
function erros(valores: unknown) {
  const resultado = esquemaLoja.safeParse(valores)
  if (resultado.success) return {}
  return Object.fromEntries(
    resultado.error.issues.map((erro) => [erro.path.join("."), erro.message]),
  )
}

describe("esquemaLoja", () => {
  test("a configuração da loja de teste é válida, com os textos limpos", () => {
    const resultado = esquemaLoja.parse({
      ...VALIDA,
      nome: "  Teste  ",
      cidadesAtendidas: [" Lorena "],
    })
    expect(resultado.nome).toBe("Teste")
    expect(resultado.cidadesAtendidas).toEqual(["Lorena"])
  })

  test("fila: aceita a sirene e o limite do aceite fica entre 1 e 30 minutos", () => {
    expect(erros({ ...VALIDA, som: "sirene", limiteAceiteMin: 1 })).toEqual({})
    expect(erros({ ...VALIDA, limiteAceiteMin: 0 })).toEqual({
      limiteAceiteMin: "Entre 1 e 30 minutos.",
    })
    expect(erros({ ...VALIDA, limiteAceiteMin: 31 })).toEqual({
      limiteAceiteMin: "Entre 1 e 30 minutos.",
    })
    expect(erros({ ...VALIDA, limiteAceiteMin: 2.5 })).toEqual({
      limiteAceiteMin: "Entre 1 e 30 minutos.",
    })
    // Campo vazio: o número não existe.
    expect(erros({ ...VALIDA, limiteAceiteMin: Number.NaN })).toEqual({
      limiteAceiteMin: "Entre 1 e 30 minutos.",
    })
  })

  test("dados da loja: nome, telefones com DDD", () => {
    expect(erros({ ...VALIDA, nome: " ", telefone: "1234", whatsapp: "99" })).toEqual({
      nome: "Informe o nome da loja.",
      telefone: "Telefone com DDD, só números.",
      whatsapp: "WhatsApp com DDD, só números.",
    })
  })

  test("horário: formato e abre diferente de fecha no dia aberto", () => {
    const horarios = VALIDA.horarios.map((dia) =>
      dia.dia === 1 ? { ...dia, abre: "25:00" } : dia.dia === 2 ? { ...dia, fecha: dia.abre } : dia,
    )
    expect(erros({ ...VALIDA, horarios })).toEqual({
      "horarios.1.abre": "Use o formato 18:00.",
      "horarios.2.fecha": "O fechamento precisa ser diferente da abertura.",
    })
    // Dia fechado não precisa de horário válido.
    const fechado = VALIDA.horarios.map((dia) =>
      dia.dia === 2 ? { ...dia, aberto: false, fecha: dia.abre } : dia,
    )
    expect(erros({ ...VALIDA, horarios: fechado })).toEqual({})
  })

  test("entrega e retirada: pelo menos uma, e valores no limite", () => {
    expect(
      erros({
        ...VALIDA,
        aceitaEntrega: false,
        aceitaRetirada: false,
        taxaEntregaPadrao: -1,
        pedidoMinimo: 10_000,
      }),
    ).toEqual({
      aceitaRetirada: "Aceite pelo menos entrega ou retirada.",
      taxaEntregaPadrao: "A taxa não pode ser negativa.",
      pedidoMinimo: "Até R$ 9.999,00.",
    })
  })

  test("pagamento: pelo menos uma forma; Pix e cartão online só com a conta conectada", () => {
    const nenhum = Object.fromEntries(Object.keys(VALIDA.pagamentos).map((forma) => [forma, false]))
    expect(erros({ ...VALIDA, pagamentos: nenhum })).toEqual({
      pagamentos: "Ligue pelo menos uma forma de pagamento.",
    })
    expect(erros({ ...VALIDA, pagamentoOnlineConectado: false })).toEqual({
      "pagamentos.pix": "Conecte a conta de pagamento online para usar o Pix.",
      "pagamentos.cartao-online": "Conecte a conta de pagamento online para usar o cartão online.",
    })
  })
})

describe("vídeo do banner (salão)", () => {
  test("taxas de pagamento: opcionais, em %, de 0 a 30", () => {
    const taxas = { pixOnline: 0.99, cartaoOnline: 4.98, maquininha: 2.39 }
    expect(esquemaLoja.parse({ ...VALIDA, taxasPagamento: taxas }).taxasPagamento).toEqual(taxas)
    expect(erros({ ...VALIDA, taxasPagamento: {} })).toEqual({})
    expect(erros({ ...VALIDA, taxasPagamento: { pixOnline: -1, maquininha: 31 } })).toEqual({
      "taxasPagamento.pixOnline": "A taxa não pode ser negativa.",
      "taxasPagamento.maquininha": "Até 30%.",
    })
  })

  test("aceita YouTube, Shorts e Reels; vazio é sem vídeo", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=abc123",
      "https://youtu.be/abc123",
      "https://www.youtube.com/shorts/abc123",
      "https://www.instagram.com/reel/abc123/",
      "",
    ]) {
      expect(erros({ ...VALIDA, videoBanner: link })).toEqual({})
    }
    expect(erros({ ...VALIDA, videoBanner: "https://vimeo.com/123" })).toEqual({
      videoBanner: "Use um link do YouTube, Shorts ou Reels.",
    })
  })
})
