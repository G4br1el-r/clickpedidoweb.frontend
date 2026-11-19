import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { useUsuarioSalvo } from "../usuario-atual"
import { reiniciarServidores, servidorDo, useFinalizarVenda } from "./consultas"
import {
  useAbrirCaixa,
  useCaixaAtual,
  useFecharCaixa,
  useHistoricoCaixas,
  useMovimentarCaixa,
  useReabrirCaixa,
  useResumoTurno,
} from "./consultas-caixa"
import { useEntrar, useEquipe, useSalvarMembro, useUsuarioAtual } from "./consultas-equipe"

function envolver() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  )
}

/** Espera longa: a primeira leitura gera 90 dias de demonstração. */
const esperar = (conferir: () => void) => waitFor(conferir, { timeout: 5000 })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("usuário atual", () => {
  test("sem nada salvo, o usuário é o dono", async () => {
    const { result } = renderHook(() => useUsuarioAtual(), { wrapper: envolver() })
    expect(result.current.carregando).toBe(true)
    await esperar(() => expect(result.current.membro?.nome).toBe("Carla N."))
    expect(result.current.carregando).toBe(false)
  })

  test("entrar com o PIN troca o usuário; PIN errado não troca", async () => {
    const { result } = renderHook(() => ({ atual: useUsuarioAtual(), entrar: useEntrar() }), {
      wrapper: envolver(),
    })
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("Carla N."))
    await act(async () => {
      await expect(
        result.current.entrar.mutateAsync({ id: "eq-joao", pin: "0000" }),
      ).rejects.toThrow("PIN errado.")
    })
    expect(result.current.atual.membro?.nome).toBe("Carla N.")
    await act(() => result.current.entrar.mutateAsync({ id: "eq-joao", pin: "2222" }))
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("João P."))
    expect(useUsuarioSalvo.getState().porSegmento.pizzaria).toBe("eq-joao")
  })

  test("o usuário salvo que foi desativado volta para o dono", async () => {
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-joao")
    const { result } = renderHook(
      () => ({ atual: useUsuarioAtual(), equipe: useEquipe(), salvar: useSalvarMembro() }),
      { wrapper: envolver() },
    )
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("João P."))
    const joao = result.current.equipe.data?.find((membro) => membro.id === "eq-joao")
    if (!joao) throw new Error("João devia estar na equipe")
    await act(() => result.current.salvar.mutateAsync({ ...joao, ativo: false }))
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("Carla N."))
  })
})

describe("caixa", () => {
  test("abrir o caixa troca o usuário para quem abriu", async () => {
    const { result } = renderHook(
      () => ({ atual: useUsuarioAtual(), caixa: useCaixaAtual(), abrir: useAbrirCaixa() }),
      { wrapper: envolver() },
    )
    await esperar(() => expect(result.current.caixa.data).toBeNull())
    await act(() =>
      result.current.abrir.mutateAsync({ operadorId: "eq-marina", pin: "1111", fundo: 100 }),
    )
    await esperar(() => expect(result.current.caixa.data?.abertoPor).toBe("eq-marina"))
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("Marina S."))
  })

  test("sangria invalida o resumo do turno", async () => {
    const turno = await servidorDo("pizzaria").caixa.abrir({
      operadorId: "eq-marina",
      pin: "1111",
      fundo: 100,
    })
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    const { result } = renderHook(
      () => ({ resumo: useResumoTurno(turno.id), movimentar: useMovimentarCaixa() }),
      { wrapper: envolver() },
    )
    await esperar(() => expect(result.current.resumo.data?.dinheiroNaGaveta).toBe(100))
    await act(() =>
      result.current.movimentar.mutateAsync({
        tipo: "sangria",
        valor: 60,
        motivo: "Cofre",
        autorizacao: { membroId: "eq-gerente", pin: "2580" },
      }),
    )
    await esperar(() => expect(result.current.resumo.data?.dinheiroNaGaveta).toBe(40))
  })

  test("a venda vai no nome do usuário atual", async () => {
    await servidorDo("pizzaria").caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-gerente")
    const { result } = renderHook(
      () => ({ atual: useUsuarioAtual(), finalizar: useFinalizarVenda() }),
      { wrapper: envolver() },
    )
    await esperar(() => expect(result.current.atual.membro?.nome).toBe("Rafael M."))
    const pedido = await act(() =>
      result.current.finalizar.mutateAsync({
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
        pagamento: "pix",
        desconto: { modo: "reais", valor: 0 },
        concluida: true,
      }),
    )
    expect(pedido.operadorId).toBe("eq-gerente")
  })

  test("fechar, ver no histórico e reabrir", async () => {
    await servidorDo("pizzaria").caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: 100 })
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    const { result } = renderHook(
      () => ({
        caixa: useCaixaAtual(),
        historico: useHistoricoCaixas(),
        fechar: useFecharCaixa(),
        reabrir: useReabrirCaixa(),
      }),
      { wrapper: envolver() },
    )
    await esperar(() => expect(result.current.caixa.data?.abertoPor).toBe("eq-marina"))
    const turnoId = result.current.caixa.data?.id ?? ""
    await act(() => result.current.fechar.mutateAsync({ contadoDinheiro: 100 }))
    await esperar(() => expect(result.current.caixa.data).toBeNull())
    await esperar(() =>
      expect(result.current.historico.data?.[0].turno.fechadoPor).toBe("eq-marina"),
    )
    await act(() =>
      result.current.reabrir.mutateAsync({
        turnoId,
        autorizacao: { membroId: "eq-gerente", pin: "2580" },
      }),
    )
    await esperar(() => expect(result.current.caixa.data?.id).toBe(turnoId))
  })
})
