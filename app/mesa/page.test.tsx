import { expect, test } from "vitest"
import { VitrineMesa } from "@/components/mesa/vitrine-mesa"
import Page from "./page"

test("/mesa?loja=pizzaria&mesa=mesa-7 abre a vitrine da mesa 7 da pizzaria", async () => {
  const pagina = await Page({ searchParams: Promise.resolve({ loja: "pizzaria", mesa: "mesa-7" }) })
  expect(pagina.type).toBe(VitrineMesa)
  expect(pagina.props).toEqual({ segmento: "pizzaria", mesaId: "mesa-7" })
})

test("sem os parâmetros (ou repetidos), a vitrine recebe vazio e mostra a mesa indisponível", async () => {
  const pagina = await Page({ searchParams: Promise.resolve({ loja: ["a", "b"] }) })
  expect(pagina.props).toEqual({ segmento: "", mesaId: "" })
})
