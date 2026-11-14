"use client"

import { ChefHatIcon, MaximizeIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { tocarAlerta } from "@/lib/admin/som"
import { TicketCozinha } from "./ticket-cozinha"

const FILTROS: { valor: FiltroCozinha; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "mesas", rotulo: "Mesas" },
  { valor: "entrega", rotulo: "Entrega" },
  { valor: "retirada", rotulo: "Retirada" },
]

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
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/50 p-2"
    >
      {comTitulo && (
        <h2 className="flex items-center gap-2 px-1 pt-1 text-base font-semibold">
          {coluna.titulo}
          <Badge variant="secondary" className="tabular-nums">
            {coluna.pedidos.length}
          </Badge>
        </h2>
      )}
      {coluna.pedidos.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nada aqui.</p>
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
      { id: pedido.id, de: pedido.status },
      { onError: (erro) => toast.error(erro.message) },
    )
  const emAndamento = avancar.isPending ? avancar.variables?.id : undefined

  return (
    <div ref={quadro} className="flex flex-1 flex-col gap-5 bg-background p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cozinha</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {colunas
              ? `${colunas[0].pedidos.length} a fazer · ${colunas[1].pedidos.length} preparando`
              : "Carregando a cozinha…"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => void quadro.current?.requestFullscreen?.()}
        >
          <MaximizeIcon data-icon="inline-start" />
          Tela cheia
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card px-4 py-3">
        <ToggleGroup
          type="single"
          variant="outline"
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
        <div role="status" aria-label="Carregando a cozinha" className="grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((indice) => (
            <Skeleton key={indice} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : colunas.every((coluna) => coluna.pedidos.length === 0) ? (
        <Empty className="border">
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
        <div className="grid grid-cols-3 items-start gap-3">
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
