import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  aplicarPlano,
  CONFIG_PADRAO,
  type Config,
  ehPro,
  itensDaSacola,
  nomeDoBloco,
  opcaoEmUso,
  reverterOpcao,
  useConfig,
  useMudancasPendentes,
  useOpcaoPro,
} from "./config"

// As cores da marca vêm do cliente atual (mock da Casa da Pizza).
const CORES_DA_MARCA = {
  primaria: "#0B4F9C",
  acento: "#C8321F",
  fundo: "#F5F6F8",
  tinta: "#14202E",
}

/** Config padrão com algumas seções trocadas. */
function com(mudancas: { [S in keyof Config]?: Partial<Config[S]> }): Config {
  const config = structuredClone(CONFIG_PADRAO)
  for (const [secao, parcial] of Object.entries(mudancas)) {
    Object.assign(config[secao as keyof Config], parcial)
  }
  return config
}

function comBloco(id: string, ativo: boolean): Config {
  const config = structuredClone(CONFIG_PADRAO)
  config.inicio.blocos = config.inicio.blocos.map((bloco) =>
    bloco.id === id ? { ...bloco, ativo } : bloco,
  )
  return config
}

const blocoAtivo = (config: Config, id: string) =>
  config.inicio.blocos.find((bloco) => bloco.id === id)?.ativo

const estado = () => useConfig.getState()

beforeEach(() => {
  useConfig.setState(useConfig.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ehPro", () => {
  test("reconhece as opções do catálogo Pro", () => {
    expect(ehPro("cores.botao:brilho")).toBe(true)
    expect(ehPro("produto.sugestoes")).toBe(true)
  })

  test("opções gratuitas não são Pro", () => {
    expect(ehPro("cores.botao:solido")).toBe(false)
    expect(ehPro("recursos.busca")).toBe(false)
  })
})

describe("nomeDoBloco", () => {
  test("blocos fixos usam o rótulo próprio", () => {
    expect(nomeDoBloco("mais-pedidas")).toBe("Mais pedidas")
    expect(nomeDoBloco("avaliacoes")).toBe("Avaliações dos clientes")
  })

  test("blocos de categoria usam o nome da categoria do cardápio", () => {
    expect(nomeDoBloco("categoria:tradicionais")).toBe("Tradicionais")
  })

  test("categoria que não existe vira só Categoria", () => {
    expect(nomeDoBloco("categoria:sumiu")).toBe("Categoria")
  })
})

describe("opcaoEmUso", () => {
  test("liga/desliga conta como em uso quando está ligado", () => {
    expect(opcaoEmUso(CONFIG_PADRAO, "produto.sugestoes")).toBe(false)
    expect(opcaoEmUso(com({ produto: { sugestoes: true } }), "produto.sugestoes")).toBe(true)
  })

  test("imagem conta como em uso quando foi enviada", () => {
    expect(opcaoEmUso(CONFIG_PADRAO, "identidade.fundo")).toBe(false)
    expect(
      opcaoEmUso(com({ identidade: { fundo: "data:image/png;base64,AAA" } }), "identidade.fundo"),
    ).toBe(true)
  })

  test("escolha conta como em uso só com aquele valor", () => {
    expect(opcaoEmUso(CONFIG_PADRAO, "cores.botao:brilho")).toBe(false)
    expect(opcaoEmUso(com({ cores: { botao: "brilho" } }), "cores.botao:brilho")).toBe(true)
    expect(opcaoEmUso(com({ cores: { botao: "brilho" } }), "cores.botao:degrade")).toBe(false)
  })

  test("bloco da página inicial conta como em uso quando está ativo", () => {
    expect(opcaoEmUso(CONFIG_PADRAO, "inicio.bloco:promocional")).toBe(false)
    expect(opcaoEmUso(comBloco("promocional", true), "inicio.bloco:promocional")).toBe(true)
  })
})

describe("reverterOpcao", () => {
  test("opção fora de uso devolve a mesma config", () => {
    const config = com({ cores: { cantos: 4 } })
    expect(reverterOpcao(config, "cores.botao:brilho")).toBe(config)
  })

  test("escolha volta ao valor padrão e o resto fica como estava", () => {
    const config = com({ cores: { botao: "brilho", cantos: 4 } })
    const revertida = reverterOpcao(config, "cores.botao:brilho")

    expect(revertida.cores.botao).toBe("solido")
    expect(revertida.cores.cantos).toBe(4)
  })

  test("não altera a config recebida", () => {
    const config = com({ cores: { botao: "brilho" } })
    reverterOpcao(config, "cores.botao:brilho")

    expect(config.cores.botao).toBe("brilho")
  })

  test("liga/desliga volta a desligado", () => {
    const config = com({ produto: { sugestoes: true } })
    expect(reverterOpcao(config, "produto.sugestoes").produto.sugestoes).toBe(false)
  })

  test("paleta paga volta à da marca junto com as quatro cores", () => {
    const config = com({
      cores: {
        paleta: "noite",
        primaria: "#111111",
        acento: "#222222",
        fundo: "#333333",
        tinta: "#444444",
        cantos: 4,
      },
    })
    const revertida = reverterOpcao(config, "cores.paleta:noite")

    expect(revertida.cores).toMatchObject({ paleta: "marca", ...CORES_DA_MARCA, cantos: 4 })
  })

  test("bloco volta a desativado, mantendo a forma de exibição", () => {
    const revertida = reverterOpcao(comBloco("promocional", true), "inicio.bloco:promocional")
    const bloco = revertida.inicio.blocos.find(({ id }) => id === "promocional")

    expect(bloco).toEqual({ id: "promocional", ativo: false, exibicao: "padrao" })
  })
})

describe("aplicarPlano", () => {
  const escolhida = () => {
    const config = com({
      identidade: { nome: "Pizzaria Nova", fundo: "data:image/png;base64,AAA" },
      cores: { botao: "brilho", cantos: 4 },
      produto: { sugestoes: true },
    })
    config.inicio.blocos = comBloco("avaliacoes", true).inicio.blocos
    return config
  }

  test("sem nada liberado, toda opção Pro volta ao padrão e o resto vai para o site", () => {
    const site = aplicarPlano(escolhida(), () => false)

    expect(site.identidade).toMatchObject({ nome: "Pizzaria Nova", fundo: null })
    expect(site.cores).toMatchObject({ botao: "solido", cantos: 4 })
    expect(site.produto.sugestoes).toBe(false)
    expect(blocoAtivo(site, "avaliacoes")).toBe(false)
  })

  test("o que foi liberado vai para o site como está", () => {
    const site = aplicarPlano(escolhida(), (chave) => chave === "cores.botao:brilho")

    expect(site.cores.botao).toBe("brilho")
    expect(site.produto.sugestoes).toBe(false)
  })
})

describe("itensDaSacola", () => {
  const config = com({ cores: { botao: "brilho" }, produto: { sugestoes: true } })

  test("lista as opções Pro em uso, com nome e preço do catálogo", () => {
    expect(itensDaSacola(config, false, [])).toEqual([
      { chave: "cores.botao:brilho", nome: "Botão com brilho", preco: 6.9 },
      { chave: "produto.sugestoes", nome: "Peça também, no produto", preco: 19.9 },
    ])
  })

  test("deixa de fora o que já foi contratado", () => {
    expect(itensDaSacola(config, false, ["cores.botao:brilho"])).toEqual([
      { chave: "produto.sugestoes", nome: "Peça também, no produto", preco: 19.9 },
    ])
  })

  test("com o Pro completo, a sacola fica vazia", () => {
    expect(itensDaSacola(config, true, [])).toEqual([])
  })

  test("a config padrão não tem nada para contratar", () => {
    expect(itensDaSacola(CONFIG_PADRAO, false, [])).toEqual([])
  })
})

describe("useConfig", () => {
  test("atualizar troca só os campos informados da seção", () => {
    estado().atualizar("cores", { cantos: 4 })

    expect(estado().config.cores).toMatchObject({ cantos: 4, botao: "solido", paleta: "marca" })
    expect(estado().config.tipografia).toEqual(CONFIG_PADRAO.tipografia)
  })

  test("restaurarSecao volta só aquela seção ao padrão", () => {
    estado().atualizar("cores", { cantos: 4 })
    estado().atualizar("tipografia", { escala: 120 })
    estado().restaurarSecao("cores")

    expect(estado().config.cores.cantos).toBe(12)
    expect(estado().config.tipografia.escala).toBe(120)
  })

  test("restaurarTudo volta todas as seções ao padrão", () => {
    estado().atualizar("cores", { cantos: 4 })
    estado().atualizar("tipografia", { escala: 120 })
    estado().restaurarTudo()

    expect(estado().config).toEqual(CONFIG_PADRAO)
  })

  test("a sacola só fica marcada para aplicar quando abre com esse motivo", () => {
    estado().abrirSacola(true, true)
    expect(estado()).toMatchObject({ sacolaAberta: true, sacolaParaAplicar: true })

    estado().abrirSacola(true)
    expect(estado()).toMatchObject({ sacolaAberta: true, sacolaParaAplicar: false })

    estado().abrirSacola(false, true)
    expect(estado()).toMatchObject({ sacolaAberta: false, sacolaParaAplicar: false })
  })

  test("tirar da sacola volta a opção ao padrão", () => {
    estado().atualizar("cores", { botao: "brilho" })
    estado().removerDaSacola("cores.botao:brilho")

    expect(estado().config.cores.botao).toBe("solido")
  })

  test("contratar avulso soma às compras sem repetir", () => {
    estado().contratar(["cores.botao:brilho"])
    estado().contratar(["cores.botao:brilho", "produto.sugestoes"])

    expect(estado().compradas).toEqual(["cores.botao:brilho", "produto.sugestoes"])
    expect(estado().pro).toBe(false)
  })

  test("contratar tudo libera o Pro sem mexer nas compras avulsas", () => {
    estado().contratar(["cores.botao:brilho"])
    estado().contratar("tudo")

    expect(estado().pro).toBe(true)
    expect(estado().compradas).toEqual(["cores.botao:brilho"])
  })

  describe("aplicar no site", () => {
    const AGORA = new Date("2026-11-08T21:00:00.000-03:00")

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(AGORA)
      estado().atualizar("cores", { botao: "brilho", cantos: 4 })
    })

    test("publica a config sem as opções Pro não contratadas e guarda o horário", () => {
      estado().aplicarNoSite()

      expect(estado().publicada.cores).toMatchObject({ botao: "solido", cantos: 4 })
      expect(estado().publicadaEm).toBe("2026-11-09T00:00:00.000Z")
      expect(estado().config.cores.botao).toBe("brilho")
    })

    test("publica as opções contratadas avulsas", () => {
      estado().contratar(["cores.botao:brilho"])
      estado().aplicarNoSite()

      expect(estado().publicada.cores.botao).toBe("brilho")
    })

    test("com o Pro completo, publica tudo", () => {
      estado().contratar("tudo")
      estado().aplicarNoSite()

      expect(estado().publicada.cores.botao).toBe("brilho")
    })

    test("descartar volta a config ao que está no site", () => {
      estado().aplicarNoSite()
      estado().atualizar("cores", { cantos: 20 })
      estado().descartar()

      expect(estado().config.cores).toMatchObject({ botao: "solido", cantos: 4 })
    })

    test("voltar ao original zera a config e o site, e guarda o horário", () => {
      estado().aplicarNoSite()
      estado().voltarAoOriginal()

      expect(estado().config).toEqual(CONFIG_PADRAO)
      expect(estado().publicada).toEqual(CONFIG_PADRAO)
      expect(estado().publicadaEm).toBe("2026-11-09T00:00:00.000Z")
    })
  })

  describe("persistência", () => {
    test("salva config, plano, compras e o que está no site, sem o estado da tela", () => {
      estado().atualizar("cores", { cantos: 4 })

      const salvo = JSON.parse(localStorage.getItem("clickpedido-admin") ?? "null")
      expect(salvo.version).toBe(1)
      expect(Object.keys(salvo.state).sort()).toEqual([
        "compradas",
        "config",
        "pro",
        "publicada",
        "publicadaEm",
      ])
    })

    test("ao carregar, completa com o padrão o que faltava no que foi salvo", async () => {
      localStorage.setItem(
        "clickpedido-admin",
        JSON.stringify({
          state: { config: { cores: { botao: "brilho" } }, pro: true },
          version: 1,
        }),
      )

      await useConfig.persist.rehydrate()

      expect(estado().config.cores).toEqual({ ...CONFIG_PADRAO.cores, botao: "brilho" })
      expect(estado().config.tipografia).toEqual(CONFIG_PADRAO.tipografia)
      expect(estado()).toMatchObject({
        pro: true,
        compradas: [],
        publicada: CONFIG_PADRAO,
        publicadaEm: null,
        hidratada: true,
      })
    })

    test("ao carregar, grades salvas com mais de 4 colunas ficam com 4", async () => {
      localStorage.setItem(
        "clickpedido-admin",
        JSON.stringify({
          state: { config: { cards: { colunasCelular: 6, colunasComputador: 5 } } },
          version: 1,
        }),
      )

      await useConfig.persist.rehydrate()

      expect(estado().config.cards).toMatchObject({ colunasCelular: 4, colunasComputador: 4 })
    })
  })
})

describe("useOpcaoPro", () => {
  test("opção gratuita nunca fica bloqueada", () => {
    const { result } = renderHook(() => useOpcaoPro("cores.botao:solido"))

    expect(result.current).toEqual({
      ehPro: false,
      bloqueada: false,
      naSacola: false,
      liberada: false,
    })
  })

  test("opção Pro sem contratar fica bloqueada e, quando escolhida, vai para a sacola", () => {
    const { result } = renderHook(() => useOpcaoPro("cores.botao:brilho"))
    expect(result.current).toMatchObject({ bloqueada: true, naSacola: false })

    act(() => estado().atualizar("cores", { botao: "brilho" }))

    expect(result.current).toMatchObject({ bloqueada: true, naSacola: true, liberada: false })
  })

  test("opção Pro contratada fica liberada e sai da sacola", () => {
    act(() => {
      estado().atualizar("cores", { botao: "brilho" })
      estado().contratar(["cores.botao:brilho"])
    })
    const { result } = renderHook(() => useOpcaoPro("cores.botao:brilho"))

    expect(result.current).toMatchObject({ bloqueada: false, naSacola: false, liberada: true })
  })
})

describe("useMudancasPendentes", () => {
  test("avisa quando a config difere do que está no site, até aplicar", () => {
    const { result } = renderHook(() => useMudancasPendentes())
    expect(result.current).toBe(false)

    act(() => estado().atualizar("cores", { cantos: 4 }))
    expect(result.current).toBe(true)

    act(() => estado().aplicarNoSite())
    expect(result.current).toBe(false)
  })
})

describe("recursos Pro da cozinha", () => {
  test("estão no catálogo com nome e preço, e não são campos da aparência: nunca entram na sacola sozinhos", () => {
    for (const chave of [
      "cozinha.pracas",
      "cozinha.tv",
      "cozinha.chamada",
      "cozinha.desempenho",
      "cozinha.tempoPreparo",
      "cozinha.via",
    ]) {
      expect(ehPro(chave)).toBe(true)
      expect(opcaoEmUso(CONFIG_PADRAO, chave)).toBe(false)
      expect(reverterOpcao(CONFIG_PADRAO, chave)).toBe(CONFIG_PADRAO)
    }
    expect(itensDaSacola(CONFIG_PADRAO, false, [])).toEqual([])
  })
})
