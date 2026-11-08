import type { ReactNode } from "react"
import { LayoutConfiguracoes } from "@/components/admin/layout-configuracoes"

export default function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  return <LayoutConfiguracoes>{children}</LayoutConfiguracoes>
}
