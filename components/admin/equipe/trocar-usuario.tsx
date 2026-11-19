"use client"

import { UserRoundIcon } from "lucide-react"
import { useId, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEntrar, useEquipe, useUsuarioAtual } from "@/lib/admin/dados/consultas-equipe"
import { TITULO_PERFIL } from "@/lib/admin/regras/equipe"
import { EscolherPessoa } from "./escolher-pessoa"
import { TecladoPin } from "./teclado-pin"

/** No topo: quem está usando o painel. Clicar ou `Ctrl+U` troca de pessoa com o PIN. */
export function TrocarUsuario() {
  const { membro } = useUsuarioAtual()
  const [aberta, setAberta] = useState(false)
  useHotkeys("ctrl+u", () => setAberta(true), { preventDefault: true, enableOnFormTags: true })

  if (!membro) return null
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Trocar usuário (Ctrl+U)"
        onClick={() => setAberta(true)}
        className="max-w-48 gap-1.5"
      >
        <UserRoundIcon data-icon="inline-start" />
        <span className="truncate">
          {membro.nome} · {TITULO_PERFIL[membro.perfil]}
        </span>
      </Button>
      {aberta && <JanelaTrocar aoFechar={() => setAberta(false)} atual={membro.id} />}
    </>
  )
}

function JanelaTrocar({ aoFechar, atual }: { aoFechar: () => void; atual: string }) {
  const id = useId()
  const { data: equipe = [] } = useEquipe()
  const entrar = useEntrar()
  const [pessoa, setPessoa] = useState("")
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState<string>()
  const pronto = Boolean(pessoa) && pin.length >= 4 && !entrar.isPending

  function confirmar() {
    if (!pronto) return
    setErro(undefined)
    entrar.mutate(
      { id: pessoa, pin },
      {
        onSuccess: aoFechar,
        onError: (falha) => {
          setErro(falha.message)
          setPin("")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Trocar usuário</DialogTitle>
          <DialogDescription>Escolha quem vai usar o painel e digite o PIN.</DialogDescription>
        </DialogHeader>
        <EscolherPessoa
          id={`${id}-pessoa`}
          rotulo="Pessoa"
          pessoas={equipe.filter((membro) => membro.ativo && membro.id !== atual)}
          valor={pessoa}
          aoMudar={setPessoa}
        />
        <TecladoPin
          id={`${id}-pin`}
          rotulo="PIN"
          valor={pin}
          aoMudar={setPin}
          aoConfirmar={confirmar}
        />
        {erro && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button type="button" className="w-full" disabled={!pronto} onClick={confirmar}>
            Entrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
