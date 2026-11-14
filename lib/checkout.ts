import { cpf } from "cpf-cnpj-validator"
import { z } from "zod"
import { emReais } from "./formato"
import { lojaAtual } from "./loja-atual"
import type { DadosFinalizacao, DadosLembrados } from "./sacola"

export const somenteDigitos = (texto: string) => texto.replace(/\D/g, "")

export const FORMAS_PAGAMENTO = {
  pix: { titulo: "Pix", detalhe: "Aprovação na hora, pelo app do banco", agora: true },
  "cartao-online": {
    titulo: "Cartão online",
    detalhe: "Crédito ou débito, pago agora",
    agora: true,
  },
  dinheiro: { titulo: "Dinheiro", detalhe: "Com troco, se precisar", agora: false },
  maquininha: { titulo: "Cartão na maquininha", detalhe: "Crédito ou débito", agora: false },
  "apos-pesagem": {
    titulo: "Pagar após a pesagem",
    detalhe: "Mandamos o link com o valor exato depois de pesar",
    agora: false,
  },
} as const

export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO

/**
 * Formas que o pedido oferece. Açougue: com corte por quilo, o valor exato só sai na balança,
 * então a loja que aceita deixa pagar depois da pesagem.
 */
export function formasDePagamento(itens: { pesoGramas?: number }[]): {
  agora: FormaPagamento[]
  depois: FormaPagamento[]
} {
  const pesaDepois =
    itens.some((item) => item.pesoGramas) && lojaAtual().pagamentos.includes("Pagar após a pesagem")
  return {
    agora: ["pix", "cartao-online"],
    depois: ["dinheiro", "maquininha", ...(pesaDepois ? (["apos-pesagem"] as const) : [])],
  }
}

export const LIMITE_OBSERVACAO_PEDIDO = 300

/**
 * Os campos não têm regra própria: toda a validação mora no `superRefine`,
 * porque o que é obrigatório depende da entrega e da forma de pagamento escolhidas.
 */
export const esquemaCheckout = z
  .object({
    nome: z.string(),
    whatsapp: z.string(),
    tipo: z.enum(["entrega", "retirada"]),
    cep: z.string(),
    rua: z.string(),
    numero: z.string(),
    complemento: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string(),
    referencia: z.string(),
    pagamento: z.enum(["pix", "cartao-online", "dinheiro", "maquininha", "apos-pesagem"]),
    cpf: z.string(),
    troco: z.number().nullable(),
    observacao: z.string(),
    /** Salão: início do atendimento (ISO). Vazio nas outras lojas. */
    agendamento: z.string(),
    /** Total do pedido no momento da validação, para conferir o troco. */
    total: z.number(),
  })
  .superRefine((dados, contexto) => {
    const erro = (campo: string, message: string) =>
      contexto.addIssue({ code: "custom", path: [campo], message })

    if (dados.nome.trim().length < 2) erro("nome", "Diga como podemos te chamar")
    if (somenteDigitos(dados.whatsapp).length !== 11) erro("whatsapp", "Confira o número com DDD")

    if (lojaAtual().segmento === "salao" && !dados.agendamento) {
      erro("agendamento", "Escolha o dia e o horário")
    }

    if (dados.tipo === "entrega") {
      if (somenteDigitos(dados.cep).length !== 8) erro("cep", "Digite os 8 números do CEP")
      if (!dados.rua.trim()) erro("rua", "Informe a rua")
      if (!dados.numero.trim()) erro("numero", "Informe o número")
      if (!lojaAtual().entrega.bairros.some(({ nome }) => nome === dados.bairro))
        erro("bairro", "Escolha um bairro da lista")
    }

    if (dados.pagamento === "pix" && !cpf.isValid(dados.cpf)) erro("cpf", "Confira o CPF")
    if (dados.pagamento === "dinheiro" && dados.troco !== null && dados.troco < dados.total)
      erro("troco", `O troco precisa ser para ${emReais(dados.total)} ou mais`)
    if (dados.observacao.length > LIMITE_OBSERVACAO_PEDIDO)
      erro("observacao", "A observação ficou longa demais")
  })

export type DadosCheckout = z.infer<typeof esquemaCheckout>

/** Campos conferidos ao sair de cada passo. */
export const CAMPOS_DO_PASSO: Record<string, (keyof DadosCheckout)[]> = {
  dados: ["nome", "whatsapp"],
  entrega: ["cep", "rua", "numero", "bairro", "agendamento"],
  pagamento: ["cpf", "troco"],
  revisao: ["observacao"],
}

export type EnderecoCep = {
  rua: string
  bairro: string
  cidade: string
  uf: string
}

/** Busca o endereço pelo CEP no ViaCEP, o mesmo serviço que o site atual usa. */
export async function buscarCep(cep: string, sinal?: AbortSignal): Promise<EnderecoCep | null> {
  const resposta = await fetch(`https://viacep.com.br/ws/${somenteDigitos(cep)}/json/`, {
    signal: sinal,
  })
  if (!resposta.ok) return null
  const dados = (await resposta.json()) as {
    erro?: boolean
    logradouro?: string
    bairro?: string
    localidade?: string
    uf?: string
  }
  if (dados.erro) return null
  return {
    rua: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  }
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

/** Acha o bairro atendido pelo nome que veio do CEP, sem ligar para acento ou maiúscula. */
export function acharBairro(nome: string) {
  const alvo = normalizar(nome)
  return lojaAtual().entrega.bairros.find((bairro) => normalizar(bairro.nome) === alvo)
}

export function taxaDoBairro(nome: string): number | null {
  return lojaAtual().entrega.bairros.find((bairro) => bairro.nome === nome)?.taxa ?? null
}

/** Valores de troco que fazem sentido para o total: as próximas notas redondas. */
export function sugestoesDeTroco(total: number): number[] {
  const notas = [20, 50, 100, 150, 200]
  return notas.filter((nota) => nota > total).slice(0, 3)
}

/** Formulário do checkout já preenchido com o que a pessoa usou da última vez. */
export function valoresIniciais(lembrados: DadosLembrados | null): DadosCheckout {
  return {
    nome: "",
    whatsapp: "",
    tipo: "entrega",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    referencia: "",
    pagamento: "pix",
    ...lembrados,
    // Loja que não entrega (salão) atende no balcão, mesmo que da última vez tenha sido entrega.
    ...(lojaAtual().aceitaEntrega === false ? { tipo: "retirada" as const } : {}),
    agendamento: "",
    cpf: "",
    troco: null,
    observacao: "",
    total: 0,
  }
}

/** Endereço em uma linha, como aparece no pedido. */
export function montarEndereco(dados: DadosCheckout) {
  const complemento = dados.complemento.trim() ? `, ${dados.complemento.trim()}` : ""
  const cidade = dados.cidade.trim() ? ` · ${dados.cidade.trim()}/${dados.uf.toUpperCase()}` : ""
  const referencia = dados.referencia.trim() ? ` (${dados.referencia.trim()})` : ""
  return `${dados.rua.trim()}, ${dados.numero.trim()}${complemento} · ${dados.bairro}${cidade}${referencia}`
}

/** Taxa da entrega; `null` enquanto o bairro não é um dos atendidos. */
export function taxaDaEntrega(tipo: DadosCheckout["tipo"], bairro: string): number | null {
  return tipo === "retirada" ? 0 : taxaDoBairro(bairro)
}

/** O que o checkout manda para a sacola criar o pedido. */
export function dadosDoPedido(dados: DadosCheckout, taxa: number | null): DadosFinalizacao {
  return {
    taxaEntrega: taxa ?? 0,
    cliente: { nome: dados.nome.trim(), whatsapp: dados.whatsapp },
    tipo: dados.tipo,
    endereco: dados.tipo === "entrega" ? montarEndereco(dados) : lojaAtual().endereco,
    pagamento: dados.pagamento,
    troco: dados.pagamento === "dinheiro" ? dados.troco : null,
    observacao: dados.observacao.trim(),
  }
}

/** O que fica guardado no aparelho para o próximo pedido. */
export function dadosParaLembrar(dados: DadosCheckout): DadosLembrados {
  return {
    nome: dados.nome.trim(),
    whatsapp: dados.whatsapp,
    tipo: dados.tipo,
    cep: dados.cep,
    rua: dados.rua,
    numero: dados.numero,
    complemento: dados.complemento,
    bairro: dados.bairro,
    cidade: dados.cidade,
    uf: dados.uf,
    referencia: dados.referencia,
    pagamento: dados.pagamento,
  }
}
