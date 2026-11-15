import { Foto } from "@/components/foto"
import type { Produto } from "@/lib/tipos"

/** Prévia de quem não monta o produto (farmácia, adega, açougue, salão, lanchonete): a foto. */
export function PreviewFoto({ produto }: { produto: Produto }) {
  return (
    <Foto
      src={produto.imagem}
      alt=""
      sizes="(min-width: 768px) 560px, 100vw"
      // Baixa: a foto apresenta, mas quem precisa de espaço são as opções. Ela sobe com a rolagem.
      className="h-36 w-full rounded-xl md:h-44"
    />
  )
}
