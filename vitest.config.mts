import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Horários do pedido dependem do fuso: os testes rodam sempre no horário de Brasília.
process.env.TZ = "America/Sao_Paulo"

export default defineConfig({
  plugins: [react()],
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
      // Mínimos medidos em 2026-11-08, arredondados para baixo. Só sobem, nunca descem.
      thresholds: {
        statements: 16,
        branches: 14,
        functions: 17,
        lines: 16,
        "lib/**": { statements: 81, branches: 89, functions: 83, lines: 82 },
      },
    },
  },
})
