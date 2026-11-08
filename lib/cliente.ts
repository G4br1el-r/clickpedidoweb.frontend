import { cardapioCasaDaPizza, casaDaPizza } from "./mock/casa-da-pizza"

/**
 * Um código só para todos os clientes: aqui entra a escolha do cliente.
 * Por enquanto o protótipo usa apenas a pizzaria.
 */
export const clienteAtual = casaDaPizza

/** Simula uma API para exercitar os estados de carregamento das telas. */
export async function buscarCardapio() {
  await new Promise((resolver) => setTimeout(resolver, 450))
  return cardapioCasaDaPizza
}
