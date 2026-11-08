import { queryOptions, useQuery } from "@tanstack/react-query"
import { buscarCardapio } from "@/lib/cliente"

export const opcoesCardapio = queryOptions({
  queryKey: ["cardapio"],
  queryFn: buscarCardapio,
})

export function useCardapio() {
  return useQuery(opcoesCardapio)
}
