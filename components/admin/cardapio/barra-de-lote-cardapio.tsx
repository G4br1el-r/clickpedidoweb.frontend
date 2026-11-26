"use client"

import {
  CircleCheckIcon,
  CircleOffIcon,
  EyeIcon,
  EyeOffIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Produto } from "@/lib/admin/dados/tipos"
import {
  type AcaoDoLote,
  produtosQueMudam,
  textoDaConfirmacaoDeExclusao,
  textoDoLoteDeProdutos,
} from "@/lib/admin/regras/lote-cardapio"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { BlocoEntrando } from "../movimento/entrada-admin"

const ACOES: { acao: Exclude<AcaoDoLote, "excluir">; rotulo: string; Icone: typeof EyeIcon }[] = [
  { acao: "disponivel", rotulo: "Disponível", Icone: CircleCheckIcon },
  { acao: "indisponivel", rotulo: "Indisponível", Icone: CircleOffIcon },
  { acao: "visivel", rotulo: "Visível", Icone: EyeIcon },
  { acao: "oculto", rotulo: "Oculto", Icone: EyeOffIcon },
]

/**
 * Barra que aparece quando há produtos marcados: troca disponibilidade ou visibilidade de
 * todos de uma vez, ou exclui (com confirmação). Cada ação só manda quem de fato muda; a que
 * não muda ninguém fica desligada. Cola na parte de baixo da tela, ao alcance do polegar.
 */
export function BarraDeLoteCardapio({
  selecionados,
  aoAplicar,
  aoLimpar,
  aplicando = null,
}: {
  selecionados: Produto[]
  aoAplicar: (acao: AcaoDoLote, produtos: Produto[]) => void
  aoLimpar: () => void
  /** A ação em andamento: mostra o carregamento nela e trava a barra. */
  aplicando?: AcaoDoLote | null
}) {
  const [confirmando, setConfirmando] = useState(false)
  const ocupado = aplicando !== null
  const confirmacao = textoDaConfirmacaoDeExclusao(selecionados)
  return (
    <AnimatePresence>
      {selecionados.length > 0 && (
        <BlocoEntrando
          key="barra-de-lote-cardapio"
          role="region"
          aria-label="Ações em lote"
          className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:px-4"
        >
          <div className="flex items-center justify-between gap-3 sm:contents">
            <p className="text-sm font-medium tabular-nums sm:mr-1">
              {textoDoLoteDeProdutos(selecionados.length)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-md:h-11 sm:order-last sm:ml-auto"
              disabled={ocupado}
              onClick={aoLimpar}
            >
              <XIcon data-icon="inline-start" />
              Limpar seleção
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {ACOES.map(({ acao, rotulo, Icone }) => (
              <BotaoCarregando
                key={acao}
                type="button"
                variant="outline"
                size="sm"
                className="max-md:h-11"
                carregando={aplicando === acao}
                rotuloCarregando="Aplicando no cardápio"
                disabled={ocupado || produtosQueMudam(selecionados, acao).length === 0}
                onClick={() => aoAplicar(acao, produtosQueMudam(selecionados, acao))}
              >
                <Icone data-icon="inline-start" />
                {rotulo}
              </BotaoCarregando>
            ))}
            <BotaoCarregando
              type="button"
              variant="destructive"
              size="sm"
              className="max-md:col-span-2 max-md:h-11"
              carregando={aplicando === "excluir"}
              rotuloCarregando="Excluindo do cardápio"
              disabled={ocupado}
              onClick={() => setConfirmando(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Excluir
            </BotaoCarregando>
          </div>

          <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmacao.titulo}</AlertDialogTitle>
                <AlertDialogDescription>{confirmacao.descricao}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => aoAplicar("excluir", selecionados)}
                >
                  Sim, excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </BlocoEntrando>
      )}
    </AnimatePresence>
  )
}
