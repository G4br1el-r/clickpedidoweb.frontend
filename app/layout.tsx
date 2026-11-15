import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import type { ReactNode } from "react"
import { Provedores } from "@/components/provedores"
import { clienteAtual } from "@/lib/cliente"
import { cssDasLojas, SCRIPT_LOJA } from "@/lib/loja-atual"
import { corDaBarra, temaParaCss } from "@/lib/tema"
import "./globals.css"

/* A vitrine fala numa família só, em dois pesos: o título e o texto são a mesma Geist. */
const fonteTitulo = Geist({ subsets: ["latin"], variable: "--fonte-titulo" })

const fonteTexto = Geist({ subsets: ["latin"], variable: "--fonte-texto" })

export const metadata: Metadata = {
  title: `${clienteAtual.nome} · Cardápio`,
  description: clienteAtual.slogan,
}

const barra = corDaBarra(clienteAtual.tema)

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: barra.clara },
    { media: "(prefers-color-scheme: dark)", color: barra.escura },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // O next-themes põe a classe do tema antes da pintura; a diferença no HTML é esperada.
    <html
      lang="pt-BR"
      className={`${fonteTitulo.variable} ${fonteTexto.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS gerado das cores do cliente, sem dado digitado por ninguém. */}
        <style dangerouslySetInnerHTML={{ __html: temaParaCss(clienteAtual.tema) }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS gerado das cores fixas das lojas da demonstração. */}
        <style dangerouslySetInnerHTML={{ __html: cssDasLojas() }} />
        {/* Marca a loja salva antes da primeira pintura, para não piscar as cores da pizzaria. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script fixo, sem dado digitado por ninguém. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_LOJA }} />
      </head>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  )
}
