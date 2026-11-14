import { describe, expect, test } from "vitest"
import { esquemaLinkDeVideo } from "./video"

const aceita = (link: string) => esquemaLinkDeVideo.safeParse(link).success

describe("esquemaLinkDeVideo", () => {
  test("aceita YouTube, youtu.be, Shorts e Reels, com ou sem parâmetros; vazio é sem vídeo", () => {
    expect(aceita("")).toBe(true)
    expect(aceita("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
    expect(aceita("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe(true)
    expect(aceita("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(true)
    expect(aceita("https://youtube.com/shorts/abc_123-X")).toBe(true)
    expect(aceita("https://www.instagram.com/reel/Cxyz123/")).toBe(true)
  })

  test("recusa link com aspas, espaço ou sinal de tag depois do id", () => {
    expect(aceita('https://youtu.be/abc"onmouseover="alert(1)')).toBe(false)
    expect(aceita("https://youtu.be/abc'x")).toBe(false)
    expect(aceita("https://youtu.be/abc<script>")).toBe(false)
    expect(aceita('https://youtu.be/abc?x="y"')).toBe(false)
    expect(aceita("https://www.youtube.com/watch?v=abc def")).toBe(false)
  })

  test("recusa outros sites", () => {
    expect(aceita("https://vimeo.com/123")).toBe(false)
    expect(aceita("https://youtu.be.exemplo.com/abc")).toBe(false)
  })
})
