import type { MembroEquipe } from "./tipos"

/** Equipe de demonstração, igual em todos os segmentos (ver docs/plano-pdv-fase-1.md). */
export const EQUIPE_DEMO: readonly MembroEquipe[] = [
  { id: "eq-dono", nome: "Carla N.", perfil: "dono", pin: "1234", ativo: true },
  { id: "eq-gerente", nome: "Rafael M.", perfil: "gerente", pin: "2580", ativo: true },
  { id: "eq-marina", nome: "Marina S.", perfil: "caixa", pin: "1111", ativo: true },
  { id: "eq-joao", nome: "João P.", perfil: "caixa", pin: "2222", ativo: true },
]
