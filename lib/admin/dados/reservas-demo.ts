import { addMinutes, format, isSameDay } from "date-fns"
import type { EntradaEspera, Mesa, Reserva } from "./tipos"

/** Arredonda para baixo, no múltiplo de tantos minutos: 20:53 de 5 em 5 é 20:50. */
function arredondar(momento: Date, minutos: number): Date {
  const passo = minutos * 60_000
  return new Date(Math.floor(momento.getTime() / passo) * passo)
}

/**
 * As reservas e a espera da demonstração no dia de `agora`, relativas à hora de gerar: a Marina
 * daqui a pouco na mesa 13 (se ela estiver livre para isso), o Roberto mais tarde sem mesa e três
 * pessoas na fila. Os ids levam a data: o dia seguinte não repete.
 */
export function reservasDemo(
  mesas: Mesa[],
  agora: Date,
): { reservas: Reserva[]; espera: EntradaEspera[] } {
  const dia = format(agora, "yyyyMMdd")
  const treze = mesas.find((mesa) => mesa.id === "mesa-13")
  const trezeLivre = treze && treze.status === "livre" && !treze.bloqueio && !treze.juntadaCom
  const reservas: Reserva[] = [
    {
      id: `reserva-${dia}-1`,
      nome: "Marina Costa",
      telefone: "12991234567",
      inicio: arredondar(addMinutes(agora, 20), 5).toISOString(),
      pessoas: 2,
      ...(trezeLivre ? { mesaId: "mesa-13" } : {}),
      status: "marcada",
    },
    {
      id: `reserva-${dia}-2`,
      nome: "Roberto Andrade",
      telefone: "12997654321",
      inicio: arredondar(addMinutes(agora, 120), 15).toISOString(),
      pessoas: 6,
      status: "marcada",
    },
  ]
  const ha = (minutos: number) => addMinutes(agora, -minutos).toISOString()
  return {
    // A que cairia depois da meia-noite não é de hoje.
    reservas: reservas.filter((reserva) => isSameDay(new Date(reserva.inicio), agora)),
    espera: [
      {
        id: `espera-${dia}-1`,
        nome: "Carlos Mendes",
        pessoas: 2,
        telefone: "12998761234",
        chegouEm: ha(25),
        chamadaEm: ha(2),
        status: "esperando",
      },
      {
        id: `espera-${dia}-2`,
        nome: "Juliana Rocha",
        pessoas: 4,
        chegouEm: ha(12),
        status: "esperando",
      },
      {
        id: `espera-${dia}-3`,
        nome: "Pedro Alves",
        pessoas: 5,
        telefone: "12996543210",
        chegouEm: ha(5),
        status: "esperando",
      },
    ],
  }
}
