"use client"

import NumberFlow from "@number-flow/react"
import { ChefHatIcon, MaximizeIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useAvancarPedido, useCozinha } from "@/lib/admin/dados/consultas"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import {
  type ColunaCozinha,
  colunasDaCozinha,
  type FiltroCozinha,
  rodadasNaCozinha,
  rodadasNovas,
} from "@/lib/admin/regras/cozinha"
import { tomDoStatus } from "@/lib/admin/regras/status"
import { tocarAlerta } from "@/lib/admin/som"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { Traco } from "../traco"
import { TicketCozinha } from "./ticket-cozinha"

const FILTROS: { valor: FiltroCozinha; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "mesas", rotulo: "Mesas" },
  { valor: "entrega", rotulo: "Entrega" },
  { valor: "retirada", rotulo: "Retirada" },
]

/** O que chega em cada coluna: a coluna vazia ensina, em vez de só dizer "nada". */
const VAZIA: Record<ColunaCozinha["id"], string> = {
  afazer: "Os pedidos novos e as rodadas das mesas chegam aqui.",
  preparando: "Toque em Iniciar preparo num ticket de A fazer.",
  prontos: "Marque um ticket como pronto e ele vem para cá.",
}

/** Toca o alerta quando chega pedido novo ou rodada nova de uma comanda. */
function useAlertaDeRodadas(pedidos: Pedido[] | undefined) {
  const conhecidas = useRef<Set<string> | null>(null)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const tipoSom = useSomDoAparelho()

  useEffect(() => {
    if (!pedidos) return
    // Na primeira leitura não há "novo": é o que já estava na tela.
    if (conhecidas.current && somLigado && rodadasNovas(conhecidas.current, pedidos).length > 0) {
      tocarAlerta(tipoSom)
    }
    conhecidas.current = rodadasNaCozinha(pedidos)
  }, [pedidos, somLigado, tipoSom])
}

function Coluna({
  coluna,
  agora,
  emAndamento,
  aoAvancar,
  comTitulo,
}: {
  coluna: ColunaCozinha
  agora: Date
  emAndamento: number | undefined
  aoAvancar: (pedido: Pedido) => void
  comTitulo: boolean
}) {
  return (
    <section
      aria-label={`${coluna.titulo}, ${coluna.pedidos.length}`}
      // Coluna sem bandeja: os tickets ficam direto na folha, e um fio separa as colunas.
      className="flex min-w-0 flex-col gap-2.5 md:px-3 md:first:pl-0 md:last:pr-0"
    >
      {comTitulo && (
        <h2 className="flex items-center gap-2 pb-1 text-[15px] font-semibold">
          <Traco tom={tomDoStatus(coluna.status)} />
          {coluna.titulo}
          <span className="ml-auto text-[13px] font-medium text-muted-foreground tabular-nums">
            <NumberFlow value={coluna.pedidos.length} />
          </span>
        </h2>
      )}
      {coluna.pedidos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-balance text-muted-foreground">
          {VAZIA[coluna.id]}
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {coluna.pedidos.map((pedido) => (
            <TicketCozinha
              key={pedido.id}
              pedido={pedido}
              agora={agora}
              ocupado={emAndamento === pedido.id}
              aoAvancar={() => aoAvancar(pedido)}
            />
          ))}
        </AnimatePresence>
      )}
    </section>
  )
}

/**
 * Tela da cozinha (KDS): o que preparar agora, da rodada nova de cada comanda e dos
 * pedidos do site e do balcão. Pronto sai daqui: entrega e retirada seguem pela Fila
 * e a mesa fecha a conta em Mesas.
 */
export function PaginaCozinha({ intervalo = 4_000 }: { intervalo?: number }) {
  usePreferenciasCarregadas()
  const agora = useAgora(15_000)
  const telaGrande = useTelaGrande()
  const { data: pedidos } = useCozinha(intervalo)
  const avancar = useAvancarPedido()
  const [filtro, setFiltro] = useState<FiltroCozinha>("todos")
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const ligarSom = usePreferenciasFila((estado) => estado.ligarSom)
  const tipoSom = useSomDoAparelho()
  const quadro = useRef<HTMLDivElement>(null)
  useAlertaDeRodadas(pedidos)

  const colunas = pedidos && agora ? colunasDaCozinha(pedidos, filtro, agora) : null
  const aoAvancar = (pedido: Pedido) =>
    avancar.mutate(
      // A fila fica sabendo que foi a Cozinha (avisa quando fica pronto).
      { id: pedido.id, de: pedido.status, por: "cozinha" },
      { onError: (erro) => toast.error(erro.message) },
    )
  const emAndamento = avancar.isPending ? avancar.variables?.id : undefined

  return (
    // Em tela cheia o quadro vira a página toda: precisa do próprio fundo.
    <div ref={quadro} className="flex flex-1 flex-col gap-5 bg-background p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Cozinha"
        vivo
        resumo={
          colunas
            ? `${colunas[0].pedidos.length} a fazer · ${colunas[1].pedidos.length} preparando`
            : "Carregando a cozinha…"
        }
        acoes={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void quadro.current?.requestFullscreen?.()}
          >
            <MaximizeIcon data-icon="inline-start" />
            Tela cheia
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border/70 py-3">
        <ToggleGroup
          type="single"
          variant="segmento"
          size="sm"
          aria-label="Mostrar"
          value={filtro}
          onValueChange={(valor) => valor && setFiltro(valor as FiltroCozinha)}
        >
          {FILTROS.map(({ valor, rotulo }) => (
            <ToggleGroupItem key={valor} value={valor}>
              {rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Switch
            id="cozinha-alerta"
            checked={somLigado}
            onCheckedChange={(ligado) => {
              ligarSom(ligado)
              // O toque na chave libera o som no navegador.
              if (ligado) tocarAlerta(tipoSom)
            }}
          />
          <Label htmlFor="cozinha-alerta" className="cursor-pointer">
            Alerta sonoro
          </Label>
        </div>
      </div>

      {!colunas || !agora ? (
        // Esqueleto no formato do quadro: as pistas com o título e dois tickets.
        <div role="status" aria-label="Carregando a cozinha" className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((indice) => (
            <div key={indice} className="flex flex-col gap-2.5 max-md:not-first:hidden">
              <Skeleton className="mb-1 h-4 w-24" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          ))}
        </div>
      ) : colunas.every((coluna) => coluna.pedidos.length === 0) ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChefHatIcon />
            </EmptyMedia>
            <EmptyTitle>Nada para preparar</EmptyTitle>
            <EmptyDescription>
              Os pedidos e as rodadas novas aparecem aqui sozinhos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : telaGrande ? (
        <div className="grid grid-cols-3 items-stretch divide-x divide-border/70">
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              agora={agora}
              emAndamento={emAndamento}
              aoAvancar={aoAvancar}
              comTitulo
            />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={colunas[0].id}>
          <TabsList className="w-full">
            {colunas.map((coluna) => (
              // Texto da aba inativa mais forte: o padrão não passa no contraste sobre o fundo cinza.
              <TabsTrigger
                key={coluna.id}
                value={coluna.id}
                className="gap-1.5 text-foreground/80 dark:text-foreground/80"
              >
                <Traco tom={tomDoStatus(coluna.status)} />
                {coluna.titulo}
                <span className="text-xs tabular-nums">{coluna.pedidos.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {colunas.map((coluna) => (
            <TabsContent key={coluna.id} value={coluna.id}>
              <Coluna
                coluna={coluna}
                agora={agora}
                emAndamento={emAndamento}
                aoAvancar={aoAvancar}
                comTitulo={false}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
