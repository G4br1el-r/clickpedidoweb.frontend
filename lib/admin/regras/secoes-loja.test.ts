import { describe, expect, test } from "vitest"
import { resumoDasAlteracoes, secoesAlteradas } from "./secoes-loja"

describe("secoesAlteradas", () => {
  test("nada alterado, nenhuma seção", () => {
    expect(secoesAlteradas({})).toEqual([])
  })

  test("cada campo cai na seção da tela, na ordem em que as seções aparecem", () => {
    expect(
      secoesAlteradas({
        som: true,
        horarios: [{ abre: true }],
        nome: true,
        slogan: true,
        cidadesAtendidas: [true],
      }),
    ).toEqual(["Loja", "Horários", "Entrega e retirada", "Alerta sonoro"])
  })

  test("campos aninhados marcados como falsos não contam", () => {
    expect(
      secoesAlteradas({
        horarios: [{ abre: false, fecha: false }],
        pagamentos: { pix: true },
        vitrines: { ofertas: { ativo: true } },
      }),
    ).toEqual(["Vitrines", "Formas de pagamento"])
  })

  test("impressão e o resto da loja", () => {
    expect(
      secoesAlteradas({ cortarPapel: true, videoBanner: true, mensagemFechada: true }),
    ).toEqual(["Loja", "Horários", "Impressão"])
  })
})

describe("secoesAlteradas: PDV", () => {
  test("o fundo e o alerta caem em PDV e caixa, depois do pagamento online", () => {
    expect(
      secoesAlteradas({ pdv: { alertaSangria: true }, pagamentoOnlineConectado: true, som: true }),
    ).toEqual(["Pagamento online", "PDV e caixa", "Alerta sonoro"])
  })
})

describe("resumoDasAlteracoes", () => {
  test("junta os nomes como na fala", () => {
    expect(resumoDasAlteracoes([])).toBe("")
    expect(resumoDasAlteracoes(["Loja"])).toBe("Em Loja")
    expect(resumoDasAlteracoes(["Loja", "Horários"])).toBe("Em Loja e Horários")
    expect(resumoDasAlteracoes(["Loja", "Horários", "Impressão"])).toBe(
      "Em Loja, Horários e Impressão",
    )
  })
})
