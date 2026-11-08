type EventoFora = {
  target: EventTarget | null
  detail?: { originalEvent?: { target?: EventTarget | null } }
  preventDefault: () => void
}

/** Clicar em "Desfazer" no toast não pode fechar o painel que está aberto. */
export function manterToastClicavel(evento: EventoFora) {
  const alvo = evento.detail?.originalEvent?.target ?? evento.target
  if (alvo instanceof Element && alvo.closest("[data-sonner-toaster]")) {
    evento.preventDefault()
  }
}
