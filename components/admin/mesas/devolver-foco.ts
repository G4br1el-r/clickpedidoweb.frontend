/**
 * A janela aberta pelo menu ⋯ não tem gatilho próprio: ao fechar, o Radix deixaria o foco no
 * corpo da página. Com o elemento, o foco volta para ele (o botão ⋯ da mesa).
 */
export const devolverFocoA = (elemento: HTMLElement | null | undefined) =>
  elemento
    ? (evento: Event) => {
        evento.preventDefault()
        elemento.focus()
      }
    : undefined
