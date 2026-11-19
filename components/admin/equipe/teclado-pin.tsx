"use client"

import { DeleteIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MAXIMO = 6
const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

/** Só números, até 6. */
const limpar = (texto: string) => texto.replace(/\D/g, "").slice(0, MAXIMO)

/**
 * PIN da equipe: digita pelo teclado do computador ou pelo da tela (bom no tablet).
 * Os pontos mostram quantos números já entraram.
 */
export function TecladoPin({
  id,
  rotulo,
  valor,
  aoMudar,
  aoConfirmar,
}: {
  id: string
  rotulo: string
  valor: string
  aoMudar: (pin: string) => void
  aoConfirmar?: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={MAXIMO}
        value={valor}
        onChange={(evento) => aoMudar(limpar(evento.target.value))}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") {
            evento.preventDefault()
            aoConfirmar?.()
          }
        }}
        className="text-center text-lg tracking-[0.5em] tabular-nums"
      />
      <div aria-hidden="true" className="flex justify-center gap-2.5">
        {Array.from({ length: MAXIMO }, (_, indice) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: posições fixas do PIN.
            key={indice}
            className={cn(
              "size-2.5 rounded-full transition-colors",
              indice < valor.length ? "bg-foreground" : "bg-foreground/15",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DIGITOS.map((digito) => (
          <Tecla key={digito} onClick={() => aoMudar(limpar(`${valor}${digito}`))}>
            {digito}
          </Tecla>
        ))}
        <Tecla className="text-sm font-medium" onClick={() => aoMudar("")}>
          Limpar
        </Tecla>
        <Tecla onClick={() => aoMudar(limpar(`${valor}0`))}>0</Tecla>
        <Tecla aria-label="Apagar" onClick={() => aoMudar(valor.slice(0, -1))}>
          <DeleteIcon />
        </Tecla>
      </div>
    </div>
  )
}

function Tecla({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-12 rounded-xl bg-foreground/5 text-lg font-semibold tabular-nums hover:bg-foreground/10",
        className,
      )}
      {...props}
    />
  )
}
