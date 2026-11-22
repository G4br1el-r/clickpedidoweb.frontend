"use client"

import { PrinterIcon, QrCodeIcon } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { urlDaMesa } from "@/lib/admin/regras/qr"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"

/** A folha sai em A4, com margem para a tesoura. */
const PAPEL_A4 = "@page { size: A4; margin: 12mm } body { -webkit-print-color-adjust: exact }"

/** O botão "Folha de QR" e a prévia da folha A4: um QR por mesa (sem bloqueio), para imprimir. */
export function FolhaQr({ mesas, loja }: { mesas: Mesa[]; loja: string }) {
  const [aberta, setAberta] = useState(false)
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const folha = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: folha,
    documentTitle: `Folha de QR · ${loja}`,
    pageStyle: PAPEL_A4,
  })
  const doSalao = mesas.filter((mesa) => !mesa.bloqueio).toSorted((a, b) => a.numero - b.numero)
  const origem = typeof window === "undefined" ? "" : window.location.origin

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAberta(true)}>
        <QrCodeIcon data-icon="inline-start" />
        Folha de QR
      </Button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Folha de QR</DialogTitle>
            <DialogDescription>
              Um QR por mesa, para colar na mesa. O cliente lê com a câmera e abre o cardápio da
              mesa.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto rounded-lg border border-border/70 bg-white">
            {/* A folha em si: branca, com o preto do QR, como sai na impressora. */}
            <div
              ref={folha}
              className="grid grid-cols-2 gap-4 p-6 text-black sm:grid-cols-3 print:grid-cols-3"
            >
              {doSalao.map((mesa) => {
                const url = urlDaMesa(origem, segmento, mesa.id)
                return (
                  <figure
                    key={mesa.id}
                    className="flex break-inside-avoid flex-col items-center gap-1.5 rounded-lg border border-dashed border-black/30 p-3 text-center"
                  >
                    <QRCodeSVG
                      value={url}
                      size={132}
                      marginSize={1}
                      role="img"
                      aria-label={`QR da mesa ${mesa.numero}`}
                    />
                    <figcaption className="flex flex-col">
                      <strong className="text-base">Mesa {mesa.numero}</strong>
                      <span className="text-xs">{loja}</span>
                      <span className="text-[8px] break-all text-black/60">{url}</span>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberta(false)}>
              Fechar
            </Button>
            <Button type="button" onClick={() => imprimir()}>
              <PrinterIcon data-icon="inline-start" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
