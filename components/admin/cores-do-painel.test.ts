import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * O painel só pinta com os tokens de `app/admin/admin.css` e do tema: um hex solto numa
 * classe (`text-[#…]`) escapa do escuro e do sistema. A prévia fica de fora, porque imita
 * telas de fora do painel (a loja, o WhatsApp) com as cores delas.
 */
const PASTA = join(process.cwd(), "components/admin")
const FORA = [/^previa[\\/]/, /\.test\.tsx?$/]

function arquivosDoPainel() {
  return (readdirSync(PASTA, { recursive: true }) as string[])
    .filter((arquivo) => arquivo.endsWith(".tsx") || arquivo.endsWith(".ts"))
    .filter((arquivo) => !FORA.some((regra) => regra.test(arquivo)))
}

describe("cores do painel", () => {
  it("nenhuma classe do painel usa hex solto no lugar de um token", () => {
    const soltos = arquivosDoPainel().flatMap((arquivo) =>
      readFileSync(join(PASTA, arquivo), "utf8")
        .split("\n")
        .flatMap((linha, indice) =>
          /-\[#[0-9a-f]{3,8}\]/i.test(linha) ? [`${arquivo}:${indice + 1}`] : [],
        ),
    )
    expect(soltos).toEqual([])
  })
})
