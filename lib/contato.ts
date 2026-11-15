/** Link de ligação: só os números, com o código do Brasil. */
export function linkDoTelefone(telefone: string): string {
  return `tel:+55${telefone.replace(/\D/g, "")}`
}

/** Abre o endereço na busca do mapa, no app ou no navegador. */
export function linkDoMapa(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
}
