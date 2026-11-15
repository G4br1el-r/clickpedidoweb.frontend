import type { ReactNode } from "react"

/** Título do passo, que recebe o foco ao trocar de passo para o leitor de tela anunciar. */
export function CabecalhoPasso({ titulo, descricao }: { titulo: string; descricao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2
        tabIndex={-1}
        data-titulo-passo
        className="text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-balance outline-none md:text-[30px]"
      >
        {titulo}
      </h2>
      {descricao && <p className="text-[15px] text-muted-foreground">{descricao}</p>}
    </div>
  )
}
