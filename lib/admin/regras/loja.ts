import { addDays, isSameDay } from "date-fns"
import type { Bairro, ConfigLoja, HorarioFuncionamento, Pedido, Prazo } from "../dados/tipos"

const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
/** A semana do texto começa na segunda, como se fala. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

const passaDaMeiaNoite = (horario: HorarioFuncionamento) =>
  minutos(horario.fecha) <= minutos(horario.abre)

/**
 * Se a loja está aberta agora. No controle manual, vale a chave; pelo horário, conta
 * também o expediente de ontem que passou da meia-noite (18h às 2h).
 */
export function lojaAbertaAgora(loja: ConfigLoja, agora: Date): boolean {
  if (!loja.controleAutomatico) return loja.aberta
  const agoraMin = agora.getHours() * 60 + agora.getMinutes()
  const doDia = (dia: number) => loja.horarios.find((item) => item.dia === dia)

  const hoje = doDia(agora.getDay())
  if (hoje?.aberto) {
    const abre = minutos(hoje.abre)
    if (
      passaDaMeiaNoite(hoje) ? agoraMin >= abre : agoraMin >= abre && agoraMin < minutos(hoje.fecha)
    ) {
      return true
    }
  }
  const ontem = doDia(addDays(agora, -1).getDay())
  return Boolean(ontem?.aberto && passaDaMeiaNoite(ontem) && agoraMin < minutos(ontem.fecha))
}

/** "09:00" vira "9h"; "23:30" vira "23h30". */
function hora(texto: string) {
  const [h, m] = texto.split(":").map(Number)
  return `${h}h${m ? String(m).padStart(2, "0") : ""}`
}

/**
 * Texto do horário para o site e o WhatsApp, a partir dos dias:
 * "Terça a sábado, das 9h às 19h; domingo, das 11h às 15h".
 */
export function textoDoHorario(horarios: HorarioFuncionamento[]): string {
  const abertos = ORDEM.map((dia) => horarios.find((item) => item.dia === dia)).filter(
    (item): item is HorarioFuncionamento => Boolean(item?.aberto),
  )
  if (abertos.length === 0) return "Fechado"

  // Grupos de dias seguidos (na ordem da semana) com o mesmo horário.
  const grupos: HorarioFuncionamento[][] = []
  for (const dia of abertos) {
    const ultimo = grupos.at(-1)
    const anterior = ultimo?.at(-1)
    const seguido = anterior && ORDEM.indexOf(dia.dia) === ORDEM.indexOf(anterior.dia) + 1
    if (
      ultimo &&
      anterior &&
      seguido &&
      anterior.abre === dia.abre &&
      anterior.fecha === dia.fecha
    ) {
      ultimo.push(dia)
    } else {
      grupos.push([dia])
    }
  }

  const partes = grupos.map((grupo) => {
    const [primeiro] = grupo
    const ultimo = grupo.at(-1) as HorarioFuncionamento
    let dias = NOMES[primeiro.dia]
    if (grupo.length === 7) dias = "todos os dias"
    else if (grupo.length === 2) dias = `${NOMES[primeiro.dia]} e ${NOMES[ultimo.dia]}`
    else if (grupo.length > 2) dias = `${NOMES[primeiro.dia]} a ${NOMES[ultimo.dia]}`
    return `${dias}, das ${hora(primeiro.abre)} às ${hora(primeiro.fecha)}`
  })
  const texto = partes.join("; ")
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Os outros dias ficam com o mesmo horário (e aberto ou fechado) do dia escolhido. */
export function copiarParaTodos(
  horarios: HorarioFuncionamento[],
  dia: number,
): HorarioFuncionamento[] {
  const modelo = horarios.find((item) => item.dia === dia)
  if (!modelo) return horarios
  return horarios.map((item) => ({ ...modelo, dia: item.dia }))
}

/** Taxa do pedido: a do bairro, se ele estiver ativo; senão, a taxa padrão da loja. */
export function taxaDeEntrega(
  bairros: Bairro[],
  bairroId: string | undefined,
  taxaPadrao: number,
): number {
  const bairro = bairros.find((item) => item.id === bairroId && item.ativo)
  return bairro ? bairro.taxa : taxaPadrao
}

/** Entregas de cada motoboy no dia: as concluídas e as que estão na rua. */
export function entregasDoDia(pedidos: Pedido[], dia: Date): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const pedido of pedidos) {
    const conta = pedido.status === "concluido" || pedido.status === "saiu-para-entrega"
    if (pedido.tipo !== "entrega" || !pedido.motoboyId || !conta) continue
    if (!isSameDay(new Date(pedido.criadoEm), dia)) continue
    contagem.set(pedido.motoboyId, (contagem.get(pedido.motoboyId) ?? 0) + 1)
  }
  return contagem
}

/** "35–50 min", ou "15 min" quando o mínimo e o máximo são iguais. */
export const textoDoPrazo = ({ min, max }: Prazo): string =>
  min === max ? `${min} min` : `${min}–${max} min`
