import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ShellAdmin } from "@/components/admin/shell-admin"
import { VARIAVEIS_FONTES } from "@/lib/admin/fontes"
import { temaParaCss } from "@/lib/tema"
import "./admin.css"

export const metadata: Metadata = {
  title: "Painel da loja · ClickPedido",
  robots: { index: false, follow: false },
}

/** Cores neutras do painel: a marca da loja aparece só na prévia. */
const TEMA_PAINEL = {
  primaria: "#1F1E24",
  acento: "#D9480F",
  fundo: "#F4F4F2",
  tinta: "#18181C",
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS gerado de cores fixas do painel. */}
      <style dangerouslySetInnerHTML={{ __html: temaParaCss(TEMA_PAINEL) }} />
      <ShellAdmin className={VARIAVEIS_FONTES}>{children}</ShellAdmin>
    </>
  )
}
