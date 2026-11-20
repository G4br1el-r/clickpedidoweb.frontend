"use client"

import { Volume2Icon, VolumeOffIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAgora } from "@/hooks/use-agora"
import { useCozinha, useLoja } from "@/lib/admin/dados/consultas"
import { chamadasNovas, type PedidoNaChamada, quadroDeChamada } from "@/lib/admin/regras/chamada"
import type { TomStatus } from "@/lib/admin/regras/status"
import { liberarSom, tocarChamada } from "@/lib/admin/som"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

const textoDaChamada = (pedido: PedidoNaChamada) =>
  `Pedido ${pedido.numero}${pedido.nome ? `, ${pedido.nome}` : ""}: pronto, pode retirar.`

/**
 * Chama quem ficou pronto: o dim-dom (com o som ligado) e o anúncio para leitor de tela.
 * Na primeira leitura não chama ninguém: o que já estava pronto já foi chamado.
 */
function useChamadas(prontos: PedidoNaChamada[] | undefined, somLigado: boolean) {
  const chamados = useRef<Set<number> | null>(null)
  const [anuncio, setAnuncio] = useState("")

  useEffect(() => {
    if (!prontos) return
    const novas = chamados.current ? chamadasNovas(chamados.current, prontos) : []
    if (novas.length > 0) {
      if (somLigado) tocarChamada()
      setAnuncio(novas.map(textoDaChamada).join(" "))
    }
    chamados.current = new Set(prontos.map((pedido) => pedido.id))
  }, [prontos, somLigado])

  return anuncio
}

function Coluna({
  id,
  titulo,
  tom,
  pedidos,
  vazia,
  destaque = false,
}: {
  id: string
  titulo: string
  tom: TomStatus
  pedidos: PedidoNaChamada[]
  /** O que aparece ali, para a coluna vazia não parecer quebrada. */
  vazia: string
  destaque?: boolean
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-6 px-6 py-8 lg:px-10">
      <h2
        id={id}
        className="flex items-center gap-3 text-[clamp(1.25rem,2.2vw,2.25rem)] font-semibold tracking-tight"
      >
        <Traco tom={tom} className="h-[0.9em] w-1.5" />
        {titulo}
      </h2>
      {pedidos.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-[clamp(1rem,1.5vw,1.5rem)] text-muted-foreground">
          {vazia}
        </p>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-x-8 gap-y-6">
        {pedidos.map((pedido) => (
          <li key={pedido.id} className="flex flex-col gap-1">
            <span
              className={cn(
                "font-semibold leading-none tracking-tight tabular-nums",
                destaque ? "text-[clamp(3rem,6.5vw,7rem)]" : "text-[clamp(2.5rem,4.5vw,5rem)]",
              )}
            >
              {pedido.numero}
            </span>
            {pedido.nome && (
              <span className="truncate text-[clamp(1rem,1.6vw,1.75rem)] text-muted-foreground">
                {pedido.nome}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Painel de chamada, para a TV virada ao cliente: só leitura, com o número grande de quem
 * espera no balcão em "Preparando" e em "Pronto, pode retirar". Nunca o nome completo.
 */
export function PainelChamada({ intervalo = 4_000 }: { intervalo?: number }) {
  const { data: pedidos } = useCozinha(intervalo)
  const { data: loja } = useLoja()
  const agora = useAgora(30_000)
  const quadro = pedidos && agora ? quadroDeChamada(pedidos, agora) : null
  // O navegador só libera o som depois de um toque: quem liga a TV toca aqui uma vez.
  const [somLigado, setSomLigado] = useState(false)
  const anuncio = useChamadas(quadro?.prontos, somLigado)

  const alternarSom = async () => {
    if (!somLigado) await liberarSom()
    setSomLigado(!somLigado)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5 lg:px-10">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-[clamp(1.5rem,2.6vw,2.75rem)] font-semibold tracking-tight">
            {loja?.nome}
          </h1>
          <p className="text-[clamp(1rem,1.5vw,1.5rem)] text-muted-foreground">
            Acompanhe o seu pedido pelo número
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={somLigado ? "Som da chamada ligado" : "Ligar o som da chamada"}
          onClick={alternarSom}
        >
          {somLigado ? <Volume2Icon /> : <VolumeOffIcon />}
        </Button>
      </header>
      <p role="status" className="sr-only">
        {anuncio}
      </p>
      {quadro && (
        <div className="grid flex-1 grid-cols-1 divide-border/70 max-md:divide-y md:grid-cols-[2fr_3fr] md:divide-x">
          <Coluna
            id="chamada-preparando"
            titulo="Preparando"
            tom="preparo"
            pedidos={quadro.preparando}
            vazia="Os pedidos do balcão aparecem aqui."
          />
          <Coluna
            id="chamada-prontos"
            titulo="Pronto, pode retirar"
            tom="pronto"
            pedidos={quadro.prontos}
            vazia="Quando o seu ficar pronto, o número aparece aqui."
            destaque
          />
        </div>
      )}
    </div>
  )
}
