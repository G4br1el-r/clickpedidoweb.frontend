"use client"

import { type FocusEvent, useEffect, useRef } from "react"
import { type FocoPrevia, usePrevia } from "./estado"

/** Quanto esperar ao sair do item, para o aviso não piscar entre um item e o vizinho. */
const ESPERA_SOLTAR_MS = 300

/**
 * Liga um item do editor à marca de foco da prévia: passar o mouse, focar pelo teclado ou
 * mexer no item mostra na prévia onde ele fica. Devolve os eventos para espalhar no item
 * e `avisar`, para chamar quando o item muda (ligar, desligar, trocar a exibição).
 */
export function useFocoNaPrevia(foco: FocoPrevia) {
  const focar = usePrevia((estado) => estado.focar)
  const soltar = usePrevia((estado) => estado.soltar)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  const atual = useRef(foco)
  atual.current = foco

  const cancelar = () => {
    if (espera.current) clearTimeout(espera.current)
    espera.current = null
  }
  const avisar = (mudancas: Partial<FocoPrevia> = {}) => {
    cancelar()
    focar({ ...atual.current, ...mudancas })
  }
  const sair = () => {
    cancelar()
    espera.current = setTimeout(() => soltar(atual.current.alvo), ESPERA_SOLTAR_MS)
  }

  // Se o item muda enquanto está em foco (ex.: foi desligado), o aviso acompanha.
  const { alvo, secao, rotulo, desligado } = foco
  useEffect(() => {
    if (usePrevia.getState().foco?.alvo !== alvo) return
    focar(desligado === undefined ? { alvo, secao, rotulo } : { alvo, secao, rotulo, desligado })
  }, [alvo, secao, rotulo, desligado, focar])

  // Ao sair da tela, não deixa uma soltura pendente para trás.
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current)
    },
    [],
  )

  return {
    avisar,
    eventos: {
      onPointerEnter: () => avisar(),
      onPointerLeave: sair,
      onFocus: () => avisar(),
      onBlur: (evento: FocusEvent<HTMLElement>) => {
        // O foco só passou para outro controle do mesmo item.
        if (evento.currentTarget.contains(evento.relatedTarget as Node | null)) return
        sair()
      },
    },
  }
}
