"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useAlternarProduto, useExcluirProduto } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import {
  type AcaoDoLote,
  alternarMarca,
  campoDaAcao,
  marcarVarios,
  textoDoResultado,
} from "@/lib/admin/regras/lote-cardapio"

/**
 * Seleção e ações em lote do cardápio. As regras (quem muda, textos) ficam em `lote-cardapio`;
 * aqui só se liga a seleção às mutações que já existem: uma por produto, em sequência.
 * Se alguma falhar, as outras seguem, o aviso conta quantas e as que falharam continuam
 * marcadas para tentar de novo.
 */
export function useLoteCardapio() {
  const alternar = useAlternarProduto()
  const excluir = useExcluirProduto()
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())
  const [aplicando, setAplicando] = useState<AcaoDoLote | null>(null)

  const marcar = useCallback((id: string) => setMarcados((atual) => alternarMarca(atual, id)), [])
  const marcarTodos = useCallback(
    (ids: string[], marcarOuNao: boolean) =>
      setMarcados((atual) => marcarVarios(atual, ids, marcarOuNao)),
    [],
  )
  const limpar = useCallback(() => setMarcados(new Set()), [])

  const aplicar = useCallback(
    async (acao: AcaoDoLote, lote: Produto[]) => {
      const campo = campoDaAcao(acao)
      setAplicando(acao)
      // Um de cada vez, na ordem da lista: o servidor grava a lista inteira a cada troca, e duas
      // trocas ao mesmo tempo se atropelariam. A linha de cada produto muda assim que a troca chega.
      const falhou = new Set<string>()
      for (const produto of lote) {
        try {
          if (campo) await alternar.mutateAsync({ id: produto.id, campo })
          else await excluir.mutateAsync(produto.id)
        } catch {
          falhou.add(produto.id)
        }
      }
      const { sucesso, erro } = textoDoResultado(acao, lote.length - falhou.size, falhou.size)
      if (sucesso) toast.success(sucesso)
      if (erro) toast.error(erro)
      setMarcados(falhou)
      setAplicando(null)
    },
    [alternar, excluir],
  )

  return { marcados, marcar, marcarTodos, limpar, aplicando, aplicar }
}
