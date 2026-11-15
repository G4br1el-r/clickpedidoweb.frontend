"use client"

import { useState } from "react"
import { toast } from "sonner"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useDefinirAberta } from "@/lib/admin/dados/consultas"
import type { ConfigLoja } from "@/lib/admin/dados/tipos"
import { lojaAbertaAgora } from "@/lib/admin/regras/loja"

/**
 * Chave de abrir e fechar a loja. Com o horário automático ligado, mostra o estado pelo
 * horário e pergunta antes de passar para o manual (nas lojas, desligava sem avisar).
 */
export function ChaveDaLoja({ loja, agora }: { loja: ConfigLoja | undefined; agora: Date | null }) {
  const definirAberta = useDefinirAberta()
  const [pergunta, setPergunta] = useState<boolean | null>(null)
  const aberta = loja ? (agora ? lojaAbertaAgora(loja, agora) : loja.aberta) : false
  const automatico = loja?.controleAutomatico ?? false

  const definir = (nova: boolean) =>
    definirAberta.mutate(nova, {
      onSuccess: () =>
        toast(nova ? "Loja aberta para pedidos." : "Loja fechada. O cardápio continua visível."),
      onError: (erro) => toast.error(erro.message),
    })

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="loja-aberta"
        checked={aberta}
        onCheckedChange={(nova) => (automatico ? setPergunta(nova) : definir(nova))}
      />
      <Label htmlFor="loja-aberta" className="cursor-pointer">
        Loja aberta
      </Label>
      {automatico && <span className="text-[13px] text-muted-foreground">Pelo horário</span>}

      <AlertDialog open={pergunta !== null} onOpenChange={(aberto) => !aberto && setPergunta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passar para o controle manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Hoje a loja abre e fecha sozinha pelo horário. Mexer na chave desliga o horário
              automático; dá para religar em Configurações da loja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Deixar pelo horário</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pergunta !== null) definir(pergunta)
                setPergunta(null)
              }}
            >
              {pergunta ? "Abrir" : "Fechar"} e passar para o manual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
