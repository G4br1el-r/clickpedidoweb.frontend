import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Table, TableBody, TableCell, TableRow } from "./table"

type Aviso = () => void
const avisos: Aviso[] = []

class ObservadorDeTamanho {
  constructor(aviso: Aviso) {
    avisos.push(aviso)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver

/** jsdom não mede nada: diz quanto o conteúdo tem e quanto cabe. */
function medir(conteudo: number, caixa: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(conteudo)
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(caixa)
}

function tabela() {
  return (
    <Table aria-label="Canais">
      <TableBody>
        <TableRow>
          <TableCell>Balcão</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

beforeEach(() => {
  avisos.length = 0
  Object.assign(globalThis, { ResizeObserver: ObservadorDeTamanho })
})

afterEach(() => {
  Object.assign(globalThis, { ResizeObserver: original })
  vi.restoreAllMocks()
})

describe("Table", () => {
  it("cabendo na largura, não vira uma região focável", () => {
    medir(300, 300)
    render(tabela())
    expect(screen.queryByRole("group", { name: "Canais, rolagem lateral" })).not.toBeInTheDocument()
  })

  it("passando da largura, rola e o teclado alcança: grupo com o nome da tabela e foco", () => {
    medir(402, 328)
    render(tabela())
    const regiao = screen.getByRole("group", { name: "Canais, rolagem lateral" })
    expect(regiao).toHaveAttribute("tabindex", "0")
  })

  it("acompanha a tela mudar de tamanho", () => {
    medir(402, 328)
    render(tabela())
    expect(screen.getByRole("group", { name: "Canais, rolagem lateral" })).toBeInTheDocument()
    medir(402, 500)
    act(() => {
      for (const aviso of avisos) aviso()
    })
    expect(screen.queryByRole("group", { name: "Canais, rolagem lateral" })).not.toBeInTheDocument()
  })

  it("não vira região de navegação: não repete o nome da seção que já a envolve", () => {
    medir(402, 328)
    render(tabela())
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("sem nome na tabela, o grupo não leva rótulo inventado", () => {
    medir(402, 328)
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(document.querySelector("[data-slot=table-container]")).toHaveAttribute("tabindex", "0")
    expect(document.querySelector("[data-slot=table-container]")).not.toHaveAttribute("aria-label")
  })
})
