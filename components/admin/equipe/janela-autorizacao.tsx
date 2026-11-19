"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEquipe } from "@/lib/admin/dados/consultas-equipe"
import type { Autorizacao } from "@/lib/admin/dados/tipos"
import { type AcaoSensivel, podeAutorizar } from "@/lib/admin/regras/equipe"
import { EscolherPessoa } from "./escolher-pessoa"
import { TecladoPin } from "./teclado-pin"

const DESCRICAO: Record<AcaoSensivel, string> = {
  sangria: "A sangria precisa do PIN de um gerente.",
  "reabrir-caixa": "Reabrir o caixa precisa do PIN de um gerente.",
}

/**
 * Um gerente (ou o dono) autoriza com o PIN dele, sem trocar quem está usando o
 * painel. Se a ação recusar, o erro aparece e o PIN é limpo.
 */
export function JanelaAutorizacao({
  aberta,
  acao,
  aoFechar,
  aoAutorizar,
}: {
  aberta: boolean
  acao: AcaoSensivel
  aoFechar: () => void
  aoAutorizar: (autorizacao: Autorizacao) => Promise<void>
}) {
  if (!aberta) return null
  return <Conteudo acao={acao} aoFechar={aoFechar} aoAutorizar={aoAutorizar} />
}

function Conteudo({
  acao,
  aoFechar,
  aoAutorizar,
}: {
  acao: AcaoSensivel
  aoFechar: () => void
  aoAutorizar: (autorizacao: Autorizacao) => Promise<void>
}) {
  const id = useId()
  const { data: equipe = [] } = useEquipe()
  const [membroId, setMembroId] = useState("")
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const pronto = Boolean(membroId) && pin.length >= 4 && !enviando

  async function autorizar() {
    if (!pronto) return
    setErro(undefined)
    setEnviando(true)
    try {
      await aoAutorizar({ membroId, pin })
      aoFechar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não deu para autorizar.")
      setPin("")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Autorização do gerente</DialogTitle>
          <DialogDescription>{DESCRICAO[acao]}</DialogDescription>
        </DialogHeader>
        <EscolherPessoa
          id={`${id}-quem`}
          rotulo="Quem autoriza"
          pessoas={equipe.filter(podeAutorizar)}
          valor={membroId}
          aoMudar={setMembroId}
        />
        <TecladoPin
          id={`${id}-pin`}
          rotulo="PIN do gerente"
          valor={pin}
          aoMudar={setPin}
          aoConfirmar={autorizar}
        />
        {erro && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button type="button" className="w-full" disabled={!pronto} onClick={autorizar}>
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
