import type { StaticImageData } from "next/image"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  calcularSubtotal,
  contarItens,
  type DadosFinalizacao,
  type DadosLembrados,
  faltaParaMinimo,
  type ItemSacola,
  type Pedido,
  pedidosDoCelular,
  totalDoItem,
  useSacola,
} from "./sacola"

const IMAGEM = { src: "/pizza.jpg", width: 1, height: 1 } as StaticImageData

type NovoItem = Omit<ItemSacola, "chave">

function item(mudancas: Partial<NovoItem> = {}): NovoItem {
  return {
    produtoId: "calabresa",
    nome: "Pizza Calabresa",
    imagem: IMAGEM,
    precoUnitario: 40,
    quantidade: 1,
    resumo: [],
    ...mudancas,
  }
}

function dados(mudancas: Partial<DadosFinalizacao> = {}): DadosFinalizacao {
  return {
    taxaEntrega: 8,
    cliente: { nome: "Ana", whatsapp: "(12) 99876-5432" },
    tipo: "entrega",
    endereco: "Rua das Flores, 120 - Jardim Aquarius",
    pagamento: "pix",
    troco: null,
    observacao: "",
    ...mudancas,
  }
}

const LEMBRAR = { nome: "Ana", whatsapp: "(12) 99876-5432" } as DadosLembrados

const sacola = () => useSacola.getState()

beforeEach(() => {
  useSacola.setState(useSacola.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("calcularSubtotal", () => {
  test("soma preço vezes quantidade de cada item", () => {
    const itens = [
      { ...item({ precoUnitario: 40, quantidade: 2 }), chave: "a" },
      { ...item({ precoUnitario: 8.5, quantidade: 1 }), chave: "b" },
    ]
    expect(calcularSubtotal(itens)).toBe(88.5)
  })

  test("sacola vazia custa zero", () => {
    expect(calcularSubtotal([])).toBe(0)
  })
})

describe("totalDoItem", () => {
  test("multiplica o preço da unidade pela quantidade", () => {
    // O dinheiro é guardado em ponto flutuante; o emReais arredonda só na hora de mostrar.
    expect(totalDoItem({ ...item({ precoUnitario: 39.9, quantidade: 3 }), chave: "a" })).toBe(
      119.69999999999999,
    )
    expect(totalDoItem({ ...item({ precoUnitario: 40, quantidade: 2 }), chave: "a" })).toBe(80)
  })
})

describe("faltaParaMinimo", () => {
  test("diz quanto falta para chegar ao pedido mínimo", () => {
    expect(faltaParaMinimo(22, 30)).toBe(8)
  })

  test("depois de passar do mínimo, não falta nada", () => {
    expect(faltaParaMinimo(30, 30)).toBe(0)
    expect(faltaParaMinimo(45, 30)).toBe(0)
  })
})

describe("contarItens", () => {
  test("soma as quantidades, não as linhas", () => {
    const itens = [
      { ...item({ quantidade: 2 }), chave: "a" },
      { ...item({ quantidade: 3 }), chave: "b" },
    ]
    expect(contarItens(itens)).toBe(5)
  })
})

describe("adicionar", () => {
  test("põe o item na sacola com uma chave feita do produto, das escolhas e da observação", () => {
    sacola().adicionar(item({ resumo: ["Borda catupiry"], observacao: "sem cebola" }))

    expect(sacola().itens).toHaveLength(1)
    expect(sacola().itens[0].chave).toBe("calabresa|Borda catupiry|sem cebola")
  })

  test("junta o mesmo produto com as mesmas escolhas, somando a quantidade", () => {
    sacola().adicionar(item({ resumo: ["Borda catupiry"], quantidade: 1 }))
    sacola().adicionar(item({ resumo: ["Borda catupiry"], quantidade: 2 }))

    expect(sacola().itens).toHaveLength(1)
    expect(sacola().itens[0].quantidade).toBe(3)
  })

  test("escolhas ou observação diferentes viram itens separados", () => {
    sacola().adicionar(item({ resumo: ["Borda catupiry"] }))
    sacola().adicionar(item({ resumo: ["Borda cheddar"] }))
    sacola().adicionar(item({ resumo: ["Borda catupiry"], observacao: "bem passada" }))

    expect(sacola().itens.map(({ chave }) => chave)).toEqual([
      "calabresa|Borda catupiry|",
      "calabresa|Borda cheddar|",
      "calabresa|Borda catupiry|bem passada",
    ])
  })
})

describe("alterarQuantidade", () => {
  test("troca a quantidade do item", () => {
    sacola().adicionar(item())
    sacola().alterarQuantidade("calabresa|", 4)

    expect(sacola().itens[0].quantidade).toBe(4)
  })

  // Remover é com `remover`, que a interface oferece com desfazer; aqui o mínimo é 1.
  test("quantidade zero é recusada e o item fica como estava", () => {
    sacola().adicionar(item({ quantidade: 2 }))
    sacola().alterarQuantidade("calabresa|", 0)

    expect(sacola().itens).toHaveLength(1)
    expect(sacola().itens[0].quantidade).toBe(2)
  })

  test("quantidade negativa é recusada e o subtotal não fica negativo", () => {
    sacola().adicionar(item({ precoUnitario: 40 }))
    sacola().alterarQuantidade("calabresa|", -1)

    expect(sacola().itens[0].quantidade).toBe(1)
    expect(calcularSubtotal(sacola().itens)).toBe(40)
  })

  test("chave desconhecida não muda nada", () => {
    sacola().adicionar(item())
    sacola().alterarQuantidade("outra", 5)

    expect(sacola().itens[0].quantidade).toBe(1)
  })
})

describe("remover e restaurar", () => {
  test("remove o item pela chave", () => {
    sacola().adicionar(item({ produtoId: "calabresa" }))
    sacola().adicionar(item({ produtoId: "mussarela" }))
    sacola().remover("calabresa|")

    expect(sacola().itens.map(({ produtoId }) => produtoId)).toEqual(["mussarela"])
  })

  test("restaurar devolve o item à posição em que estava", () => {
    sacola().adicionar(item({ produtoId: "calabresa" }))
    sacola().adicionar(item({ produtoId: "mussarela" }))
    sacola().adicionar(item({ produtoId: "portuguesa" }))
    const removido = sacola().itens[1]
    sacola().remover(removido.chave)
    sacola().restaurar(removido, 1)

    expect(sacola().itens.map(({ produtoId }) => produtoId)).toEqual([
      "calabresa",
      "mussarela",
      "portuguesa",
    ])
  })
})

describe("restaurarItens", () => {
  test("devolve os itens que saíram, na ordem em que estavam", () => {
    sacola().adicionar(item({ produtoId: "calabresa" }))
    sacola().adicionar(item({ produtoId: "mussarela" }))
    sacola().adicionar(item({ produtoId: "portuguesa" }))
    const antes = sacola().itens
    sacola().esvaziar()
    sacola().restaurarItens(antes)

    expect(sacola().itens.map(({ produtoId }) => produtoId)).toEqual([
      "calabresa",
      "mussarela",
      "portuguesa",
    ])
  })

  test("o que foi adicionado depois fica no fim, e o mesmo item soma as quantidades", () => {
    sacola().adicionar(item({ produtoId: "calabresa", quantidade: 2 }))
    sacola().adicionar(item({ produtoId: "mussarela" }))
    const antes = sacola().itens
    sacola().esvaziar()
    sacola().adicionar(item({ produtoId: "mussarela" }))
    sacola().adicionar(item({ produtoId: "portuguesa" }))
    sacola().restaurarItens(antes)

    expect(sacola().itens.map(({ produtoId, quantidade }) => [produtoId, quantidade])).toEqual([
      ["calabresa", 2],
      ["mussarela", 2],
      ["portuguesa", 1],
    ])
  })
})

describe("repetirPedido", () => {
  function pedidoComItens(): Pedido {
    return {
      numero: 2100,
      itens: [
        { ...item({ produtoId: "calabresa", quantidade: 2 }), chave: "calabresa|" },
        { ...item({ produtoId: "mussarela", nome: "Mussarela" }), chave: "mussarela|" },
      ],
      subtotal: 0,
      taxaEntrega: 0,
      total: 0,
    }
  }

  test("põe na sacola todos os itens de um pedido anterior e diz quantos", () => {
    useSacola.setState({ pedidos: [pedidoComItens()] })

    expect(sacola().repetirPedido(2100)).toBe(2)

    expect(sacola().itens.map(({ produtoId, quantidade }) => [produtoId, quantidade])).toEqual([
      ["calabresa", 2],
      ["mussarela", 1],
    ])
  })

  test("o que já está na sacola soma as quantidades, sem duplicar a linha", () => {
    useSacola.setState({ pedidos: [pedidoComItens()] })
    sacola().adicionar(item({ produtoId: "calabresa", quantidade: 1 }))

    sacola().repetirPedido(2100)

    expect(sacola().itens.map(({ produtoId, quantidade }) => [produtoId, quantidade])).toEqual([
      ["calabresa", 3],
      ["mussarela", 1],
    ])
  })

  test("acha o pedido também no último pedido, que vem de antes do histórico", () => {
    useSacola.setState({ pedidos: [], ultimoPedido: pedidoComItens() })

    expect(sacola().repetirPedido(2100)).toBe(2)
  })

  test("pedido que não existe não mexe na sacola", () => {
    expect(sacola().repetirPedido(9999)).toBe(0)
    expect(sacola().itens).toEqual([])
  })
})

describe("finalizar", () => {
  // 1794182400000 é múltiplo de 9000; com 1234 ms a mais, o número do pedido fica 2234.
  const AGORA = new Date("2026-11-08T21:00:01.234-03:00")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
  })

  test("farmácia: o pedido guarda a receita anexada e se a via fica retida", () => {
    sacola().adicionar(item({ produtoId: "losartana-50", venda: "receita" }))
    const pedido = sacola().finalizar(
      { ...dados(), receita: { arquivo: "receita.jpg", retida: false } },
      LEMBRAR,
    )
    expect(pedido.receita).toEqual({ arquivo: "receita.jpg", retida: false })
  })

  test("cria o pedido com subtotal, taxa, total, número e horário", () => {
    sacola().adicionar(item({ precoUnitario: 40, quantidade: 2 }))
    const pedido = sacola().finalizar(dados({ taxaEntrega: 8 }), LEMBRAR)

    expect(pedido).toMatchObject({
      numero: 2234,
      subtotal: 80,
      taxaEntrega: 8,
      total: 88,
      criadoEm: AGORA.getTime(),
      cliente: { nome: "Ana", whatsapp: "(12) 99876-5432" },
      pagamento: "pix",
    })
    expect(pedido.itens).toHaveLength(1)
  })

  test("esvazia a sacola, mostra o pedido no acompanhamento e lembra os dados", () => {
    sacola().adicionar(item())
    const pedido = sacola().finalizar(dados(), LEMBRAR)

    expect(sacola().itens).toEqual([])
    expect(sacola().ultimoPedido).toBe(pedido)
    expect(sacola().pedidos).toEqual([pedido])
    expect(sacola().dadosLembrados).toBe(LEMBRAR)
  })

  test("guarda só os 10 pedidos mais novos, do mais novo para o mais antigo", () => {
    for (let vez = 0; vez < 12; vez += 1) {
      sacola().adicionar(item())
      sacola().finalizar(dados(), LEMBRAR)
      vi.advanceTimersByTime(1000)
    }

    expect(sacola().pedidos.map(({ numero }) => numero)).toEqual([
      // A cada 9 s o relógio repete o número; os repetidos andam para o próximo livre.
      4235, 3235, 2235, 1234, 9234, 8234, 7234, 6234, 5234, 4234,
    ])
  })

  test("pedido que cairia no mesmo número de outro do histórico pega o próximo livre", () => {
    sacola().adicionar(item())
    const primeiro = sacola().finalizar(dados(), LEMBRAR)
    vi.advanceTimersByTime(9000)
    sacola().adicionar(item())
    const segundo = sacola().finalizar(dados(), LEMBRAR)

    expect(primeiro.numero).toBe(2234)
    expect(segundo.numero).toBe(2235)
  })

  test("o número também não repete o último pedido salvo antes do histórico", () => {
    useSacola.setState({
      ultimoPedido: { numero: 2234, itens: [], subtotal: 0, taxaEntrega: 0, total: 0 },
    })

    expect(sacola().finalizar(dados(), LEMBRAR).numero).toBe(2235)
  })

  test("depois do 9999, o próximo número livre volta para 1000", () => {
    vi.setSystemTime(new Date("2026-11-08T21:00:08.999-03:00"))
    useSacola.setState({
      pedidos: [{ numero: 9999, itens: [], subtotal: 0, taxaEntrega: 0, total: 0 }],
    })

    expect(sacola().finalizar(dados(), LEMBRAR).numero).toBe(1000)
  })

  test("sacola vazia também vira pedido", () => {
    const pedido = sacola().finalizar(dados({ taxaEntrega: 6 }), LEMBRAR)

    expect(pedido).toMatchObject({ itens: [], subtotal: 0, total: 6 })
  })
})

describe("verPedido", () => {
  function pedidoSalvo(numero: number): Pedido {
    return { numero, itens: [], subtotal: 0, taxaEntrega: 0, total: 0 }
  }

  test("põe no acompanhamento o pedido escolhido do histórico", () => {
    useSacola.setState({ pedidos: [pedidoSalvo(2001), pedidoSalvo(2002)] })
    sacola().verPedido(2002)

    expect(sacola().ultimoPedido?.numero).toBe(2002)
  })

  test("número desconhecido mantém o pedido que já estava", () => {
    useSacola.setState({ pedidos: [pedidoSalvo(2001)], ultimoPedido: pedidoSalvo(2001) })
    sacola().verPedido(9999)

    expect(sacola().ultimoPedido?.numero).toBe(2001)
  })
})

describe("persistência", () => {
  test("salva sacola, pedidos e dados lembrados no aparelho, sem o estado de hidratação", () => {
    sacola().adicionar(item())

    const salvo = JSON.parse(localStorage.getItem("clickpedido-sacola") ?? "null")
    expect(Object.keys(salvo.state).sort()).toEqual([
      "dadosLembrados",
      "itens",
      "pedidos",
      "ultimoPedido",
    ])
    expect(salvo.state.itens).toHaveLength(1)
  })

  test("não lê o aparelho sozinha: só ao reidratar, e aí marca como hidratada", async () => {
    localStorage.setItem(
      "clickpedido-sacola",
      JSON.stringify({ state: { itens: [{ ...item(), chave: "calabresa|" }] }, version: 0 }),
    )
    expect(sacola().hidratada).toBe(false)
    expect(sacola().itens).toEqual([])

    await useSacola.persist.rehydrate()

    expect(sacola().hidratada).toBe(true)
    expect(sacola().itens).toHaveLength(1)
  })
})

describe("pedidosDoCelular", () => {
  function pedidoDe(numero: number, whatsapp?: string): Pedido {
    return {
      numero,
      itens: [],
      subtotal: 0,
      taxaEntrega: 0,
      total: 0,
      ...(whatsapp ? { cliente: { nome: "Ana", whatsapp } } : {}),
    }
  }

  test("encontra os pedidos do celular, ignorando a máscara", () => {
    useSacola.setState({
      pedidos: [
        pedidoDe(2003, "(12) 99876-5432"),
        pedidoDe(2002, "(11) 91111-2222"),
        pedidoDe(2001, "12998765432"),
      ],
    })

    expect(pedidosDoCelular("12 99876 5432").map(({ numero }) => numero)).toEqual([2003, 2001])
  })

  test("inclui o último pedido salvo antes de existir o histórico", () => {
    useSacola.setState({
      pedidos: [pedidoDe(2002, "(12) 99876-5432")],
      ultimoPedido: pedidoDe(1500, "(12) 99876-5432"),
    })

    expect(pedidosDoCelular("12998765432").map(({ numero }) => numero)).toEqual([1500, 2002])
  })

  test("não repete o último pedido quando ele já está no histórico", () => {
    const ultimo = pedidoDe(2002, "(12) 99876-5432")
    useSacola.setState({ pedidos: [ultimo], ultimoPedido: ultimo })

    expect(pedidosDoCelular("12998765432")).toHaveLength(1)
  })

  test("ignora pedidos sem dados do cliente", () => {
    useSacola.setState({ pedidos: [pedidoDe(2001)] })

    expect(pedidosDoCelular("12998765432")).toEqual([])
  })
})

describe("esvaziar", () => {
  test("tira todos os itens e mantém os pedidos já feitos", () => {
    sacola().adicionar(item())
    sacola().adicionar(item({ produtoId: "mussarela", nome: "Mussarela" }))
    useSacola.setState({
      pedidos: [{ numero: 1234, itens: [], subtotal: 0, taxaEntrega: 0, total: 0 }],
    })

    sacola().esvaziar()

    expect(sacola().itens).toEqual([])
    expect(sacola().pedidos).toHaveLength(1)
  })
})
