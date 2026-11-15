import { describe, expect, test } from "vitest"
import { linkDoMapa, linkDoTelefone } from "./contato"

describe("contato da loja", () => {
  test("o telefone vira um link de ligação, só com os números e o código do país", () => {
    expect(linkDoTelefone("(12) 99888-7766")).toBe("tel:+5512998887766")
  })

  test("o endereço abre a busca do mapa com o texto codificado", () => {
    expect(linkDoMapa("Av. da Tradição Italiana, 120, Centro")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Av.%20da%20Tradi%C3%A7%C3%A3o%20Italiana%2C%20120%2C%20Centro",
    )
  })
})
