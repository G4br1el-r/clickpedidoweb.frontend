import { render, screen, waitFor } from "@testing-library/react"
import { AnimatePresence } from "motion/react"
import { describe, expect, it } from "vitest"
import { Table, TableBody, TableCell } from "@/components/ui/table"
import { LinhaAnimada } from "./linha-animada"

function tabela(itens: string[]) {
  return (
    <Table aria-label="Teste">
      <TableBody>
        <AnimatePresence>
          {itens.map((item, indice) => (
            <LinhaAnimada key={item} indice={indice} aria-label={item}>
              <TableCell>{item}</TableCell>
            </LinhaAnimada>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}

describe("LinhaAnimada", () => {
  it("é uma linha de tabela de verdade, com o nome acessível", () => {
    render(tabela(["Skol", "Brahma"]))
    expect(screen.getByRole("row", { name: "Skol" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Brahma" })).toBeInTheDocument()
  })

  it("a linha removida sai da tabela depois do fade", async () => {
    const { rerender } = render(tabela(["Skol", "Brahma"]))
    rerender(tabela(["Skol"]))
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: "Brahma" })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("row", { name: "Skol" })).toBeInTheDocument()
  })
})
