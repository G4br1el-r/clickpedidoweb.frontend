import { XIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * O que todo modal do cliente compartilha, para nenhum parecer de outra família:
 * o mesmo véu (escurece sem desfocar: o desfoque era enfeite e pesava no celular),
 * o mesmo raio e o mesmo botão de fechar.
 */
export const VEU_DO_MODAL =
  "bg-black/40 supports-backdrop-filter:backdrop-blur-none dark:bg-black/60"

/**
 * Movimento único de abertura e fechamento: a gaveta sobe com a curva de gaveta e desce
 * mais rápido; a janela central nasce de 97% e 8 px abaixo em 280 ms e sai em 160 ms.
 * Com movimento reduzido, só opacidade.
 */
export const MOVIMENTO_DO_MODAL = cn(
  // Gaveta (vaul): só a saída muda de duração; a curva já é a de gaveta.
  "data-[vaul-drawer]:data-[state=closed]:[animation-duration:300ms]!",
  "motion-reduce:data-[vaul-drawer]:data-[state=open]:[animation-name:enter]!",
  "motion-reduce:data-[vaul-drawer]:data-[state=closed]:[animation-name:exit]!",
  "motion-reduce:data-[vaul-drawer]:[animation-duration:150ms]!",
  "motion-reduce:data-[vaul-drawer]:data-[state=closed]:[animation-duration:150ms]!",
  "motion-reduce:data-[vaul-drawer]:[--tw-enter-opacity:0] motion-reduce:data-[vaul-drawer]:[--tw-exit-opacity:0]",
  // Janela central (Radix).
  "not-data-[vaul-drawer]:duration-[280ms] not-data-[vaul-drawer]:ease-saida",
  "not-data-[vaul-drawer]:data-open:zoom-in-97 not-data-[vaul-drawer]:data-open:slide-in-from-bottom-2",
  "not-data-[vaul-drawer]:data-closed:duration-[160ms] not-data-[vaul-drawer]:data-closed:zoom-out-98",
  "motion-reduce:not-data-[vaul-drawer]:data-open:zoom-in-100 motion-reduce:not-data-[vaul-drawer]:data-open:slide-in-from-bottom-0",
  "motion-reduce:not-data-[vaul-drawer]:data-closed:zoom-out-100 motion-reduce:not-data-[vaul-drawer]:duration-150",
)

/** Raio único das superfícies de modal (janela, gaveta, confirmação, sacola). */
export const RAIO_DO_MODAL = "rounded-[20px]"

/**
 * Fechar: alvo de toque de 44 px, redondo, sobre um tom apagado que não disputa com o conteúdo.
 * Use dentro do `Close` do modal com `asChild`.
 */
export function BotaoFecharPainel({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="toque"
      data-fechar-painel=""
      className={cn(
        "shrink-0 rounded-full bg-muted/70 text-foreground hover:bg-muted active:scale-[0.94]",
        className,
      )}
      {...props}
    >
      <XIcon />
    </Button>
  )
}
