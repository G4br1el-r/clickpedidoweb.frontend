import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { ArteEnvioPizza } from "./envio-pizza"

const partes = () =>
  [...screen.getByTestId("arte-envio-pizzaria").querySelectorAll("[data-parte]")].map((parte) =>
    parte.getAttribute("data-parte"),
  )

describe("arte do envio da pizzaria, no mesmo sistema dos outros nichos", () => {
  test("começa no chão da loja, só com a massa aberta", () => {
    render(<ArteEnvioPizza etapa={0} itens={[]} />)
    expect(partes()).toEqual(["chao", "massa"])
  })

  test("na segunda etapa ganha molho, queijo e cobertura", () => {
    render(<ArteEnvioPizza etapa={1} itens={[]} />)
    expect(partes()).toEqual(["chao", "massa", "recheio"])
  })

  test("na terceira, os cortes riscam a pizza", () => {
    render(<ArteEnvioPizza etapa={2} itens={[]} />)
    expect(partes()).toEqual(["chao", "massa", "recheio", "cortes"])
  })

  test("no fim, uma fatia sai fumegando e aparece o selo de pronto", () => {
    render(<ArteEnvioPizza etapa={3} itens={[]} />)
    expect(partes()).toEqual(["chao", "massa", "recheio", "cortes", "fatia", "vapor", "pronto"])
  })
})
