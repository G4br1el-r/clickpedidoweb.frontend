import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useValorAssentado } from "./use-valor-assentado"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useValorAssentado", () => {
  test("começa com o valor inicial, sem esperar", () => {
    const { result } = renderHook(() => useValorAssentado("tradicionais", 140))
    expect(result.current).toBe("tradicionais")
  })

  test("só passa o valor que fica parado o tempo pedido; os do meio são pulados", () => {
    const { result, rerender } = renderHook(({ valor }) => useValorAssentado(valor, 140), {
      initialProps: { valor: "dor-febre" },
    })
    rerender({ valor: "gripe" })
    act(() => vi.advanceTimersByTime(60))
    rerender({ valor: "antibioticos" })
    act(() => vi.advanceTimersByTime(60))
    rerender({ valor: "uso-continuo" })
    act(() => vi.advanceTimersByTime(139))
    expect(result.current).toBe("dor-febre")

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe("uso-continuo")
  })
})
