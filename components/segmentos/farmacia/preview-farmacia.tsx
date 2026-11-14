import { Foto } from "@/components/foto"
import type { Produto } from "@/lib/tipos"

/** Remédio não se monta: a prévia é a própria embalagem. */
export function PreviewFarmacia({ produto }: { produto: Produto }) {
  return (
    <Foto
      src={produto.imagem}
      alt=""
      sizes="(min-width: 768px) 560px, 100vw"
      className="aspect-[3/2] w-full max-w-md rounded-2xl"
    />
  )
}

export const MENSAGENS_ENVIO_FARMACIA = [
  "Recebendo seu pedido",
  "Conferindo com a farmacêutica",
  "Separando na prateleira",
  "Embalado e lacrado!",
]
