import { describe, expect, test } from "vitest"
import type { MembroEquipe } from "@/lib/admin/dados/tipos"
import {
  errosDoMembro,
  errosDoPin,
  membroPadrao,
  podeAutorizar,
  podeVerAparencia,
  podeVerModulo,
  podeVerSecaoLoja,
  precisaAutorizacao,
  TITULO_PERFIL,
} from "./equipe"

const carla: MembroEquipe = {
  id: "eq-dono",
  nome: "Carla N.",
  perfil: "dono",
  pin: "1234",
  ativo: true,
}
const rafael: MembroEquipe = {
  id: "eq-gerente",
  nome: "Rafael M.",
  perfil: "gerente",
  pin: "2580",
  ativo: true,
}
const marina: MembroEquipe = {
  id: "eq-marina",
  nome: "Marina S.",
  perfil: "caixa",
  pin: "1111",
  ativo: true,
}
const equipe = [carla, rafael, marina]

describe("o que cada perfil vê", () => {
  test("o caixa só vê PDV, pedidos e fila", () => {
    for (const modulo of ["pdv", "pedidos", "fila"] as const) {
      expect(podeVerModulo("caixa", modulo)).toBe(true)
    }
    for (const modulo of ["visao-geral", "estoque", "loja", "equipe"] as const) {
      expect(podeVerModulo("caixa", modulo)).toBe(false)
    }
  })

  test("o gerente vê tudo menos a equipe", () => {
    expect(podeVerModulo("gerente", "loja")).toBe(true)
    expect(podeVerModulo("gerente", "estoque")).toBe(true)
    expect(podeVerModulo("gerente", "equipe")).toBe(false)
    expect(podeVerModulo("dono", "equipe")).toBe(true)
  })

  test("o gerente não vê pagamentos da loja; o dono vê", () => {
    expect(podeVerSecaoLoja("gerente", "pagamentos")).toBe(false)
    expect(podeVerSecaoLoja("gerente", "pagamento-online")).toBe(false)
    expect(podeVerSecaoLoja("dono", "pagamento-online")).toBe(true)
    expect(podeVerSecaoLoja("dono", "pagamentos")).toBe(true)
  })

  test("só o caixa não vê a aparência", () => {
    expect(podeVerAparencia("caixa")).toBe(false)
    expect(podeVerAparencia("gerente")).toBe(true)
    expect(podeVerAparencia("dono")).toBe(true)
  })

  test("os perfis têm nome", () => {
    expect(TITULO_PERFIL).toEqual({ dono: "Dono", gerente: "Gerente", caixa: "Caixa" })
  })
})

describe("autorização", () => {
  test("só o caixa precisa de autorização", () => {
    expect(precisaAutorizacao("caixa", "sangria")).toBe(true)
    expect(precisaAutorizacao("caixa", "reabrir-caixa")).toBe(true)
    expect(precisaAutorizacao("gerente", "sangria")).toBe(false)
    expect(precisaAutorizacao("dono", "sangria")).toBe(false)
  })

  test("autoriza só gerente ou dono ativo", () => {
    expect(podeAutorizar(rafael)).toBe(true)
    expect(podeAutorizar(carla)).toBe(true)
    expect(podeAutorizar({ ...rafael, ativo: false })).toBe(false)
    expect(podeAutorizar(marina)).toBe(false)
  })
})

describe("cadastro", () => {
  test("PIN tem de 4 a 6 números", () => {
    for (const pin of ["123", "1234567", "12a4", ""]) {
      expect(errosDoPin(pin)).toBe("O PIN tem de 4 a 6 números.")
    }
    expect(errosDoPin("1234")).toBeUndefined()
    expect(errosDoPin("123456")).toBeUndefined()
  })

  test("não deixa o painel sem dono ativo", () => {
    expect(errosDoMembro({ ...carla, ativo: false }, equipe)).toBe(
      "O painel precisa de um Dono ativo.",
    )
    expect(errosDoMembro({ ...carla, perfil: "gerente" }, equipe)).toBe(
      "O painel precisa de um Dono ativo.",
    )
    const outroDono: MembroEquipe = { ...carla, id: "eq-dono-2", nome: "Pedro D." }
    expect(errosDoMembro({ ...carla, ativo: false }, [...equipe, outroDono])).toBeUndefined()
  })

  test("nome de 2 a 40 letras", () => {
    expect(errosDoMembro({ ...marina, nome: "A" }, equipe)).toBe("Diga o nome (2 a 40 letras).")
    expect(errosDoMembro({ ...marina, nome: "x".repeat(41) }, equipe)).toBe(
      "Diga o nome (2 a 40 letras).",
    )
    expect(
      errosDoMembro({ nome: "Bia L.", perfil: "caixa", pin: "3333", ativo: true }, equipe),
    ).toBeUndefined()
  })

  test("o PIN do membro também é conferido", () => {
    expect(errosDoMembro({ ...marina, pin: "12" }, equipe)).toBe("O PIN tem de 4 a 6 números.")
  })

  test("o padrão é o primeiro dono ativo", () => {
    const inativa: MembroEquipe = { ...carla, id: "eq-velha", nome: "Ana V.", ativo: false }
    expect(membroPadrao([marina, inativa, rafael, carla])?.id).toBe("eq-dono")
    expect(membroPadrao([marina])).toBeUndefined()
  })
})
