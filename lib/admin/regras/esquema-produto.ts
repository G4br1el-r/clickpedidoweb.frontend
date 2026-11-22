import { z } from "zod"
import { type SegmentoPainelId, temRecurso } from "../segmentos-painel"
import { esquemaLinkDeVideo } from "./video"

/** Campos do formulário que existem em cada segmento. */
export function camposDoProduto(segmento: SegmentoPainelId) {
  return {
    grupos: temRecurso(segmento, "adicionais"),
    precoBalcao: temRecurso(segmento, "precoBalcao"),
    unidade: temRecurso(segmento, "vendaPorPeso"),
    duracao: segmento === "salao",
    video: temRecurso(segmento, "video"),
    /** Adega: a marca de bebida alcoólica (+18). */
    maioridade: temRecurso(segmento, "maioridade"),
  }
}

const dinheiro = (mensagem: string) =>
  z.number({ error: mensagem }).max(9999, { error: "Até R$ 9.999,00." })

const esquemaOpcao = z.object({
  id: z.string(),
  nome: z
    .string()
    .trim()
    .min(1, { error: "Dê um nome à opção." })
    .max(80, { error: "Até 80 caracteres." }),
  // Vazio é grátis: quem não digita nada não precisa escrever 0.
  precoAdicional: dinheiro("Informe o valor.")
    .min(0, { error: "O valor não pode ser negativo." })
    .default(0),
  ativo: z.boolean(),
  /** Combos: a opção é este produto do cardápio. */
  produtoId: z.string().optional(),
})

const esquemaGrupo = z
  .object({
    id: z.string(),
    nome: z
      .string()
      .trim()
      .min(1, { error: "Dê um nome ao grupo." })
      .max(80, { error: "Até 80 caracteres." }),
    minimo: z.number().int().min(0, { error: "O mínimo é 0 ou mais." }),
    maximo: z.number().int().min(1, { error: "O máximo é pelo menos 1." }),
    gratisAte: z.number().int().min(0, { error: "Os grátis são 0 ou mais." }),
    ativo: z.boolean(),
    itens: z.array(esquemaOpcao),
  })
  // As regras entre campos ficam juntas: a loja vê todos os problemas do grupo de uma vez.
  .superRefine((grupo, contexto) => {
    if (grupo.minimo > grupo.maximo) {
      contexto.addIssue({
        code: "custom",
        path: ["minimo"],
        message: "O mínimo não pode passar do máximo.",
      })
    }
    if (grupo.gratisAte > grupo.maximo) {
      contexto.addIssue({
        code: "custom",
        path: ["gratisAte"],
        message: "Os grátis não podem passar do máximo.",
      })
    }
    if (grupo.itens.length === 0) {
      contexto.addIssue({
        code: "custom",
        path: ["itens"],
        message: "Inclua pelo menos uma opção.",
      })
    }
  })

/**
 * Validação do produto no formulário do painel. Só entram os campos do segmento:
 * o salão não tem grupos de opções e tem duração; o açougue escolhe unidade ou quilo.
 */
export function esquemaProduto(segmento: SegmentoPainelId) {
  const campos = camposDoProduto(segmento)
  return z
    .object({
      categoriaId: z.string().min(1, { error: "Escolha a categoria." }),
      nome: z
        .string()
        .trim()
        .min(1, { error: "Informe o nome do produto." })
        .max(80, { error: "Até 80 caracteres." }),
      descricao: z.string().trim().max(300, { error: "Até 300 caracteres." }),
      preco: dinheiro("Informe o preço.").gt(0, { error: "Informe um preço maior que zero." }),
      precoOriginal: dinheiro("Informe o preço “de”.").optional(),
      // Quanto a loja paga por uma unidade (ou 1 kg): a margem das vendas sai daqui.
      custo: dinheiro("Informe o custo.")
        .min(0, { error: "O custo não pode ser negativo." })
        .optional(),
      // A foto enviada (data:image/…, de lib/admin/imagem.ts) ou um caminho deste site
      // (/mock/…). "//" e "/\" levariam para outro endereço.
      imagem: z
        .string()
        .refine((foto) => foto.startsWith("data:image/") || /^\/(?![/\\])/.test(foto), {
          error: "Envie a foto pelo botão.",
        })
        .optional(),
      ativo: z.boolean(),
      disponivel: z.boolean(),
      destaque: z.boolean(),
      oferta: z.boolean(),
      alcoolico: z.boolean().optional(),
      ...(campos.precoBalcao
        ? { precoBalcao: dinheiro("Informe o preço de balcão.").gt(0).optional() }
        : {}),
      ...(campos.unidade ? { unidade: z.enum(["un", "kg"]) } : {}),
      ...(campos.duracao
        ? {
            duracaoMin: z
              .number({ error: "Informe a duração em minutos." })
              .int()
              .min(5, { error: "Pelo menos 5 minutos." })
              .max(600, { error: "Até 10 horas." }),
          }
        : {}),
      ...(campos.video
        ? {
            videoUrl: esquemaLinkDeVideo.optional(),
          }
        : {}),
      ...(campos.grupos ? { grupos: z.array(esquemaGrupo) } : {}),
    })
    .superRefine((produto, contexto) => {
      if (produto.oferta && !((produto.precoOriginal ?? 0) > produto.preco)) {
        contexto.addIssue({
          code: "custom",
          path: ["precoOriginal"],
          message: "O preço “de” precisa ser maior que o preço.",
        })
      }
    })
}

export type ValoresProduto = z.input<ReturnType<typeof esquemaProduto>>
