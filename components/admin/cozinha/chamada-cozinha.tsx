"use client"

import { useEffect, useRef } from "react"
import { useCozinha } from "@/lib/admin/dados/consultas"
import { usePreferenciasCarregadas, usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { numerosDaChamada } from "@/lib/admin/regras/telas-cozinha"
import { tocarSom } from "@/lib/admin/som"
import { RecursoPro } from "../recurso-pro"

function ColunaDeNumeros({
  titulo,
  numeros,
  destaque = false,
}: {
  titulo: string
  numeros: number[]
  destaque?: boolean
}) {
  return (
    <section aria-label={titulo} className="flex min-h-0 flex-col gap-6">
      <h2 className="text-3xl font-semibold">{titulo}</h2>
      <ul className="grid grid-cols-3 gap-4">
        {numeros.map((numero) => (
          <li
            key={numero}
            className={
              destaque
                ? "rounded-2xl bg-(--tom-pronto) py-6 text-center text-6xl font-semibold text-white tabular-nums"
                : "rounded-2xl bg-card py-6 text-center text-5xl font-semibold tabular-nums ring-1 ring-border"
            }
          >
            {numero}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Chamada({ intervalo }: { intervalo: number }) {
  usePreferenciasCarregadas()
  const { data: pedidos } = useCozinha(intervalo)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const numeros = pedidos ? numerosDaChamada(pedidos) : null
  // O número que chega em "Pode retirar" chama o cliente; a primeira leitura não toca.
  const conhecidos = useRef<Set<number> | null>(null)
  const prontos = numeros?.prontos.join(",")
  useEffect(() => {
    if (prontos === undefined) return
    const agora = new Set(prontos ? prontos.split(",").map(Number) : [])
    const antes = conhecidos.current
    conhecidos.current = agora
    if (antes && somLigado && [...agora].some((numero) => !antes.has(numero))) {
      tocarSom("chamada")
    }
  }, [prontos, somLigado])

  return (
    <main
      aria-label="Chamada de pedidos"
      className="fixed inset-0 z-50 grid grid-cols-2 gap-10 overflow-hidden bg-background p-10"
    >
      {numeros ? (
        <>
          <ColunaDeNumeros titulo="Preparando" numeros={numeros.preparando} />
          <ColunaDeNumeros titulo="Pode retirar" numeros={numeros.prontos} destaque />
        </>
      ) : (
        <p role="status" className="text-xl text-muted-foreground">
          Carregando…
        </p>
      )}
    </main>
  )
}

/**
 * Painel de chamada (Pro): virado para o cliente da retirada, com os números em preparo e
 * os prontos. O número que fica pronto toca a chamada, com o som do aparelho ligado.
 */
export function ChamadaCozinha({ intervalo = 4_000 }: { intervalo?: number }) {
  return (
    <RecursoPro
      chave="cozinha.chamada"
      descricao="Uma tela para o cliente da retirada ver quando o pedido dele está pronto."
    >
      <Chamada intervalo={intervalo} />
    </RecursoPro>
  )
}
