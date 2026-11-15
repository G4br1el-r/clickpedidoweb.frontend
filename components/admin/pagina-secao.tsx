"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { type SecaoConfig, useConfigCarregada } from "@/lib/admin/config"
import { buscarSecao, GRUPOS, type InfoSecao, SECOES } from "@/lib/admin/secoes"
import { useSecoesPendentes } from "./barra-acoes"
import { BlocoSecao } from "./bloco-secao"
import { CabecalhoPagina } from "./cabecalho-pagina"
import { usePrevia } from "./previa/estado"
import { COMPONENTES_SECAO } from "./secoes/registro"
import { Traco } from "./traco"

/** Esqueleto no formato dos blocos: fio, título curto e as linhas de campos. */
function Carregando() {
  return (
    <div className="flex flex-col gap-10" aria-hidden="true">
      {[3, 2].map((linhas, bloco) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo, a ordem não muda.
          key={bloco}
          className="flex flex-col gap-4 border-t border-border/70 pt-5"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
          </div>
          {Array.from({ length: linhas }, (_, linha) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo, a ordem não muda.
            <div key={linha} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Uma seção de configurações; ao entrar, a prévia muda para a tela relacionada. */
export function PaginaSecao({ id }: { id: SecaoConfig }) {
  const secao = buscarSecao(id) as InfoSecao
  const definirTela = usePrevia((estado) => estado.definirTela)
  // Enquanto as configurações salvas carregam, os campos não piscam com os valores padrão.
  const hidratada = useConfigCarregada()
  const Componente = COMPONENTES_SECAO[secao.id]

  useEffect(() => {
    definirTela(secao.tela)
  }, [secao.tela, definirTela])

  return (
    <>
      <CabecalhoPagina titulo={secao.titulo} resumo={secao.descricao} />
      {hidratada ? (
        <div className="flex flex-col gap-10">
          <Componente />
        </div>
      ) : (
        <Carregando />
      )}
    </>
  )
}

function LinhaSecao({ secao, pendente }: { secao: InfoSecao; pendente: boolean }) {
  const { id, titulo, descricao, icone: Icone } = secao
  return (
    <li className="border-b border-border/60">
      <Link
        href={`/admin/configuracoes/${id}`}
        className="group -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors duration-150 ease-saida hover:bg-foreground/[0.03] focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/[0.05]"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-muted-foreground transition-colors duration-150 group-hover:text-foreground [&_svg]:size-4"
        >
          <Icone />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{titulo}</span>
            {pendente && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Traco tom="novo" className="h-3" />
                Não aplicado
              </span>
            )}
          </span>
          <span className="block text-[13px] leading-snug text-muted-foreground">{descricao}</span>
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground/70 transition-transform duration-150 ease-saida group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Link>
    </li>
  )
}

/** Todas as opções: as seções agrupadas, para achar qualquer ajuste rápido. */
export function VisaoGeral() {
  const definirTela = usePrevia((estado) => estado.definirTela)
  const pendentes = useSecoesPendentes()

  useEffect(() => {
    definirTela("inicio")
  }, [definirTela])

  return (
    <>
      <CabecalhoPagina
        titulo="Configurações"
        resumo="Deixe a loja com a cara da sua marca. Tudo aparece na prévia na hora."
      />
      <div className="flex flex-col gap-8">
        {GRUPOS.map((grupo) => (
          <BlocoSecao key={grupo} titulo={grupo}>
            <ul className="-mt-2 grid gap-x-8 @xl/conteudo:grid-cols-2">
              {SECOES.filter((secao) => secao.grupo === grupo).map((secao) => (
                <LinhaSecao
                  key={secao.id}
                  secao={secao}
                  pendente={pendentes.some((item) => item.id === secao.id)}
                />
              ))}
            </ul>
          </BlocoSecao>
        ))}
      </div>
    </>
  )
}
