"use client"

import { format } from "date-fns"
import { type Ref, useEffect, useEffectEvent, useState } from "react"
import type { ViaDaCozinha } from "@/lib/admin/regras/pracas"
import { useImpressora } from "./cupom"

const origem = (via: ViaDaCozinha) => {
  const { pedido } = via.ticket
  if (pedido.mesa) return `Mesa ${pedido.mesa.numero}`
  return pedido.tipo === "entrega" ? "Entrega" : "Retirada"
}

/**
 * Via da cozinha em 80 mm: letra grande, sem preço. Diz de onde é, a rodada, a praça e a
 * hora, e lista os itens da praça com as opções e a observação.
 */
export function ViaCozinha({ via, area }: { via: ViaDaCozinha; area: Ref<HTMLDivElement> }) {
  const { pedido, rodada, chegouEm } = via.ticket
  return (
    <div className="hidden">
      <div
        ref={area}
        data-via=""
        className="flex flex-col gap-2 p-2 font-mono text-base text-black"
      >
        <p className="text-lg font-bold">
          {origem(via)} · {rodada > 1 ? `${rodada}ª rodada · ` : ""}
          {via.praca.nome.toLocaleUpperCase("pt-BR")}
        </p>
        <p>
          #{pedido.numero} · {format(new Date(chegouEm), "HH:mm")}
        </p>
        <hr className="border-dashed border-black" />
        {via.itens.map((item) => (
          <div key={item.id}>
            <p className="text-lg font-bold">
              {item.quantidade}x {item.nome}
            </p>
            {item.opcoes.map((opcao) => (
              <p key={opcao} className="pl-3">
                * {opcao}
              </p>
            ))}
            {item.observacao && <p className="pl-3">Obs.: {item.observacao}</p>}
          </div>
        ))}
        {pedido.observacao && (
          <>
            <hr className="border-dashed border-black" />
            <p>Obs.: {pedido.observacao}</p>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Fila de impressão das vias: uma de cada vez. `elemento` precisa estar na tela (fica
 * escondido; é dele que sai a via).
 */
export function useFilaDeVias() {
  const { area, imprimir } = useImpressora("Via da cozinha")
  const [fila, setFila] = useState<ViaDaCozinha[]>([])
  const atual = fila[0]
  const mandar = useEffectEvent(() => {
    imprimir()
    setFila((resto) => resto.slice(1))
  })
  useEffect(() => {
    if (atual) mandar()
  }, [atual])
  return {
    imprimir: (vias: ViaDaCozinha[]) => setFila((atuais) => [...atuais, ...vias]),
    elemento: atual ? <ViaCozinha via={atual} area={area} /> : null,
  }
}
