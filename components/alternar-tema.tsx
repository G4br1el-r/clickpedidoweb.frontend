"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Troca entre claro e escuro. O ícone certo aparece pelo CSS do tema,
 * então não pisca antes do JavaScript carregar.
 */
export function AlternarTema({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Dica texto="Tema claro ou escuro">
      <Button
        type="button"
        variant="ghost"
        size="toque"
        aria-label="Alternar tema claro e escuro"
        data-testid="alternar-tema"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className={cn("relative overflow-hidden rounded-full", className)}
      >
        <SunIcon className="absolute size-5 scale-50 rotate-90 opacity-0 transition-[transform,opacity] duration-300 ease-saida dark:scale-100 dark:rotate-0 dark:opacity-100" />
        <MoonIcon className="absolute size-5 scale-100 rotate-0 opacity-100 transition-[transform,opacity] duration-300 ease-saida dark:scale-50 dark:-rotate-90 dark:opacity-0" />
      </Button>
    </Dica>
  )
}
