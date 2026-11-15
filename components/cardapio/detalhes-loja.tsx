"use client"

import {
  ArrowUpRightIcon,
  BikeIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { Dica } from "@/components/dica"
import { BotaoFecharPainel } from "@/components/modal"
import { Painel, PainelDescricao, PainelFechar, PainelTitulo } from "@/components/painel-responsivo"
import { Button } from "@/components/ui/button"
import { linkDoMapa, linkDoTelefone } from "@/lib/contato"
import { emReais } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"

function Bloco({
  icone,
  titulo,
  children,
}: {
  icone: ReactNode
  titulo: string
  children: ReactNode
}) {
  return (
    <section className="flex gap-3.5 py-3.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-marca-texto [&_svg]:size-[18px]"
        aria-hidden="true"
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-[15px] font-medium">{titulo}</h3>
        <div className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </section>
  )
}

export function DetalhesLoja({
  aberto,
  aoMudar,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  const loja = useLoja()

  return (
    <Painel aberto={aberto} aoMudar={aoMudar}>
      <div className="flex items-start justify-between gap-3 px-4 pt-2 md:px-5 md:pt-5">
        <div className="min-w-0 pt-1 text-left">
          <PainelTitulo className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            {loja.nome}
          </PainelTitulo>
          <PainelDescricao className="mt-1 text-sm">{loja.slogan}</PainelDescricao>
        </div>
        <Dica texto="Fechar">
          <PainelFechar asChild>
            <BotaoFecharPainel aria-label="Fechar informações" />
          </PainelFechar>
        </Dica>
      </div>
      {/* O que a pessoa faz com essas informações: ligar ou ir até a loja. */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-4 pb-1 md:px-5">
        <Button asChild variant="outline" className="h-11 gap-2 rounded-full text-sm font-medium">
          <a href={linkDoTelefone(loja.telefone)}>
            <PhoneIcon data-icon="inline-start" />
            Ligar para a loja
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11 gap-2 rounded-full text-sm font-medium">
          <a href={linkDoMapa(loja.endereco)} target="_blank" rel="noopener noreferrer">
            <MapPinIcon data-icon="inline-start" />
            Ver no mapa
            <ArrowUpRightIcon aria-hidden="true" className="size-3.5 opacity-60" />
          </a>
        </Button>
      </div>
      <div className="min-h-0 divide-y divide-border/70 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pb-5">
        <Bloco icone={<ClockIcon />} titulo="Horário">
          <ul>
            {loja.horarios.map(({ dia, horario }) => (
              <li key={dia} className="flex justify-between gap-3">
                <span>{dia}</span>
                <span className="tabular-nums">{horario}</span>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco icone={<BikeIcon />} titulo="Entrega e retirada">
          <p>Entrega em {loja.entrega.tempo}; a taxa depende do bairro</p>
          <p>Retirada em {loja.retirada.tempo}, sem taxa</p>
          <p>Pedido mínimo de {emReais(loja.pedidoMinimo)}</p>
        </Bloco>
        <Bloco icone={<CreditCardIcon />} titulo="Pagamento">
          <p>{loja.pagamentos.join(", ")}</p>
        </Bloco>
        <Bloco icone={<MapPinIcon />} titulo="Endereço">
          <p>{loja.endereco}</p>
        </Bloco>
        <Bloco icone={<PhoneIcon />} titulo="Telefone">
          <p>{loja.telefone}</p>
        </Bloco>
      </div>
    </Painel>
  )
}
