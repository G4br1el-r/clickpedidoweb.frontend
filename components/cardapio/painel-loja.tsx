"use client"

import { BikeIcon, ClockIcon, SearchIcon, StoreIcon, WalletIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Dica } from "@/components/dica"
import { Entrada } from "@/components/entrada"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { clienteAtual } from "@/lib/cliente"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

function Informacao({
  icone,
  rotulo,
  valor,
  className,
}: {
  icone: ReactNode
  rotulo: string
  valor: string
  className?: string
}) {
  return (
    // O ícone mora dentro do <dt> (a lista de definição só aceita termo e valor),
    // posicionado à esquerda dos dois.
    <div
      className={cn(
        "group/info relative flex min-w-0 flex-col justify-end gap-1 border-l pl-3 first:border-l-0 first:pl-0 sm:pl-4 md:justify-center md:pr-6 md:pl-[76px] md:first:pl-[52px] lg:pr-8 lg:pl-[84px]",
        className,
      )}
    >
      <dt className="text-xs leading-tight text-muted-foreground sm:text-[13px] md:whitespace-nowrap">
        <span
          aria-hidden="true"
          className="absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-marca-texto md:left-6 md:flex md:group-first/info:left-0 lg:left-8 [&_svg]:size-[18px]"
        >
          {icone}
        </span>
        {rotulo}
      </dt>
      <dd className="text-base leading-tight font-bold whitespace-nowrap tabular-nums">{valor}</dd>
    </div>
  )
}
type PainelLojaProps = {
  termo: string
  aoBuscar: (termo: string) => void
}

/**
 * Fica centrado na divisória entre a foto e a página: o que a pessoa precisa saber
 * antes de pedir e a busca. No celular, a busca vem primeiro; do tablet em diante,
 * fica compacta à direita. Com a barra grudada no topo, a busca passa para a barra.
 */
export function PainelLoja({ termo, aoBuscar }: PainelLojaProps) {
  const loja = clienteAtual
  const horario = loja.horarios.find(({ horario: valor }) => valor !== "Fechado")

  return (
    <Entrada
      atraso={0.3}
      duracao={0.8}
      data-testid="painel-loja"
      className="sombra-flutuante relative z-10 mx-3 flex flex-col gap-4 rounded-[28px] bg-card p-3.5 pb-4 text-card-foreground ring-1 ring-border/60 md:mx-6 md:flex-row md:items-center md:justify-between md:gap-6 md:py-4 md:pr-4 md:pl-6"
    >
      <dl className="grid min-w-0 grid-cols-[1.15fr_1fr_1fr] px-1 md:flex md:px-0">
        <Informacao icone={<BikeIcon />} rotulo="Entrega" valor={loja.entrega.tempo} />
        <Informacao icone={<StoreIcon />} rotulo="Retirada" valor={loja.retirada.tempo} />
        <Informacao icone={<WalletIcon />} rotulo="Mínimo" valor={emReais(loja.pedidoMinimo)} />
        {horario && (
          <Informacao
            icone={<ClockIcon />}
            rotulo={horario.dia}
            valor={horario.horario}
            className="hidden xl:flex"
          />
        )}
      </dl>

      <InputGroup className="order-first h-12 shrink-0 rounded-full border-transparent bg-secondary shadow-none md:order-last md:w-64 lg:w-72 xl:w-80 dark:bg-secondary">
        <InputGroupAddon className="pl-4">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Buscar no cardápio"
          placeholder="Buscar pizza, borda, bebida"
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
                className="rounded-full"
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
