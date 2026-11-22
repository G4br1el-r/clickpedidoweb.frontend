/**
 * O endereço da vitrine em modo mesa: a loja é o segmento do painel e a mesa vai pelo id, para o
 * QR de uma mesa excluída não abrir a mesa nova com o mesmo número.
 */
export function urlDaMesa(origem: string, segmento: string, mesaId: string): string {
  const parametros = new URLSearchParams({ loja: segmento, mesa: mesaId })
  return `${origem}/mesa?${parametros}`
}
