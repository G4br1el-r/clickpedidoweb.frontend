import { z } from "zod"
import { textoDoPrazo } from "./loja"
import { esquemaLinkDeVideo } from "./video"

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

const texto = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, { error: `Até ${maximo} caracteres.` })

const telefone = (mensagem: string) =>
  z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,13}$/, { error: mensagem }))

const dinheiro = (negativo: string) =>
  z
    .number({ error: "Informe o valor." })
    .min(0, { error: negativo })
    .max(9999, { error: "Até R$ 9.999,00." })

const esquemaHorario = z
  .object({
    dia: z.number().int().min(0).max(6),
    aberto: z.boolean(),
    abre: z.string(),
    fecha: z.string(),
  })
  .superRefine((horario, contexto) => {
    // Dia fechado guarda o horário, mas não precisa estar certo.
    if (!horario.aberto) return
    for (const campo of ["abre", "fecha"] as const) {
      if (!HORA.test(horario[campo])) {
        contexto.addIssue({ code: "custom", path: [campo], message: "Use o formato 18:00." })
      }
    }
    if (HORA.test(horario.abre) && horario.abre === horario.fecha) {
      contexto.addIssue({
        code: "custom",
        path: ["fecha"],
        message: "O fechamento precisa ser diferente da abertura.",
      })
    }
  })

const vitrine = z.object({ titulo: texto(40), ativo: z.boolean() })

const minutos = z
  .number({ error: "Informe os minutos." })
  .int({ error: "Use minutos inteiros." })
  .min(1, { error: "De 1 a 240 min." })
  .max(240, { error: "De 1 a 240 min." })

/** Mínimo e máximo, em minutos: o máximo não fica abaixo do mínimo. */
const prazo = z.object({ min: minutos, max: minutos }).refine((valor) => valor.max >= valor.min, {
  path: ["max"],
  error: "O máximo precisa ser maior ou igual ao mínimo.",
})

/** Configuração da loja como o formulário salva: textos limpos e regras entre os campos. */
export const esquemaLoja = z
  .object({
    nome: texto(60).min(1, { error: "Informe o nome da loja." }),
    slogan: texto(80),
    telefone: telefone("Telefone com DDD, só números."),
    whatsapp: telefone("WhatsApp com DDD, só números."),
    endereco: texto(140),
    textoHorario: texto(140),
    controleAutomatico: z.boolean(),
    aberta: z.boolean(),
    mensagemFechada: texto(200),
    horarios: z.array(esquemaHorario).length(7),
    aceitaEntrega: z.boolean(),
    aceitaRetirada: z.boolean(),
    taxaEntregaPadrao: dinheiro("A taxa não pode ser negativa."),
    pedidoMinimo: dinheiro("O pedido mínimo não pode ser negativo."),
    tempoEntrega: texto(40),
    tempoRetirada: texto(40),
    cidadesAtendidas: z
      .array(texto(60))
      .max(30)
      .transform((cidades) => cidades.filter(Boolean)),
    pagamentos: z.object({
      pix: z.boolean(),
      "cartao-online": z.boolean(),
      dinheiro: z.boolean(),
      "cartao-na-entrega": z.boolean(),
      "pagar-apos-pesagem": z.boolean(),
    }),
    pagamentoOnlineConectado: z.boolean().optional(),
    capacidadeAtendimentos: z.number().int().min(1).max(20).optional(),
    impressaoAutomatica: z.boolean(),
    cortarPapel: z.boolean(),
    som: z.enum(["suave", "alto", "muito-alto"]),
    vitrines: z.object({ destaques: vitrine, ofertas: vitrine }),
    videoBanner: esquemaLinkDeVideo.optional(),
    prazos: z.object({ entrega: prazo, retirada: prazo }).optional(),
  })
  .superRefine((loja, contexto) => {
    if (!loja.aceitaEntrega && !loja.aceitaRetirada) {
      contexto.addIssue({
        code: "custom",
        path: ["aceitaRetirada"],
        message: "Aceite pelo menos entrega ou retirada.",
      })
    }
    if (!Object.values(loja.pagamentos).some(Boolean)) {
      contexto.addIssue({
        code: "custom",
        path: ["pagamentos"],
        message: "Ligue pelo menos uma forma de pagamento.",
      })
    } else if (!loja.pagamentoOnlineConectado) {
      // Nas lojas, Pix e cartão online só aparecem com o gateway configurado.
      const online = [
        ["pix", "o Pix"],
        ["cartao-online", "o cartão online"],
      ] as const
      for (const [forma, nome] of online) {
        if (loja.pagamentos[forma]) {
          contexto.addIssue({
            code: "custom",
            path: ["pagamentos", forma],
            message: `Conecte a conta de pagamento online para usar ${nome}.`,
          })
        }
      }
    }
  })
  // Com os prazos em minutos, o texto da vitrine sai deles.
  .transform((loja) =>
    loja.prazos
      ? {
          ...loja,
          tempoEntrega: textoDoPrazo(loja.prazos.entrega),
          tempoRetirada: textoDoPrazo(loja.prazos.retirada),
        }
      : loja,
  )

export type FormularioLoja = z.input<typeof esquemaLoja>

const ate = (maximo: number) =>
  z
    .number({ error: "Informe os minutos." })
    .int({ error: "Use minutos inteiros." })
    .min(1, { error: `De 1 a ${maximo} min.` })
    .max(maximo, { error: `De 1 a ${maximo} min.` })

const alertas = z.object({ atencaoMin: ate(120), atrasoMin: ate(120) })

/** Tempos de alerta da cozinha: a atenção vem antes do atraso. */
export const esquemaTemposCozinha = z
  .object({ ...alertas.shape, prontoFicaMin: ate(60) })
  .refine((tempos) => tempos.atrasoMin > tempos.atencaoMin, {
    path: ["atrasoMin"],
    error: "O atraso precisa vir depois da atenção.",
    // Confere a ordem mesmo com o tempo do pronto errado.
    when: ({ value }) => alertas.safeParse(value).success,
  })
