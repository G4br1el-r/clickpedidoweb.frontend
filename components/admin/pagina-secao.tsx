"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { type SecaoConfig, useConfigCarregada } from "@/lib/admin/config"
import { buscarSecao, GRUPOS, type InfoSecao, SECOES } from "@/lib/admin/secoes"
import { usePrevia } from "./previa/estado"
import { COMPONENTES_SECAO } from "./secoes/registro"

function Titulo({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="flex flex-col gap-1 pb-1">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">{titulo}</h1>
      <p className="text-muted-foreground">{descricao}</p>
    </div>
  )
}

/** Enquanto as configurações salvas carregam, os campos não piscam com os valores padrão. */
function useHidratada() {
  return useConfigCarregada()
}

function Carregando() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

/** Uma seção de configurações; ao entrar, a prévia muda para a tela relacionada. */
export function PaginaSecao({ id }: { id: SecaoConfig }) {
  const secao = buscarSecao(id) as InfoSecao
  const definirTela = usePrevia((estado) => estado.definirTela)
  const hidratada = useHidratada()
  const Componente = COMPONENTES_SECAO[secao.id]

  useEffect(() => {
    definirTela(secao.tela)
  }, [secao.tela, definirTela])

  return (
    <>
      <Titulo titulo={secao.titulo} descricao={secao.descricao} />
      {hidratada ? <Componente /> : <Carregando />}
    </>
  )
}

/** Visão geral: todas as seções agrupadas, para achar qualquer ajuste rápido. */
export function VisaoGeral() {
  const definirTela = usePrevia((estado) => estado.definirTela)

  useEffect(() => {
    definirTela("inicio")
  }, [definirTela])

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Titulo
          titulo="Configurações"
          descricao="Deixe a loja com a cara da sua marca. Tudo aparece na prévia na hora."
        />
      </div>
      {GRUPOS.map((grupo) => (
        <section key={grupo} className="flex flex-col gap-2.5" aria-labelledby={`grupo-${grupo}`}>
          <h2 id={`grupo-${grupo}`} className="text-sm font-semibold text-muted-foreground">
            {grupo}
          </h2>
          <ul className="grid gap-2.5 @xl/conteudo:grid-cols-2">
            {SECOES.filter((secao) => secao.grupo === grupo).map(
              ({ id, titulo, descricao, icone: Icone }) => (
                <li key={id}>
                  <Link
                    href={`/admin/configuracoes/${id}`}
                    className="group flex h-full items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border transition-[box-shadow,transform] duration-200 ease-saida outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary [&_svg]:size-5">
                      <Icone />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{titulo}</span>
                      <span className="block text-sm text-muted-foreground">{descricao}</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </>
  )
}
