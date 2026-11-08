import type { ReactNode } from "react"

/** Título do passo, que recebe o foco ao trocar de passo para o leitor de tela anunciar. */
export function CabecalhoPasso({ titulo, descricao }: { titulo: string; descricao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2
        tabIndex={-1}
        data-titulo-passo
        className="text-2xl font-extrabold tracking-tight outline-none md:text-[28px]"
      >
        {titulo}
      </h2>
      {descricao && <p className="text-muted-foreground">{descricao}</p>}
    </div>
  )
}
