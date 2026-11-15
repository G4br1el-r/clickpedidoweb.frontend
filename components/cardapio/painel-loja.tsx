"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { Dica } from "@/components/dica"
import { Entrada } from "@/components/entrada"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { emReais } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { textosDoSegmento } from "@/lib/segmentos"
import { cn } from "@/lib/utils"

function Informacao({
  rotulo,
  valor,
  className,
}: {
  rotulo: string
  valor: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border-l border-border/70 py-2.5 pl-3 first:border-l-0 first:pl-0 md:pr-6 md:pl-6 md:first:pl-0",
        className,
      )}
    >
      <dt className="text-xs leading-tight text-muted-foreground md:whitespace-nowrap">{rotulo}</dt>
      <dd className="text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums">
        {valor}
      </dd>
    </div>
  )
}

type PainelLojaProps = {
  termo: string
  aoBuscar: (termo: string) => void
}

/**
 * Régua do que a pessoa precisa saber antes de pedir, entre dois fios, e a busca.
 * No celular, a régua vem primeiro e a busca embaixo; do tablet em diante, ficam lado a lado.
 * Com a barra grudada no topo, a busca passa para a barra.
 */
export function PainelLoja({ termo, aoBuscar }: PainelLojaProps) {
  const loja = useLoja()
  const horario = loja.horarios.find(({ horario: valor }) => valor !== "Fechado")

  return (
    <Entrada
      atraso={0.06}
      duracao={0.3}
      data-testid="painel-loja"
      className="relative mt-5 flex flex-col gap-3 px-4 md:mt-7 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6"
    >
      <dl className="grid min-w-0 grid-cols-[1.15fr_1fr_1fr] border-y border-border/70 md:flex md:border-y-0">
        <Informacao rotulo="Entrega" valor={loja.entrega.tempo} />
        <Informacao rotulo="Retirada" valor={loja.retirada.tempo} />
        <Informacao rotulo="Mínimo" valor={emReais(loja.pedidoMinimo)} />
        {horario && (
          <Informacao rotulo={horario.dia} valor={horario.horario} className="hidden xl:flex" />
        )}
      </dl>

      <InputGroup className="h-11 shrink-0 rounded-xl border-transparent bg-secondary shadow-none md:w-72 lg:w-80 dark:bg-secondary">
        <InputGroupAddon className="pl-3.5">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Buscar no cardápio"
          placeholder={textosDoSegmento(loja.segmento).busca}
          value={termo}
          onChange={(evento) => aoBuscar(evento.target.value)}
          className="h-full text-[15px] md:text-[15px]"
          data-testid="busca-painel"
        />
        {termo.length > 0 && (
          <InputGroupAddon align="inline-end" className="pr-0.5">
            <Dica texto="Apagar busca">
              <Button
                type="button"
                variant="ghost"
                size="toque"
                className="rounded-lg"
                aria-label="Apagar busca"
                onClick={() => aoBuscar("")}
              >
                <XIcon />
              </Button>
            </Dica>
          </InputGroupAddon>
        )}
      </InputGroup>
    </Entrada>
  )
}
