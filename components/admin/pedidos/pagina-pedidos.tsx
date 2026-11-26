"use client"

import { toast } from "sonner"
import { useAvancarPedido, useMotoboys, usePedidos } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { EsqueletoLista } from "../esqueletos"
import { FiltroPeriodo, usePeriodo } from "../visao-geral/filtro-periodo"
import { DetalhesPedido } from "./detalhes-pedido"
import { ListaPedidos } from "./lista-pedidos"

/** Pedidos do período, com busca, filtros, avanço em lote e os detalhes abrindo por cima da lista. */
export function PaginaPedidos() {
  const { periodo } = usePeriodo()
  const { data: pedidos } = usePedidos(periodo ? { de: periodo.de, ate: periodo.ate } : undefined, {
    ativo: Boolean(periodo),
  })
  const { data: motoboys } = useMotoboys()
  const avancar = useAvancarPedido()

  /** Um de cada vez, na ordem da lista: se um falhar, os outros seguem e o aviso conta quantos. */
  const avancarLote = async (lote: Pedido[]) => {
    let avancados = 0
    let falhas = 0
    for (const pedido of lote) {
      try {
        await avancar.mutateAsync({ id: pedido.id, de: pedido.status })
        avancados += 1
      } catch {
        falhas += 1
      }
    }
    if (avancados > 0) toast.success(`${plural(avancados, "pedido avançou", "pedidos avançaram")}.`)
    if (falhas > 0) {
      toast.error(
        `${plural(falhas, "pedido não avançou", "pedidos não avançaram")}. Confira e tente de novo.`,
      )
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Pedidos"
        resumo="Toque num pedido para ver os detalhes, avançar ou chamar o motoboy. Marque vários para avançar de uma vez."
      />
      <FiltroPeriodo />
      {pedidos ? (
        <ListaPedidos
          pedidos={pedidos}
          motoboys={motoboys}
          aoAvancarLote={avancarLote}
          avancandoLote={avancar.isPending}
        />
      ) : (
        <EsqueletoLista rotulo="Carregando pedidos" linhas={8} />
      )}
      <DetalhesPedido />
    </div>
  )
}
