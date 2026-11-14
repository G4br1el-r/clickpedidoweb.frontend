"use client"

import { CheckIcon, PlusCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type OpcaoFacetada = { valor: string; rotulo: string; quantidade: number }

/**
 * Filtro de várias escolhas com a contagem de cada opção (o "faceted filter" das
 * tabelas do shadcn): Popover com Command.
 */
export function FiltroFacetado({
  titulo,
  opcoes,
  selecionados,
  aoMudar,
}: {
  titulo: string
  opcoes: OpcaoFacetada[]
  selecionados: string[]
  aoMudar: (valores: string[]) => void
}) {
  const marcados = new Set(selecionados)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon data-icon="inline-start" />
          {titulo}
          {marcados.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {marcados.size === 1
                  ? opcoes.find((opcao) => marcados.has(opcao.valor))?.rotulo
                  : `${marcados.size} escolhidos`}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={titulo} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((opcao) => {
                const marcado = marcados.has(opcao.valor)
                return (
                  <CommandItem
                    key={opcao.valor}
                    value={opcao.rotulo}
                    aria-checked={marcado}
                    onSelect={() =>
                      aoMudar(
                        marcado
                          ? selecionados.filter((valor) => valor !== opcao.valor)
                          : [...selecionados, opcao.valor],
                      )
                    }
                    className="cursor-pointer"
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        marcado
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                      aria-hidden="true"
                    >
                      <CheckIcon className="size-3.5" />
                    </span>
                    <span>{opcao.rotulo}</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                      {opcao.quantidade}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {marcados.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => aoMudar([])} className="justify-center text-center">
                    Limpar
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
