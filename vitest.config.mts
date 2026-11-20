import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Horários do pedido dependem do fuso: os testes rodam sempre no horário de Brasília.
process.env.TZ = "America/Sao_Paulo"

/**
 * Foto importada vira o mesmo objeto que o Next gera (src, tamanho e a versão desfocada),
 * para o `<Foto placeholder="blur">` funcionar nos testes como no app.
 */
const fotosComoNoNext = {
  name: "fotos-como-no-next",
  enforce: "pre" as const,
  load(id: string) {
    const arquivo = id.split("?")[0]
    if (!/\.(jpe?g|png|webp)$/.test(arquivo)) return null
    const publico = arquivo.slice(arquivo.lastIndexOf("/public/") + "/public".length)
    return `export default { src: ${JSON.stringify(publico)}, width: 800, height: 533, blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }`
  },
}

export default defineConfig({
  plugins: [fotosComoNoNext, react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["{lib,hooks,components,app}/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: ["components/ui/**", "lib/mock/**", "**/*.d.ts", "**/*.test.{ts,tsx}"],
      // Mínimos medidos em 2026-11-19, arredondados para baixo. Só sobem, nunca descem.
      thresholds: {
        statements: 81,
        branches: 73,
        functions: 80,
        lines: 82,
        "lib/**": { statements: 98, branches: 94, functions: 98, lines: 98 },
      },
    },
  },
})
