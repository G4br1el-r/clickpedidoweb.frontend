"use client"

import { type ComponentProps, createContext, type ReactNode, useContext } from "react"
import { focarPainel } from "@/components/sacola/ilha-sacola"
import { manterToastClicavel } from "@/components/sacola/manter-toast-clicavel"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { cn } from "@/lib/utils"

const TelaGrandeContexto = createContext(false)

type PainelProps = {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Altura fixa, para o painel não pular entre passos de tamanhos diferentes. */
  altoFixo?: boolean
  testId?: string
  children: ReactNode
}

/** No celular sobe de baixo; do tablet para cima abre como janela central. */
export function Painel({ aberto, aoMudar, altoFixo = false, testId, children }: PainelProps) {
  const telaGrande = useTelaGrande()

  return (
    <TelaGrandeContexto.Provider value={telaGrande}>
      {telaGrande ? (
        <Dialog open={aberto} onOpenChange={aoMudar}>
          <DialogContent
            showCloseButton={false}
            data-testid={testId}
            onPointerDownOutside={manterToastClicavel}
            onInteractOutside={manterToastClicavel}
            onOpenAutoFocus={focarPainel}
            className={cn(
              "flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-2xl bg-popover p-0 text-base sm:max-w-[560px]",
              altoFixo && "h-[min(760px,88dvh)]",
            )}
          >
            {children}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={aberto} onOpenChange={aoMudar}>
          <DrawerContent
            data-testid={testId}
            onPointerDownOutside={manterToastClicavel}
            onInteractOutside={manterToastClicavel}
            onOpenAutoFocus={focarPainel}
            className={cn(
              "w-full rounded-t-2xl text-base data-[vaul-drawer-direction=bottom]:max-h-[90dvh]",
              altoFixo && "h-[90dvh]",
            )}
          >
            {children}
          </DrawerContent>
        </Drawer>
      )}
    </TelaGrandeContexto.Provider>
  )
}

export function PainelTitulo(props: ComponentProps<typeof DrawerTitle>) {
  return useContext(TelaGrandeContexto) ? <DialogTitle {...props} /> : <DrawerTitle {...props} />
}

export function PainelDescricao(props: ComponentProps<typeof DrawerDescription>) {
  return useContext(TelaGrandeContexto) ? (
    <DialogDescription {...props} />
  ) : (
    <DrawerDescription {...props} />
  )
}

export function PainelFechar(props: ComponentProps<typeof DrawerClose>) {
  return useContext(TelaGrandeContexto) ? <DialogClose {...props} /> : <DrawerClose {...props} />
}
