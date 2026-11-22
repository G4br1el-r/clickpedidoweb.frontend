import { z } from "zod"
import type { ConfigSalao } from "../dados/tipos"
import { normalizar } from "./filtro-pedidos"

/** Nome aparado e limitado: o que passa do limite é cortado, não recusado. */
const nome = (maximo: number, vazio: string) =>
  z
    .string({ error: vazio })
    .trim()
    .min(1, { error: vazio })
    .transform((valor) => valor.slice(0, maximo))

const minutos = z
  .number({ error: "Os alertas vão de 1 a 600 minutos." })
  .int({ error: "Os alertas vão de 1 a 600 minutos." })
  .min(1, { error: "Os alertas vão de 1 a 600 minutos." })
  .max(600, { error: "Os alertas vão de 1 a 600 minutos." })

const minutosDaReserva = z
  .number({ error: "Informe os minutos." })
  .int({ error: "Informe os minutos." })
  .min(0, { error: "Informe os minutos." })
  .max(600, { error: "Informe os minutos." })

/** Número com no máximo 2 casas decimais (tolera o erro de ponto flutuante de 8,55). */
const temAteDuasCasas = (valor: number) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6

/** Configuração do salão como a tela de ajustes salva: nomes limpos e regras entre os campos. */
export const esquemaSalao = z
  .object({
    areas: z
      .array(
        z.object({
          id: z.string().min(1),
          nome: nome(30, "Informe o nome da área."),
          ordem: z.number(),
        }),
      )
      .min(1, { error: "O salão precisa de pelo menos uma área." }),
    garcons: z.array(
      z.object({
        id: z.string().min(1),
        nome: nome(40, "Informe o nome do garçom."),
        ativo: z.boolean(),
      }),
    ),
    taxaServico: z.object({
      ativa: z.boolean(),
      percentual: z
        .number({ error: "A taxa de serviço vai de 0% a 20%." })
        .min(0, { error: "A taxa de serviço vai de 0% a 20%." })
        .max(20, { error: "A taxa de serviço vai de 0% a 20%." })
        .refine(temAteDuasCasas, { error: "Informe a taxa com até 2 casas decimais." }),
    }),
    couvert: z.object({
      ativo: z.boolean(),
      porPessoa: z
        .number({ error: "O couvert vai até R$ 100,00 por pessoa." })
        .min(0, { error: "O couvert vai até R$ 100,00 por pessoa." })
        .max(100, { error: "O couvert vai até R$ 100,00 por pessoa." })
        .refine(temAteDuasCasas, { error: "Informe o couvert em reais e centavos." }),
    }),
    limpeza: z.boolean(),
    alertas: z.object({
      semPedidoMin: minutos,
      contaPedidaMin: minutos,
      servirMin: minutos,
      abertaMin: minutos,
    }),
    reservas: z.object({ antecedenciaMin: minutosDaReserva, toleranciaMin: minutosDaReserva }),
    qr: z.object({ aceite: z.enum(["garcom", "direto"]), abrirMesaPeloQr: z.boolean() }),
    funcoes: z.object({ mapa: z.boolean(), reservas: z.boolean(), qr: z.boolean() }),
  })
  .superRefine((salao, contexto) => {
    const repetido = (itens: { id: string }[]) =>
      new Set(itens.map((item) => item.id)).size !== itens.length
    if (repetido(salao.areas)) {
      contexto.addIssue({
        code: "custom",
        path: ["areas"],
        message: "Há duas áreas com o mesmo identificador.",
      })
    }
    if (repetido(salao.garcons)) {
      contexto.addIssue({
        code: "custom",
        path: ["garcons"],
        message: "Há dois garçons com o mesmo identificador.",
      })
    }
    const vistas = new Map<string, string>()
    salao.areas.forEach((area, indice) => {
      const chave = normalizar(area.nome)
      const primeira = vistas.get(chave)
      if (primeira !== undefined) {
        contexto.addIssue({
          code: "custom",
          path: ["areas", indice, "nome"],
          message: `Já existe a área ${primeira}.`,
        })
      } else {
        vistas.set(chave, area.nome)
      }
    })
  }) satisfies z.ZodType<ConfigSalao, unknown>
