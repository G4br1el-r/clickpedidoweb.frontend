"use client"

import { BikeIcon, ClockIcon, CreditCardIcon, MapPinIcon, PhoneIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Dica } from "@/components/dica"
import { Painel, PainelDescricao, PainelFechar, PainelTitulo } from "@/components/painel-responsivo"
import { Button } from "@/components/ui/button"
import { clienteAtual } from "@/lib/cliente"
import { emReais } from "@/lib/formato"

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
    <section className="flex gap-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5"
        aria-hidden="true"
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans font-semibold">{titulo}</h3>
        <div className="text-sm text-muted-foreground">{children}</div>
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
  const loja = clienteAtual

  return (
    <Painel aberto={aberto} aoMudar={aoMudar}>
      <div className="flex items-center justify-between gap-2 py-1 pr-2 pl-4 md:pt-3">
        <div className="min-w-0 text-left">
          <PainelTitulo className="text-xl font-bold">{loja.nome}</PainelTitulo>
          <PainelDescricao>{loja.slogan}</PainelDescricao>
        </div>
        <Dica texto="Fechar">
          <PainelFechar asChild>
            <Button type="button" variant="ghost" size="toque" aria-label="Fechar informações">
              <XIcon />
            </Button>
          </PainelFechar>
        </Dica>
      </div>
      <div className="min-h-0 divide-y overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
