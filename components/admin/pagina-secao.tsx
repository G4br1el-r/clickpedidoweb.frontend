"use client"

import { ChevronRightIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type SecaoConfig, useConfig, useConfigCarregada } from "@/lib/admin/config"
import { secoesParaRestaurar, textoDaRestauracao } from "@/lib/admin/regras/restaurar-grupo"
import { buscarSecao, GRUPOS, type GrupoSecoes, type InfoSecao, SECOES } from "@/lib/admin/secoes"
import { plural } from "@/lib/formato"
import { useSecoesPendentes } from "./barra-acoes"
import { BlocoSecao } from "./bloco-secao"
import { CabecalhoPagina } from "./cabecalho-pagina"
import { usePrevia } from "./previa/estado"
import { COMPONENTES_SECAO } from "./secoes/registro"
import { Sequencia } from "./secoes/sequencia"
import { Traco } from "./traco"

/** Esqueleto no formato dos blocos: fio, título curto e as linhas de campos, uma após a outra. */
function Carregando() {
  return (
    <div
      role="status"
      aria-label="Carregando a seção"
      aria-busy="true"
      className="flex flex-col gap-10"
    >
      {[3, 2].map((linhas, bloco) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo, a ordem não muda.
          key={bloco}
          className="esqueleto-entra flex flex-col gap-4 border-t border-border/70 pt-5"
          style={{ animationDelay: `${bloco * 0.08}s` }}
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
        <Sequencia className="flex flex-col gap-10">
          <Componente />
        </Sequencia>
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

/**
 * Volta de uma vez todas as seções do grupo que saíram do padrão, em vez de entrar em cada
 * uma. Pede confirmação e deixa o aviso com "Desfazer"; só aparece quando há o que restaurar.
 */
function RestaurarGrupo({ grupo }: { grupo: GrupoSecoes }) {
  const config = useConfig((estado) => estado.config)
  const restaurarSecao = useConfig((estado) => estado.restaurarSecao)
  const atualizar = useConfig((estado) => estado.atualizar)
  const secoes = useMemo(() => secoesParaRestaurar(grupo, config), [grupo, config])
  if (secoes.length === 0) return null

  const restaurar = () => {
    const anteriores = secoes.map((secao) => [secao.id, config[secao.id]] as const)
    for (const secao of secoes) restaurarSecao(secao.id)
    toast(`${grupo} restaurado para o padrão`, {
      description: textoDaRestauracao(secoes),
      action: {
        label: "Desfazer",
        onClick: () => {
          for (const [id, valores] of anteriores) atualizar(id, valores)
        },
      },
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-my-1 text-muted-foreground max-md:min-h-11"
          aria-label={`Restaurar ${grupo} (${plural(secoes.length, "seção", "seções")})`}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Restaurar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restaurar {grupo} ao padrão?</AlertDialogTitle>
          <AlertDialogDescription>
            {textoDaRestauracao(secoes)}. Nada vai ao site até você aplicar, e dá para voltar atrás
            em "Descartar".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={restaurar}>Restaurar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      <Sequencia className="flex flex-col gap-8">
        {GRUPOS.map((grupo) => (
          <BlocoSecao key={grupo} titulo={grupo} acao={<RestaurarGrupo grupo={grupo} />}>
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
      </Sequencia>
    </>
  )
}
