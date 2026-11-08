import { describe, expect, test, vi } from "vitest"
import {
  acharBairro,
  buscarCep,
  type DadosCheckout,
  dadosDoPedido,
  dadosParaLembrar,
  esquemaCheckout,
  montarEndereco,
  somenteDigitos,
  sugestoesDeTroco,
  taxaDaEntrega,
  taxaDoBairro,
  valoresIniciais,
} from "./checkout"

// Os bairros e taxas vêm do cliente atual (mock da Casa da Pizza).

const CPF_VALIDO = "529.982.247-25"

function pedido(mudancas: Partial<DadosCheckout> = {}): DadosCheckout {
  return {
    nome: "Ana",
    whatsapp: "(12) 99876-5432",
    tipo: "entrega",
    cep: "12245-000",
    rua: "Rua das Flores",
    numero: "120",
    complemento: "",
    bairro: "Jardim Aquarius",
    cidade: "São José dos Campos",
    uf: "SP",
    referencia: "",
    pagamento: "pix",
    cpf: CPF_VALIDO,
    troco: null,
    observacao: "",
    total: 50,
    ...mudancas,
  }
}

/** Erros do esquema como { campo: mensagem }. */
function errosDe(dados: DadosCheckout): Record<string, string> {
  const resultado = esquemaCheckout.safeParse(dados)
  if (resultado.success) return {}
  return Object.fromEntries(
    resultado.error.issues.map((erro) => [erro.path.join("."), erro.message]),
  )
}

describe("esquemaCheckout", () => {
  test("aceita um pedido de entrega completo pago no Pix", () => {
    expect(esquemaCheckout.safeParse(pedido()).success).toBe(true)
  })

  describe("dados da pessoa", () => {
    test("pede nome com pelo menos 2 letras, sem contar espaços nas pontas", () => {
      expect(errosDe(pedido({ nome: " a " }))).toEqual({ nome: "Diga como podemos te chamar" })
      expect(errosDe(pedido({ nome: " Al " }))).toEqual({})
    })

    test("pede WhatsApp com DDD: exatamente 11 dígitos, ignorando a máscara", () => {
      expect(errosDe(pedido({ whatsapp: "(12) 9876-5432" }))).toEqual({
        whatsapp: "Confira o número com DDD",
      })
      expect(errosDe(pedido({ whatsapp: "12998765432" }))).toEqual({})
      expect(errosDe(pedido({ whatsapp: "+55 12 99876-5432" }))).toEqual({
        whatsapp: "Confira o número com DDD",
      })
    })
  })

  describe("endereço", () => {
    test("na entrega, confere CEP, rua, número e bairro", () => {
      expect(errosDe(pedido({ cep: "12245-00", rua: "  ", numero: "", bairro: "Moema" }))).toEqual({
        cep: "Digite os 8 números do CEP",
        rua: "Informe a rua",
        numero: "Informe o número",
        bairro: "Escolha um bairro da lista",
      })
    })

    test("o bairro precisa ser escrito igual ao da lista, com acento", () => {
      expect(errosDe(pedido({ bairro: "Jardim Satelite" }))).toEqual({
        bairro: "Escolha um bairro da lista",
      })
      expect(errosDe(pedido({ bairro: "Jardim Satélite" }))).toEqual({})
    })

    test("na retirada, não pede endereço", () => {
      expect(
        errosDe(pedido({ tipo: "retirada", cep: "", rua: "", numero: "", bairro: "" })),
      ).toEqual({})
    })
  })

  describe("pagamento", () => {
    test("no Pix, exige CPF válido", () => {
      expect(errosDe(pedido({ cpf: "111.111.111-11" }))).toEqual({ cpf: "Confira o CPF" })
      expect(errosDe(pedido({ cpf: "" }))).toEqual({ cpf: "Confira o CPF" })
    })

    test("fora do Pix, não confere o CPF", () => {
      expect(errosDe(pedido({ pagamento: "cartao-online", cpf: "" }))).toEqual({})
      expect(errosDe(pedido({ pagamento: "maquininha", cpf: "" }))).toEqual({})
    })

    test("no dinheiro, o troco precisa cobrir o total", () => {
      expect(errosDe(pedido({ pagamento: "dinheiro", cpf: "", troco: 20, total: 30 }))).toEqual({
        troco: "O troco precisa ser para R$ 30,00 ou mais",
      })
    })

    test("no dinheiro, troco igual ao total é aceito", () => {
      expect(errosDe(pedido({ pagamento: "dinheiro", cpf: "", troco: 30, total: 30 }))).toEqual({})
    })

    test("no dinheiro, sem troco é aceito", () => {
      expect(errosDe(pedido({ pagamento: "dinheiro", cpf: "", troco: null }))).toEqual({})
    })

    test("fora do dinheiro, o troco é ignorado", () => {
      expect(errosDe(pedido({ troco: 5, total: 30 }))).toEqual({})
    })
  })

  test("aceita observação de até 300 caracteres", () => {
    expect(errosDe(pedido({ observacao: "a".repeat(300) }))).toEqual({})
    expect(errosDe(pedido({ observacao: "a".repeat(301) }))).toEqual({
      observacao: "A observação ficou longa demais",
    })
  })

  test("aponta todos os erros de uma vez", () => {
    expect(
      Object.keys(errosDe(pedido({ nome: "", whatsapp: "", cep: "", cpf: "" }))).sort(),
    ).toEqual(["cep", "cpf", "nome", "whatsapp"])
  })
})

describe("somenteDigitos", () => {
  test("tira tudo o que não é número", () => {
    expect(somenteDigitos("(12) 99876-5432")).toBe("12998765432")
    expect(somenteDigitos("sem números")).toBe("")
  })
})

describe("acharBairro", () => {
  test("acha o bairro sem ligar para acento, maiúscula ou espaço nas pontas", () => {
    expect(acharBairro("jardim satelite")).toEqual({ nome: "Jardim Satélite", taxa: 9 })
    expect(acharBairro("  CENTRO ")).toEqual({ nome: "Centro", taxa: 6 })
  })

  test("devolve undefined para bairro não atendido", () => {
    expect(acharBairro("Moema")).toBeUndefined()
  })
})

describe("taxaDoBairro", () => {
  test("devolve a taxa do bairro atendido", () => {
    expect(taxaDoBairro("Jardim Aquarius")).toBe(8)
    expect(taxaDoBairro("Urbanova")).toBe(12)
  })

  test("só reconhece o nome exato da lista", () => {
    expect(taxaDoBairro("jardim aquarius")).toBeNull()
    expect(taxaDoBairro("Moema")).toBeNull()
  })
})

describe("sugestoesDeTroco", () => {
  test("sugere as 3 próximas notas acima do total", () => {
    expect(sugestoesDeTroco(73)).toEqual([100, 150, 200])
    expect(sugestoesDeTroco(15)).toEqual([20, 50, 100])
  })

  test("nota igual ao total não entra", () => {
    expect(sugestoesDeTroco(20)).toEqual([50, 100, 150])
  })

  test("sugere menos notas quando o total é alto", () => {
    expect(sugestoesDeTroco(199)).toEqual([200])
    expect(sugestoesDeTroco(200)).toEqual([])
  })
})

describe("buscarCep", () => {
  function responder(corpo: unknown, ok = true) {
    const fetch = vi.fn().mockResolvedValue({ ok, json: async () => corpo })
    vi.stubGlobal("fetch", fetch)
    return fetch
  }

  test("consulta o ViaCEP só com os dígitos e devolve o endereço", async () => {
    const fetch = responder({
      logradouro: "Avenida Cassiano Ricardo",
      bairro: "Jardim Aquarius",
      localidade: "São José dos Campos",
      uf: "SP",
    })

    await expect(buscarCep("12246-870")).resolves.toEqual({
      rua: "Avenida Cassiano Ricardo",
      bairro: "Jardim Aquarius",
      cidade: "São José dos Campos",
      uf: "SP",
    })
    expect(fetch).toHaveBeenCalledWith("https://viacep.com.br/ws/12246870/json/", {
      signal: undefined,
    })
  })

  test("repassa o sinal para poder cancelar a busca", async () => {
    const fetch = responder({})
    const sinal = new AbortController().signal

    await buscarCep("12246870", sinal)

    expect(fetch).toHaveBeenCalledWith(expect.any(String), { signal: sinal })
  })

  test("preenche com texto vazio o que o ViaCEP não mandou", async () => {
    responder({ localidade: "São José dos Campos", uf: "SP" })

    await expect(buscarCep("12200000")).resolves.toEqual({
      rua: "",
      bairro: "",
      cidade: "São José dos Campos",
      uf: "SP",
    })
  })

  test("devolve null quando o CEP não existe", async () => {
    responder({ erro: true })
    await expect(buscarCep("00000000")).resolves.toBeNull()
  })

  test("devolve null quando o serviço responde com erro", async () => {
    responder({}, false)
    await expect(buscarCep("12246870")).resolves.toBeNull()
  })
})

describe("valoresIniciais", () => {
  test("sem dados lembrados, começa em branco na entrega com Pix", () => {
    expect(valoresIniciais(null)).toEqual({
      nome: "",
      whatsapp: "",
      tipo: "entrega",
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      referencia: "",
      pagamento: "pix",
      cpf: "",
      troco: null,
      observacao: "",
      total: 0,
    })
  })

  test("reaproveita os dados lembrados, mas CPF, troco, observação e total começam do zero", () => {
    const { cpf, troco, observacao, total, ...lembrados } = pedido({
      tipo: "retirada",
      pagamento: "dinheiro",
    })

    expect(valoresIniciais(lembrados)).toEqual({
      ...lembrados,
      cpf: "",
      troco: null,
      observacao: "",
      total: 0,
    })
  })
})

describe("montarEndereco", () => {
  test("junta rua, número e bairro", () => {
    expect(montarEndereco(pedido({ cidade: "", uf: "" }))).toBe(
      "Rua das Flores, 120 · Jardim Aquarius",
    )
  })

  test("inclui complemento, cidade com UF em maiúscula e referência, sem espaços sobrando", () => {
    expect(
      montarEndereco(
        pedido({
          rua: " Rua das Flores ",
          numero: " 120 ",
          complemento: " apto 12 ",
          cidade: " São José dos Campos ",
          uf: "sp",
          referencia: " portão azul ",
        }),
      ),
    ).toBe("Rua das Flores, 120, apto 12 · Jardim Aquarius · São José dos Campos/SP (portão azul)")
  })
})

describe("taxaDaEntrega", () => {
  test("na retirada, não há taxa", () => {
    expect(taxaDaEntrega("retirada", "")).toBe(0)
  })

  test("na entrega, é a taxa do bairro", () => {
    expect(taxaDaEntrega("entrega", "Jardim Aquarius")).toBe(8)
  })

  test("na entrega sem bairro atendido, a taxa ainda não existe", () => {
    expect(taxaDaEntrega("entrega", "")).toBeNull()
  })
})

describe("dadosDoPedido", () => {
  test("na entrega, leva a taxa, o endereço montado e os textos sem espaço nas pontas", () => {
    expect(dadosDoPedido(pedido({ nome: " Ana ", observacao: " sem cebola " }), 8)).toEqual({
      taxaEntrega: 8,
      cliente: { nome: "Ana", whatsapp: "(12) 99876-5432" },
      tipo: "entrega",
      endereco: "Rua das Flores, 120 · Jardim Aquarius · São José dos Campos/SP",
      pagamento: "pix",
      troco: null,
      observacao: "sem cebola",
    })
  })

  test("na retirada, o endereço é o da loja", () => {
    expect(dadosDoPedido(pedido({ tipo: "retirada" }), 0).endereco).toBe(
      "Av. da Tradição Italiana, 120, Centro",
    )
  })

  test("sem taxa conhecida, a taxa vai como zero", () => {
    expect(dadosDoPedido(pedido(), null).taxaEntrega).toBe(0)
  })

  test("o troco só vai no pagamento em dinheiro", () => {
    expect(dadosDoPedido(pedido({ pagamento: "dinheiro", troco: 100 }), 8).troco).toBe(100)
    expect(dadosDoPedido(pedido({ pagamento: "pix", troco: 100 }), 8).troco).toBeNull()
  })
})

describe("dadosParaLembrar", () => {
  test("guarda contato, endereço e pagamento, sem CPF, troco, observação e total", () => {
    expect(dadosParaLembrar(pedido({ nome: " Ana " }))).toEqual({
      nome: "Ana",
      whatsapp: "(12) 99876-5432",
      tipo: "entrega",
      cep: "12245-000",
      rua: "Rua das Flores",
      numero: "120",
      complemento: "",
      bairro: "Jardim Aquarius",
      cidade: "São José dos Campos",
      uf: "SP",
      referencia: "",
      pagamento: "pix",
    })
  })
})
