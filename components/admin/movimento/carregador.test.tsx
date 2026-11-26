import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Carregador, VARIANTES_CARREGADOR } from "./carregador"

describe("Carregador", () => {
  it("anuncia o que está acontecendo para o leitor de tela", () => {
    render(<Carregador variante="pontos" rotulo="Salvando o produto" />)
    expect(screen.getByRole("status", { name: "Salvando o produto" })).toBeInTheDocument()
  })

  it("sem rótulo, anuncia só 'Carregando'", () => {
    render(<Carregador variante="anel" />)
    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument()
  })

  it.each(VARIANTES_CARREGADOR)("a variante %s tem o próprio desenho", (variante) => {
    render(<Carregador variante={variante} />)
    expect(screen.getByTestId(`carregador-${variante}`)).toBeInTheDocument()
  })

  it("cada variante é um desenho diferente, não o mesmo giro com outro nome", () => {
    const desenhos = VARIANTES_CARREGADOR.map((variante) => {
      const { container, unmount } = render(<Carregador variante={variante} />)
      const html = container.innerHTML.replace(/carregador-\w+/g, "")
      unmount()
      return html
    })
    expect(new Set(desenhos).size).toBe(VARIANTES_CARREGADOR.length)
  })

  it("as cinco variantes são pontos, barra, papel, radar e anel", () => {
    expect([...VARIANTES_CARREGADOR]).toEqual(["pontos", "barra", "papel", "radar", "anel"])
  })

  it("herda a cor do texto ao redor", () => {
    render(<Carregador variante="pontos" />)
    expect(screen.getByTestId("carregador-pontos").getAttribute("class")).toContain("text-current")
  })
})

describe("Carregador decorativo", () => {
  it("escondido do leitor de tela quando outro elemento já avisa", () => {
    render(<Carregador variante="pontos" decorativo />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByTestId("carregador-pontos")).toHaveAttribute("aria-hidden", "true")
  })
})
