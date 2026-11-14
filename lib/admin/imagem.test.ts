import { describe, expect, test, vi } from "vitest"
import { prepararFoto } from "./imagem"

// A redução usa canvas, que só existe no navegador: aqui é a fronteira simulada.
const reduzir = vi.hoisted(() =>
  Object.assign(
    vi.fn(async (arquivo: File) => new File(["reduzida"], arquivo.name, { type: "image/webp" })),
    { getDataUrlFromFile: vi.fn(async () => "data:image/webp;base64,cmVkdXppZGE=") },
  ),
)
vi.mock("browser-image-compression", () => ({ default: reduzir }))

describe("prepararFoto", () => {
  test("reduz para até 800 px em WebP e devolve a foto pronta para guardar", async () => {
    const foto = new File(["x".repeat(2000)], "pizza.jpg", { type: "image/jpeg" })
    expect(await prepararFoto(foto)).toBe("data:image/webp;base64,cmVkdXppZGE=")
    expect(reduzir).toHaveBeenCalledWith(
      foto,
      expect.objectContaining({ maxWidthOrHeight: 800, fileType: "image/webp" }),
    )
  })

  test("recusa o que não é imagem e imagem gigante", async () => {
    await expect(
      prepararFoto(new File(["%PDF"], "cardapio.pdf", { type: "application/pdf" })),
    ).rejects.toThrow("Escolha uma imagem (JPG, PNG ou WebP).")
    const gigante = new File([new Uint8Array(11 * 1024 * 1024)], "foto.png", { type: "image/png" })
    await expect(prepararFoto(gigante)).rejects.toThrow("A imagem passa de 10 MB.")
  })
})
