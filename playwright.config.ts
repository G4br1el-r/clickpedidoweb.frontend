import { defineConfig } from "@playwright/test"

const toque = { hasTouch: true, isMobile: true }

/**
 * Porta do servidor dos testes. Cada worktree pode subir o próprio (PORTA_E2E=3021):
 * com o reaproveitamento ligado, outra cópia do projeto na mesma porta seria testada no lugar.
 */
const porta = process.env.PORTA_E2E ?? "3010"
const endereco = `http://localhost:${porta}`

/** Do menor celular ao monitor grande, incluindo celular deitado. */
const telas = [
  { name: "celular-320", width: 320, height: 568, ...toque },
  { name: "celular-360", width: 360, height: 740, ...toque },
  { name: "celular-375", width: 375, height: 667, ...toque },
  { name: "celular-390", width: 390, height: 844, ...toque },
  { name: "celular-430", width: 430, height: 932, ...toque },
  { name: "celular-deitado", width: 844, height: 390, ...toque },
  { name: "tablet-768", width: 768, height: 1024, ...toque },
  { name: "notebook-1024", width: 1024, height: 768 },
  { name: "notebook-1366", width: 1366, height: 768 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-2560", width: 2560, height: 1440 },
]

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 4,
  timeout: 45_000,
  reporter: [["line"]],
  outputDir: "test-results",
  // O aviso de segurança do Next aparece no modo dev mesmo com `devIndicators: false`.
  expect: { toHaveScreenshot: { stylePath: "./tests/sem-avisos-do-next.css" } },
  use: {
    baseURL: endereco,
    locale: "pt-BR",
    screenshot: "only-on-failure",
  },
  projects: telas.map(({ name, width, height, ...resto }) => ({
    name,
    use: { viewport: { width, height }, ...resto },
  })),
  webServer: {
    command: `pnpm next dev --port ${porta}`,
    url: endereco,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
