import type { ComponentType } from "react"
import type { SecaoConfig } from "@/lib/admin/config"
import { SecaoAnimacoes, SecaoCores, SecaoIdentidade, SecaoTipografia } from "./marca-aparencia"
import {
  SecaoAcompanhamento,
  SecaoCards,
  SecaoConversa,
  SecaoFinalizar,
  SecaoInicio,
  SecaoProduto,
  SecaoRecursos,
  SecaoSacola,
} from "./telas"

/** Componente de cada seção; o índice com títulos e ícones fica em `lib/admin/secoes.ts`. */
export const COMPONENTES_SECAO: Record<SecaoConfig, ComponentType> = {
  identidade: SecaoIdentidade,
  cores: SecaoCores,
  tipografia: SecaoTipografia,
  animacoes: SecaoAnimacoes,
  inicio: SecaoInicio,
  cards: SecaoCards,
  produto: SecaoProduto,
  sacola: SecaoSacola,
  finalizar: SecaoFinalizar,
  acompanhamento: SecaoAcompanhamento,
  conversa: SecaoConversa,
  recursos: SecaoRecursos,
}
