import { beforeEach, describe, expect, test } from "vitest"
import { useUsuarioSalvo } from "./usuario-atual"

beforeEach(() => {
  localStorage.clear()
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
})

describe("useUsuarioSalvo", () => {
  test("o usuário salvo volta depois de recarregar", async () => {
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    expect(JSON.parse(localStorage.getItem("clickpedido-admin-usuario") ?? "null")).toMatchObject({
      state: { porSegmento: { pizzaria: "eq-marina" } },
    })

    // Recarregar: a memória volta ao começo e o navegador continua com o que foi salvo.
    const salvo = localStorage.getItem("clickpedido-admin-usuario") ?? ""
    useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-usuario", salvo)
    expect(useUsuarioSalvo.getState().porSegmento).toEqual({})
    await useUsuarioSalvo.persist.rehydrate()
    expect(useUsuarioSalvo.getState().porSegmento).toEqual({ pizzaria: "eq-marina" })
  })

  test("cada segmento tem o seu usuário", () => {
    const { entrar, sair } = useUsuarioSalvo.getState()
    entrar("pizzaria", "eq-marina")
    entrar("adega", "eq-joao")
    expect(useUsuarioSalvo.getState().porSegmento).toEqual({
      pizzaria: "eq-marina",
      adega: "eq-joao",
    })
    sair("pizzaria")
    expect(useUsuarioSalvo.getState().porSegmento).toEqual({ adega: "eq-joao" })
  })

  test("o que vem salvo errado é ignorado", async () => {
    localStorage.setItem(
      "clickpedido-admin-usuario",
      JSON.stringify({
        state: { porSegmento: { pizzaria: 7, marte: "eq-x", adega: "eq-joao" } },
        version: 1,
      }),
    )
    await useUsuarioSalvo.persist.rehydrate()
    expect(useUsuarioSalvo.getState().porSegmento).toEqual({ adega: "eq-joao" })
  })
})
