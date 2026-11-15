"use client"

import {
  BeefIcon,
  ChevronsUpDownIcon,
  PillIcon,
  PizzaIcon,
  SandwichIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  WineIcon,
} from "lucide-react"
import { useState } from "react"
import { MOVIMENTO_DO_MODAL, RAIO_DO_MODAL, VEU_DO_MODAL } from "@/components/modal"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { plural } from "@/lib/formato"
import { ehLojaId, LOJAS, type LojaId, useLoja, useLojaAtual } from "@/lib/loja-atual"
import { contarItens, type ItemSacola, useSacola } from "@/lib/sacola"
import { type SegmentoId, segmentos } from "@/lib/segmentos"
import { cn } from "@/lib/utils"

/** Lista fixa: um `[]` novo a cada leitura faria o zustand renderizar sem parar. */
const SEM_ITENS: ItemSacola[] = []

const ICONES: Record<SegmentoId, typeof PizzaIcon> = {
  pizzaria: PizzaIcon,
  farmacia: PillIcon,
  adega: WineIcon,
  acougue: BeefIcon,
  salao: ScissorsIcon,
  lanchonete: SandwichIcon,
}

/**
 * Troca a loja que a vitrine mostra (demonstração). A sacola é de uma loja só: com itens nela,
 * pergunta antes de esvaziar.
 */
export function SeletorLoja({ className }: { className?: string }) {
  const loja = useLoja()
  const escolher = useLojaAtual((estado) => estado.escolher)
  const itens = useSacola((estado) => (estado.hidratada ? estado.itens : SEM_ITENS))
  const esvaziar = useSacola((estado) => estado.esvaziar)
  const [pendente, setPendente] = useState<LojaId | null>(null)
  const Icone = ICONES[loja.segmento]
  const destino = LOJAS.find((item) => item.loja.id === pendente)?.loja

  function trocar(id: LojaId) {
    if (id === loja.id) return
    if (itens.length > 0) setPendente(id)
    else escolher(id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Loja: ${loja.nome}`}
            className={cn("h-11 gap-1.5 rounded-full px-3", className)}
          >
            <Icone data-icon="inline-start" />
            <span className="hidden max-w-40 truncate sm:inline">{loja.nome}</span>
            <ChevronsUpDownIcon className="opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Ver a loja de demonstração
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={loja.id}
            onValueChange={(valor) => {
              if (ehLojaId(valor)) trocar(valor)
            }}
          >
            {LOJAS.map(({ loja: opcao }) => {
              const IconeOpcao = ICONES[opcao.segmento]
              return (
                <DropdownMenuRadioItem
                  key={opcao.id}
                  value={opcao.id}
                  className="cursor-pointer gap-2.5 py-2"
                >
                  <IconeOpcao className="text-muted-foreground" />
                  <span className="grid leading-tight">
                    <span className="font-medium">{opcao.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {segmentos[opcao.segmento].nome}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pendente !== null} onOpenChange={(aberto) => !aberto && setPendente(null)}>
        {/* Confirmação no mesmo mundo dos outros modais: véu, raio, título e ações em pílula. */}
        <AlertDialogContent
          overlayClassName={VEU_DO_MODAL}
          className={cn(
            RAIO_DO_MODAL,
            MOVIMENTO_DO_MODAL,
            "gap-5 p-6 ring-0 data-[size=default]:sm:max-w-[400px]",
          )}
        >
          <AlertDialogHeader className="gap-2 text-left sm:text-left">
            <span
              aria-hidden="true"
              className="mb-1 flex size-11 items-center justify-center rounded-full bg-accent text-marca-texto [&_svg]:size-5"
            >
              <ShoppingBagIcon />
            </span>
            <AlertDialogTitle className="text-lg leading-snug font-semibold tracking-[-0.015em]">
              Trocar para {destino?.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              A sacola é de uma loja só: {plural(contarItens(itens), "item", "itens")} da{" "}
              {loja.nome} sai da sacola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 flex-col-reverse gap-2 rounded-none border-0 bg-transparent p-0 sm:flex-col-reverse">
            <AlertDialogCancel className="h-12 w-full rounded-full text-[15px] font-medium">
              Continuar na {loja.nome}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 w-full rounded-full text-[15px] font-semibold"
              onClick={() => {
                if (!pendente) return
                esvaziar()
                escolher(pendente)
                setPendente(null)
              }}
            >
              Esvaziar e trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
