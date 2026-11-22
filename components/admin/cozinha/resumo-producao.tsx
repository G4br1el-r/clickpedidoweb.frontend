"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Produto } from "@/lib/admin/dados/tipos"
import type { LinhaDeProducao } from "@/lib/admin/regras/producao"
import { cn } from "@/lib/utils"

type Props = {
  linhas: LinhaDeProducao[]
  /** Os produtos do cardápio: o "Acabou" só aparece no que ainda está à venda. */
  produtos: Produto[]
  esgotados: Produto[]
  /** A linha tocada: os tickets dela ficam em destaque. */
  destaque: string | null
  aoDestacar: (chave: string | null) => void
  aoAcabar: (produto: { id: string; nome: string }) => void
  aoVoltar: (produto: { id: string; nome: string }) => void
}

/**
 * O que a cozinha tem para fazer, somado por produto, e o que está esgotado. Serve ao
 * painel do desktop e à gaveta do celular.
 */
export function ResumoProducao({
  linhas,
  produtos,
  esgotados,
  destaque,
  aoDestacar,
  aoAcabar,
  aoVoltar,
}: Props) {
  const aVenda = (id: string | null) =>
    produtos.find((produto) => produto.id === id && produto.disponivel)
  return (
    <Tabs defaultValue="producao" className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="producao" className="text-foreground/80 dark:text-foreground/80">
          Em produção
        </TabsTrigger>
        <TabsTrigger value="esgotados" className="text-foreground/80 dark:text-foreground/80">
          Esgotados
          <span className="text-xs tabular-nums">{esgotados.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="producao">
        <ul className="flex flex-col divide-y divide-border/70">
          {linhas.map((linha) => {
            const produto = aVenda(linha.produtoId)
            const ativa = destaque === linha.chave
            return (
              <li key={linha.chave} className="flex items-center gap-2 py-1.5">
                <button
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => aoDestacar(ativa ? null : linha.chave)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    ativa && "bg-muted font-medium",
                  )}
                >
                  <span className="font-semibold tabular-nums">{linha.quantidade}×</span>{" "}
                  {linha.nome}
                </button>
                {produto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Acabou: ${produto.nome}`}
                    onClick={() => aoAcabar(produto)}
                  >
                    Acabou
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </TabsContent>
      <TabsContent value="esgotados">
        <ul className="flex flex-col divide-y divide-border/70">
          {esgotados.map((produto) => (
            <li key={produto.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate px-2 text-sm">{produto.nome}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Voltou: ${produto.nome}`}
                onClick={() => aoVoltar(produto)}
              >
                Voltou
              </Button>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  )
}
