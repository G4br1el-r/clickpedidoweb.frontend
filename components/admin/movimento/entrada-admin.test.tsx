import { render, screen, waitFor } from "@testing-library/react"
import { AnimatePresence } from "motion/react"
import { describe, expect, it } from "vitest"
import { BlocoEntrando, ItemEntrando } from "./entrada-admin"

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul>
      <AnimatePresence>
        {itens.map((item, indice) => (
          <ItemEntrando key={item} indice={indice} como="li">
            {item}
          </ItemEntrando>
        ))}
      </AnimatePresence>
    </ul>
  )
}

describe("BlocoEntrando", () => {
  it("mostra o conteúdo", () => {
    render(<BlocoEntrando>Fila de pedidos</BlocoEntrando>)
    expect(screen.getByText("Fila de pedidos")).toBeInTheDocument()
  })

  it("repassa a classe e os atributos para o elemento", () => {
    render(
      <BlocoEntrando className="flex-1" data-testid="bloco">
        conteúdo
      </BlocoEntrando>,
    )
    expect(screen.getByTestId("bloco")).toHaveClass("flex-1")
  })

  it("renderiza o elemento pedido em `como`", () => {
    render(<BlocoEntrando como="section">conteúdo</BlocoEntrando>)
    expect(screen.getByText("conteúdo").tagName).toBe("SECTION")
  })
})

describe("ItemEntrando", () => {
  it("mostra o conteúdo do item", () => {
    render(
      <ul>
        <ItemEntrando indice={0} como="li">
          Pedido #0418
        </ItemEntrando>
      </ul>,
    )
    expect(screen.getByRole("listitem")).toHaveTextContent("Pedido #0418")
  })

  it("some da tela depois da saída quando sai da lista", async () => {
    const { rerender } = render(<Lista itens={["#0418", "#0419"]} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    rerender(<Lista itens={["#0419"]} />)
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1), { timeout: 2000 })
    expect(screen.getByRole("listitem")).toHaveTextContent("#0419")
  })
})

describe("entrada em CSS", () => {
  it("o bloco leva a classe de entrada do CSS e já está visível para o Motion", () => {
    render(<BlocoEntrando data-testid="bloco">conteúdo</BlocoEntrando>)
    const bloco = screen.getByTestId("bloco")
    expect(bloco).toHaveClass("entra-bloco")
    expect(bloco).toHaveStyle({ opacity: "1" })
  })

  it("o item leva a classe de entrada e a espera do próprio lugar na lista", () => {
    render(
      <ul>
        <ItemEntrando indice={3} como="li" data-testid="item">
          Pedido #0418
        </ItemEntrando>
      </ul>,
    )
    const item = screen.getByTestId("item")
    expect(item).toHaveClass("entra-item")
    expect(item.style.getPropertyValue("--atraso")).toBe("0.12s")
  })

  it("entra também como linha de tabela e como botão", () => {
    render(
      <table>
        <tbody>
          <ItemEntrando indice={0} como="tr" data-testid="linha">
            <td>Pedido #0418</td>
          </ItemEntrando>
        </tbody>
      </table>,
    )
    expect(screen.getByTestId("linha").tagName).toBe("TR")
    render(
      <ItemEntrando indice={1} como="button">
        Abrir
      </ItemEntrando>,
    )
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveClass("entra-item")
  })

  it("a classe que a pessoa passa continua valendo", () => {
    render(
      <ItemEntrando indice={0} className="flex-1" data-testid="item">
        x
      </ItemEntrando>,
    )
    expect(screen.getByTestId("item")).toHaveClass("entra-item", "flex-1")
  })
})
