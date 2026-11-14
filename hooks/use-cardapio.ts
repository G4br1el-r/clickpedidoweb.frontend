import { useQuery } from "@tanstack/react-query"
import { buscarCardapio, useLojaAtual } from "@/lib/loja-atual"

/** Cardápio da loja escolhida no topo. Só busca depois de ler a loja salva neste navegador. */
export function useCardapio() {
  const id = useLojaAtual((estado) => estado.id)
  const hidratada = useLojaAtual((estado) => estado.hidratada)
  return useQuery({
    queryKey: ["cardapio", id],
    queryFn: () => buscarCardapio(id),
    enabled: hidratada,
  })
}
