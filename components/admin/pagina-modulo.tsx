"use client"

import { ConstructionIcon } from "lucide-react"
import Link from "next/link"
import type { ComponentType } from "react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { usePerfilAtual } from "@/lib/admin/dados/consultas-equipe"
import { podeVerModulo } from "@/lib/admin/regras/equipe"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import {
  buscarModulo,
  buscarSegmento,
  type ModuloId,
  temModulo,
} from "@/lib/admin/segmentos-painel"
import { PaginaAgendamentos } from "./agendamentos/pagina-agendamentos"
import { PaginaCardapio } from "./cardapio/pagina-cardapio"
import { PaginaCategorias } from "./cardapio/pagina-categorias"
import { PaginaCozinha } from "./cozinha/pagina-cozinha"
import { PaginaBairros } from "./entrega/pagina-bairros"
import { PaginaMotoboys } from "./entrega/pagina-motoboys"
import { PaginaEquipe } from "./equipe/pagina-equipe"
import { PaginaEstoque } from "./estoque/pagina-estoque"
import { PaginaControlados } from "./farmacia/pagina-controlados"
import { PaginaReceitas } from "./farmacia/pagina-receitas"
import { PaginaValidade } from "./farmacia/pagina-validade"
import { PaginaFila } from "./fila/pagina-fila"
import { PaginaGarcom } from "./garcom/pagina-garcom"
import { PaginaLoja } from "./loja/pagina-loja"
import { PaginaMesas } from "./mesas/pagina-mesas"
import { PaginaPdv } from "./pdv/pagina-pdv"
import { PaginaPedidos } from "./pedidos/pagina-pedidos"
import { SemAcesso } from "./sem-acesso"
import { VisaoGeral } from "./visao-geral/visao-geral"

/** Módulos que já têm página; os outros mostram "Em construção". */
const PAGINAS: Partial<Record<ModuloId, ComponentType>> = {
  "visao-geral": VisaoGeral,
  pedidos: PaginaPedidos,
  fila: PaginaFila,
  cardapio: PaginaCardapio,
  categorias: PaginaCategorias,
  estoque: PaginaEstoque,
  pdv: PaginaPdv,
  cozinha: PaginaCozinha,
  mesas: PaginaMesas,
  garcom: PaginaGarcom,
  agendamentos: PaginaAgendamentos,
  motoboys: PaginaMotoboys,
  bairros: PaginaBairros,
  loja: PaginaLoja,
  equipe: PaginaEquipe,
  receitas: PaginaReceitas,
  controlados: PaginaControlados,
  validade: PaginaValidade,
}

/** Enquanto a página do módulo não chega (ou lê a URL no navegador). */
export function CarregandoModulo() {
  return <Skeleton className="m-4 h-48 rounded-xl md:m-6" />
}

/**
 * Corpo da página de um módulo. Se o segmento escolhido não tem o módulo,
 * avisa e leva para a visão geral; senão mostra a página dele.
 */
export function PaginaModulo({ id }: { id: ModuloId }) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const hidratado = useSegmentoAtual((estado) => estado.hidratado)
  const perfil = usePerfilAtual()
  const modulo = buscarModulo(id)
  if (!modulo) return null

  if (!temModulo(segmento, id)) {
    // Antes de ler o segmento salvo, não dá para saber se o aviso vale.
    if (!hidratado) return <CarregandoModulo />
    const Icone = modulo.icone
    return (
      <Empty className="m-4 border md:m-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icone />
          </EmptyMedia>
          <EmptyTitle>
            {modulo.titulo} não faz parte de {buscarSegmento(segmento).nome}
          </EmptyTitle>
          <EmptyDescription>
            Troque o segmento no topo do painel para ver esta página.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm">
            <Link href="/admin">Ir para a visão geral</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (!perfil) return <CarregandoModulo />
  if (!podeVerModulo(perfil, id)) return <SemAcesso titulo={`Sem acesso a ${modulo.titulo}`} />

  const Pagina = PAGINAS[id]
  if (Pagina) return <Pagina />

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{modulo.titulo}</h1>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ConstructionIcon />
          </EmptyMedia>
          <EmptyTitle>Em construção</EmptyTitle>
          <EmptyDescription>Esta página chega numa das próximas fases do painel.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
