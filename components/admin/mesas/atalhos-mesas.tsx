"use client"

import { useEffect, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type AcaoAtalho, lerTecla } from "@/lib/admin/regras/atalhos-mesas"

/** Some o aviso dos dígitos depois deste tempo sem tecla. */
const ESQUECER_EM_MS = 2_000

/** O alvo da tecla é um campo de texto: aí a tecla é da pessoa digitando. */
function emCampo(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.matches("input, textarea, select") || alvo.isContentEditable
}

/** Há uma janela, folha, menu, lista de opções ou confirmação aberta: a tecla é dela. */
const haJanelaAberta = () =>
  document.querySelector(
    '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
  ) !== null

/**
 * Ouve o teclado da tela de mesas e executa a ação que `lerTecla` decide. Os dígitos
 * acumulados aparecem num aviso ("Mesa 12 ↵") que some depois de 2 s sem tecla.
 */
export function AtalhosMesas({
  aoAbrirMesa,
  aoNovaMesa,
  aoAjuda,
}: {
  /** Recebe o número digitado; a página avisa se a mesa não existe. */
  aoAbrirMesa: (numero: number) => void
  aoNovaMesa: () => void
  aoAjuda: () => void
}) {
  const [digitado, setDigitado] = useState("")
  const acumulado = useRef("")
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const acoes = useRef({ aoAbrirMesa, aoNovaMesa, aoAjuda })
  acoes.current = { aoAbrirMesa, aoNovaMesa, aoAjuda }

  useEffect(() => {
    function executar(acao: AcaoAtalho) {
      if (acao.tipo === "abrir-mesa") acoes.current.aoAbrirMesa(acao.numero)
      else if (acao.tipo === "nova-mesa") acoes.current.aoNovaMesa()
      else if (acao.tipo === "ajuda") acoes.current.aoAjuda()
      else if (acao.tipo === "buscar") {
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar mesa"]')?.focus()
      }
    }

    function aoApertar(evento: KeyboardEvent) {
      const lido = lerTecla(acumulado.current, {
        key: evento.key,
        emCampo: emCampo(evento.target),
        comModificador: evento.ctrlKey || evento.altKey || evento.metaKey,
        janelaAberta: haJanelaAberta(),
      })
      if (lido.acao.tipo !== "nenhuma") {
        // "/" digitado no campo de busca não pode virar texto; fora do campo não há texto.
        evento.preventDefault()
      }
      acumulado.current = lido.digitado
      setDigitado(lido.digitado)
      clearTimeout(relogio.current)
      if (lido.digitado !== "") {
        relogio.current = setTimeout(() => {
          acumulado.current = ""
          setDigitado("")
        }, ESQUECER_EM_MS)
      }
      executar(lido.acao)
    }

    document.addEventListener("keydown", aoApertar)
    return () => {
      document.removeEventListener("keydown", aoApertar)
      clearTimeout(relogio.current)
    }
  }, [])

  if (digitado === "") return null
  return (
    <output
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-popover px-4 py-1.5 text-sm font-medium tabular-nums shadow-md"
    >
      Mesa {digitado} ↵
    </output>
  )
}

const ATALHOS: { teclas: string; acao: string }[] = [
  { teclas: "0–9, depois Enter", acao: "Abrir a mesa pelo número" },
  { teclas: "/", acao: "Buscar mesa" },
  { teclas: "N", acao: "Nova mesa" },
  { teclas: "?", acao: "Mostrar estes atalhos" },
  { teclas: "Esc", acao: "Apagar o número digitado" },
]

/** Folha com a lista dos atalhos da tela de mesas. */
export function FolhaAtalhos({
  aberta,
  aoMudar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  return (
    <Sheet open={aberta} onOpenChange={aoMudar}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Atalhos do teclado</SheetTitle>
          <SheetDescription>Valem na tela de mesas, fora dos campos de texto.</SheetDescription>
        </SheetHeader>
        <dl className="flex flex-col gap-3 px-4">
          {ATALHOS.map(({ teclas, acao }) => (
            <div key={acao} className="flex items-center justify-between gap-3 text-sm">
              <dt>{acao}</dt>
              <dd>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {teclas}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  )
}
