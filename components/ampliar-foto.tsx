"use client"

import { XIcon, ZoomInIcon } from "lucide-react"
import Image, { type StaticImageData } from "next/image"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type AmpliarFotoProps = {
  src: StaticImageData
  nome: string
  descricao?: string
  /** A miniatura que vira o botão de ampliar. */
  children: ReactNode
  className?: string
}

/**
 * Toque na foto e ela abre grande, no centro da tela, sobre um fundo escuro.
 * Fecha no X, no Esc ou tocando fora. A lupa aparece no hover para dizer que dá para ampliar.
 */
export function AmpliarFoto({ src, nome, descricao, children, className }: AmpliarFotoProps) {
  // A dica fica quieta com a foto aberta e logo depois de fechar, quando o foco volta à miniatura.
  const [aberta, setAberta] = useState(false)
  const [recemFechada, setRecemFechada] = useState(false)
  const pausa = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pausa.current) clearTimeout(pausa.current)
    },
    [],
  )
  function mudarAberta(valor: boolean) {
    setAberta(valor)
    if (pausa.current) clearTimeout(pausa.current)
    if (!valor) {
      setRecemFechada(true)
      pausa.current = setTimeout(() => setRecemFechada(false), 700)
    }
  }

  return (
    <Dialog open={aberta} onOpenChange={mudarAberta}>
      <Dica texto="Ampliar foto" desligada={aberta || recemFechada}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Ampliar foto de ${nome}`}
            data-testid="ampliar-foto"
            className={cn(
              "group/foto relative z-10 shrink-0 cursor-zoom-in overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          >
            {children}
            <span
              aria-hidden="true"
              className="absolute right-1.5 bottom-1.5 grid size-7 scale-90 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-200 ease-saida group-hover/foto:scale-100 group-hover/foto:opacity-100 group-focus-visible/foto:scale-100 group-focus-visible/foto:opacity-100"
            >
              <ZoomInIcon className="size-3.5" />
            </span>
          </button>
        </DialogTrigger>
      </Dica>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/80! backdrop-blur-sm"
        data-testid="foto-ampliada"
        className="w-[min(92vw,820px)] max-w-none! gap-3 bg-transparent! p-0! ring-0! duration-300! data-open:zoom-in-90!"
      >
        <div className="relative overflow-hidden rounded-3xl bg-muted shadow-2xl">
          <Image
            src={src}
            alt={nome}
            placeholder="blur"
            sizes="(min-width: 900px) 820px, 92vw"
            className="h-auto max-h-[76dvh] w-full object-cover"
          />
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="toque"
              aria-label="Fechar foto"
              className="absolute top-3 right-3 rounded-full bg-background/85 backdrop-blur-md"
            >
              <XIcon />
            </Button>
          </DialogClose>
        </div>
        <div className="px-1 text-white">
          <DialogTitle className="font-heading text-lg font-bold md:text-xl">{nome}</DialogTitle>
          {descricao ? (
            <DialogDescription className="mt-1 text-sm text-white/75">
              {descricao}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Foto ampliada de {nome}</DialogDescription>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
