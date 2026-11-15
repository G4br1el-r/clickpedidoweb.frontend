"use client"

import { type ComponentProps, createContext, type ReactNode, useContext } from "react"
import { MOVIMENTO_DO_MODAL, RAIO_DO_MODAL, VEU_DO_MODAL } from "@/components/modal"
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
  /** Classes extras da gaveta ou da janela (ex.: o movimento próprio de quem usa). */
  className?: string
  children: ReactNode
}

/** No celular sobe de baixo; do tablet para cima abre como janela central. */
export function Painel({
  aberto,
  aoMudar,
  altoFixo = false,
  testId,
  className,
  children,
}: PainelProps) {
  const telaGrande = useTelaGrande()

  return (
    <TelaGrandeContexto.Provider value={telaGrande}>
      {telaGrande ? (
        <Dialog open={aberto} onOpenChange={aoMudar}>
          <DialogContent
            showCloseButton={false}
            overlayClassName={VEU_DO_MODAL}
            data-testid={testId}
            onPointerDownOutside={manterToastClicavel}
            onInteractOutside={manterToastClicavel}
            onOpenAutoFocus={focarPainel}
            className={cn(
              "flex max-h-[88dvh] flex-col gap-0 overflow-hidden bg-popover p-0 text-base sm:max-w-[560px]",
              RAIO_DO_MODAL,
              altoFixo && "h-[min(760px,88dvh)]",
              MOVIMENTO_DO_MODAL,
              className,
            )}
          >
            {children}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={aberto} onOpenChange={aoMudar}>
          <DrawerContent
            overlayClassName={VEU_DO_MODAL}
            data-testid={testId}
            onPointerDownOutside={manterToastClicavel}
            onInteractOutside={manterToastClicavel}
            onOpenAutoFocus={focarPainel}
            className={cn(
              "w-full rounded-t-[20px] text-base data-[vaul-drawer-direction=bottom]:max-h-[90dvh]",
              altoFixo && "h-[90dvh]",
              MOVIMENTO_DO_MODAL,
              className,
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
