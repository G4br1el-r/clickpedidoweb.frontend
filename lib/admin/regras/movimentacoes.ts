import type { ItemPedido, Pedido } from "../dados/tipos"
import { comTotais, itensPagos } from "./conta"
import { itensDaCozinha } from "./cozinha"

const reais = (valor: number) => Math.round(valor * 100) / 100

const lista = new Intl.ListFormat("pt-BR", { type: "conjunction" })

/** Os números das mesas em texto: "4", "4 e 5", "4, 5 e 6". */
export const numerosEmTexto = (numeros: number[]) => lista.format(numeros.map(String))

/** A cozinha tem a rodada atual da comanda: recebida ou em preparo. */
const naCozinha = (comanda: Pedido) =>
  comanda.status === "recebido" || comanda.status === "em-preparo"

/**
 * Por que o item não pode ir para outra mesa, ou `null`. O pago por item fica na conta que o
 * pagou; o da rodada que a cozinha ainda tem espera ficar pronto (o ticket não muda de mesa).
 */
export function porQueNaoTransfere(comanda: Pedido, item: ItemPedido): string | null {
  if (itensPagos(comanda).has(item.id)) return "Esse item já foi pago."
  if (naCozinha(comanda) && itensDaCozinha(comanda).atuais.some((atual) => atual.id === item.id)) {
    return `A cozinha ainda está com ${item.nome}. Transfira quando ficar pronta.`
  }
  return null
}

/**
 * Por que a comanda da secundária não entra na da principal, ou `null`: a que já tem mesas
 * juntadas, a com desconto (os dois descontos não se somam) e as duas com rodada na cozinha.
 */
export function porQueNaoJunta(principal: Pedido, secundaria: Pedido): string | null {
  const numero = secundaria.mesa?.numero
  if (secundaria.mesa?.juntadas?.length) {
    return `Separe as mesas da mesa ${numero} antes de juntar.`
  }
  if (secundaria.descontoConta) return `Tire o desconto da mesa ${numero} antes de juntar.`
  if (naCozinha(principal) && naCozinha(secundaria)) {
    return `A cozinha está com rodadas das mesas ${numerosEmTexto([principal.mesa?.numero ?? 0, numero ?? 0])}. Junte depois que uma ficar pronta.`
  }
  return null
}

/**
 * A comanda da secundária dentro da principal (sem o evento da junção, que é do servidor).
 * Itens, cortesias e pagamentos vêm com os mesmos ids; as pessoas somam; a taxa e o couvert
 * continuam os da principal, sobre a conta inteira. Confira antes com `porQueNaoJunta`.
 */
export function juntarComandas(principal: Pedido, secundaria: Pedido): Pedido {
  const mesa = principal.mesa as NonNullable<Pedido["mesa"]>
  const pagamentos = [...(principal.pagamentos ?? []), ...(secundaria.pagamentos ?? [])]
  // As rodadas continuam, renumeradas: a que a cozinha tem fica por último, para ela continuar
  // vendo só essa. Sem nenhuma na cozinha, as da secundária vêm depois.
  const [primeira, ultima] =
    naCozinha(principal) && !naCozinha(secundaria)
      ? [secundaria, principal]
      : [principal, secundaria]
  const depoisDe = Math.max(0, ...primeira.itens.map((atual) => atual.rodada ?? 1))
  const itensDe = (comanda: Pedido) =>
    comanda.itens.map((atual) => ({
      ...atual,
      rodada: (atual.rodada ?? 1) + (comanda === ultima ? depoisDe : 0),
      // A comanda antiga diz no pedido se ia para a cozinha: o item passa a dizer sozinho.
      vaiParaCozinha: atual.vaiParaCozinha ?? comanda.enviarParaCozinha,
    }))
  return comTotais({
    ...principal,
    status: naCozinha(ultima) ? ultima.status : principal.status,
    enviarParaCozinha: principal.enviarParaCozinha || secundaria.enviarParaCozinha,
    mesa: {
      ...mesa,
      pessoas: (mesa.pessoas ?? 1) + (secundaria.mesa?.pessoas ?? 1),
      juntadas: [
        ...(mesa.juntadas ?? []),
        { id: secundaria.mesa?.id ?? "", numero: secundaria.mesa?.numero ?? 0 },
      ].toSorted((a, b) => a.numero - b.numero),
    },
    itens: [...itensDe(principal), ...itensDe(secundaria)],
    ...(pagamentos.length > 0 ? { pagamentos } : {}),
    ...maisAntiga("servirDesde", principal, secundaria),
    ...maisAntiga("contaPedidaEm", principal, secundaria),
    ...(principal.eventos || secundaria.eventos
      ? {
          eventos: [
            ...(principal.eventos ?? []),
            ...(secundaria.eventos ?? []).map((evento) => ({
              ...evento,
              texto: `Mesa ${secundaria.mesa?.numero}: ${evento.texto}`,
            })),
          ].toSorted((a, b) => Date.parse(a.em) - Date.parse(b.em)),
        }
      : {}),
  })
}

/** O campo de hora com a mais antiga das duas comandas, ou nada se nenhuma tem. */
function maisAntiga(campo: "servirDesde" | "contaPedidaEm", a: Pedido, b: Pedido) {
  const horas = [a[campo], b[campo]].filter((hora): hora is string => hora !== undefined)
  if (horas.length === 0) return {}
  return { [campo]: horas.toSorted((x, y) => Date.parse(x) - Date.parse(y))[0] }
}

/**
 * Parte de uma linha da comanda que vai para outra mesa. A linha inteira vai como está; parte
 * dela divide a linha: a que fica com o resto e a que vai com o id novo, no mesmo preço.
 */
export function separarQuantidade(
  item: ItemPedido,
  quantidade: number,
  novoId: string,
): { fica: ItemPedido | null; vai: ItemPedido } {
  if (quantidade >= item.quantidade) return { fica: null, vai: item }
  const parte = (id: string, quantas: number): ItemPedido => ({
    ...item,
    id,
    quantidade: quantas,
    total: reais(item.precoUnitario * quantas),
  })
  return { fica: parte(item.id, item.quantidade - quantidade), vai: parte(novoId, quantidade) }
}

/**
 * O `servirDesde` do destino depois de receber itens: o item que a cozinha da origem já
 * preparou e a mesa ainda não serviu leva o "Servir" junto. Fica a hora mais antiga.
 */
export function servirDesdeAoReceber(
  origem: Pedido,
  vao: ItemPedido[],
  destino: Pedido | undefined,
): string | undefined {
  const leva = origem.servirDesde && vao.some((item) => item.transferido?.preparado)
  const horas = [destino?.servirDesde, leva ? origem.servirDesde : undefined].filter(
    (hora): hora is string => hora !== undefined,
  )
  return horas.toSorted((a, b) => Date.parse(a) - Date.parse(b))[0]
}
