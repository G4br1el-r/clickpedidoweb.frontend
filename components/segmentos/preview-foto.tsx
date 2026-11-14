import { Foto } from "@/components/foto"
import type { Produto } from "@/lib/tipos"

/** Prévia de quem não monta o produto (farmácia, adega, açougue, salão, lanchonete): a foto. */
export function PreviewFoto({ produto }: { produto: Produto }) {
  return (
    <Foto
      src={produto.imagem}
      alt=""
      sizes="(min-width: 768px) 560px, 100vw"
      // Baixa o bastante para os passos e o botão de adicionar caberem na tela do celular.
      className="h-[22dvh] max-h-60 w-full max-w-md rounded-2xl md:h-60"
    />
  )
}
