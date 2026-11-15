import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { RadioGroup } from "@/components/ui/radio-group"
import { useLojaAtual } from "@/lib/loja-atual"
import type { GrupoOpcao } from "@/lib/tipos"
import { OpcaoLinha } from "./opcao-linha"

const SABOR = {
  id: "sabor",
  tipo: "opcao",
  nome: "Sabor",
  titulo: "Escolha o sabor",
  obrigatorio: true,
  itens: [{ id: "carne", nome: "Carne", extra: 0 }],
} as GrupoOpcao

function linha() {
  render(
    <RadioGroup aria-label="Escolha o sabor">
      <OpcaoLinha
        grupo={SABOR}
        item={SABOR.itens[0]}
        selecionada={false}
        invalida={false}
        aoClicar={() => {}}
      />
    </RadioGroup>,
  )
}

beforeEach(() => {
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("linha de opção", () => {
  test("opção só com texto vira linha limpa: sem a inicial no lugar da imagem", () => {
    useLojaAtual.setState({ id: "quiosque-do-mineiro" })
    linha()
    expect(screen.getByText("Carne")).toBeInTheDocument()
    expect(screen.queryByText("C")).not.toBeInTheDocument()
    expect(document.querySelector("[data-miniatura]")).toBeNull()
  })

  test("na pizzaria, a opção ganha a miniatura desenhada", () => {
    linha()
    expect(document.querySelector("[data-miniatura]")).not.toBeNull()
  })
})
