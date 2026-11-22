"use client"

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type Modifier,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { MoveIcon } from "lucide-react"
import { type RefObject, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePosicionarMesas } from "@/lib/admin/dados/consultas-mesas"
import type { AreaSalao, Mesa, PosicaoMesa } from "@/lib/admin/dados/tipos"
import type { MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import {
  arrastar,
  colide,
  type Direcao,
  descreverPosicao,
  FUNCOES_PRO_SALAO,
  GRADE_MAPA,
  moverPorTeclado,
  tamanhoDaMesa,
} from "@/lib/admin/regras/salao"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { SeloPro } from "../campos"
import { Traco } from "../traco"
import { descricaoDaMesa, MenuMesa } from "./cartao-mesa"

type AcoesNoMapa = {
  aoAbrir: (linha: MesaNaGrade) => void
  /** Recebem o botão ⋯, para onde o foco volta quando a janela fecha. */
  aoEditar: (linha: MesaNaGrade, gatilho: HTMLElement | null) => void
  aoBloquear: (linha: MesaNaGrade, gatilho: HTMLElement | null) => void
}

/** Ordem de leitura do desenho: linha, depois coluna. O Tab segue o mapa. */
const emOrdemDeLeitura = (a: MesaNaGrade, b: MesaNaGrade) =>
  a.mesa.posicao.y - b.mesa.posicao.y || a.mesa.posicao.x - b.mesa.posicao.x

/** As cadeiras em volta da mesa: metade em cima, metade embaixo. Só desenho. */
function Cadeiras({ lugares }: { lugares: number }) {
  const lado = (quantas: number, onde: string) => (
    <span aria-hidden="true" className={cn("absolute inset-x-2 flex justify-around", onde)}>
      {Array.from({ length: quantas }, (_, indice) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cadeiras iguais, só desenho
        <span key={indice} className="h-1 w-2.5 rounded-full bg-foreground/20" />
      ))}
    </span>
  )
  return (
    <>
      {lado(Math.ceil(lugares / 2), "top-0")}
      {lado(Math.floor(lugares / 2), "bottom-0")}
    </>
  )
}

const SETAS: Record<string, Direcao> = {
  ArrowLeft: "esquerda",
  ArrowRight: "direita",
  ArrowUp: "cima",
  ArrowDown: "baixo",
}

const INSTRUCAO = "Use Tab para escolher a mesa e as setas para mover. Com Shift, anda 4 células."

function MesaNoMapa({
  linha,
  agora,
  editando,
  posicao,
  sobreOutra,
  aoMover,
  aoAbrir,
  aoEditar,
  aoBloquear,
}: AcoesNoMapa & {
  linha: MesaNaGrade
  agora: Date | null
  editando: boolean
  /** A posição na tela: a do rascunho, na edição. */
  posicao: PosicaoMesa
  sobreOutra: boolean
  aoMover: (direcao: Direcao, passo: 1 | 4) => void
}) {
  const { mesa, comanda, estado, alertas } = linha
  const { largura, altura } = tamanhoDaMesa(mesa)
  const ocupada = mesa.status === "ocupada"
  const alerta = alertas[0]
  // Só o arrasto pelo ponteiro: o teclado é das setas, com o foco na mesa.
  const arraste = useDraggable({ id: mesa.id, disabled: !editando })
  return (
    <li
      ref={arraste.setNodeRef}
      className={cn(
        // A mesa que está sendo movida fica por cima das outras.
        "relative p-1.5 focus-within:z-10",
        arraste.isDragging && "z-10 opacity-90",
      )}
      style={{
        gridColumn: `${posicao.x + 1} / span ${largura}`,
        gridRow: `${posicao.y + 1} / span ${altura}`,
        transform: CSS.Translate.toString(arraste.transform),
      }}
    >
      <Cadeiras lugares={mesa.lugares} />
      <button
        type="button"
        {...(editando ? arraste.listeners : {})}
        onClick={() => !editando && aoAbrir(linha)}
        onKeyDown={(evento) => {
          const direcao = editando ? SETAS[evento.key] : undefined
          if (!direcao) return
          evento.preventDefault()
          aoMover(direcao, evento.shiftKey ? 4 : 1)
        }}
        aria-labelledby={`mapa-${mesa.id}`}
        aria-describedby={`mapa-${mesa.id}-detalhes`}
        data-alerta={alerta?.tipo}
        className={cn(
          "flex size-full cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-center outline-none",
          "transition-[transform,box-shadow,background-color] duration-150 ease-saida active:scale-[0.97] motion-reduce:transition-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          mesa.forma === "redonda" ? "rounded-full" : "rounded-lg",
          editando && "cursor-grab touch-none active:cursor-grabbing",
          ocupada
            ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1"
            : "bg-foreground/[0.04] ring-1 ring-border/60 hover:bg-foreground/[0.07]",
          // O alerta pede o olho com a cor da ação (tom novo), nunca com o vermelho de erro.
          ocupada && (alerta ? "ring-2 ring-(--tom-novo)" : "ring-border/80"),
          // Por cima de outra mesa no rascunho: é erro, e o salvar recusa.
          sobreOutra && "ring-2 ring-destructive",
        )}
      >
        {/* O nome é o da grade ("Mesa 3"); na planta só cabe o número. */}
        <span id={`mapa-${mesa.id}`} className="sr-only">
          Mesa {mesa.numero}
        </span>
        <span aria-hidden="true" className="-mt-3.5 text-[15px] leading-none font-semibold">
          {mesa.numero}
        </span>

        <span id={`mapa-${mesa.id}-detalhes`} className="sr-only">
          {editando
            ? [descreverPosicao(posicao), sobreOutra ? "sobre outra mesa" : null]
                .filter(Boolean)
                .join(", ")
            : descricaoDaMesa(linha, agora)}
        </span>
      </button>
      {/* O estado fica por cima do botão, fora dele: dentro, o texto visível não caberia no nome
          "Mesa 3" (a descrição falada já começa pelo estado). */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-2 top-1/2 mt-1 flex items-center justify-center gap-1 text-[11px] leading-tight font-medium",
          !ocupada && "text-muted-foreground",
        )}
      >
        <Traco tom={estado.tom} className="h-2.5" />
        <span className="truncate">{estado.rotulo}</span>
      </span>
      {!editando && (
        <MenuMesa
          mesa={mesa}
          comanda={comanda}
          estado={estado.estado}
          aoAbrir={() => aoAbrir(linha)}
          aoEditar={(gatilho) => aoEditar(linha, gatilho)}
          aoBloquear={(gatilho) => aoBloquear(linha, gatilho)}
          className="absolute top-0 right-0 size-6 rounded-full bg-background/80"
        />
      )}
    </li>
  )
}

/** O tamanho de uma célula da planta, em pixels. */
function celulaDa(planta: RefObject<HTMLUListElement | null>) {
  const caixa = planta.current?.getBoundingClientRect()
  return {
    largura: (caixa?.width ?? 0) / GRADE_MAPA.colunas,
    altura: (caixa?.height ?? 0) / GRADE_MAPA.linhas,
  }
}

/** Enquanto arrasta, a mesa anda de célula em célula (o encaixe). */
const encaixarNa =
  (planta: RefObject<HTMLUListElement | null>): Modifier =>
  ({ transform }) => {
    const { largura, altura } = celulaDa(planta)
    if (!largura || !altura) return transform
    return {
      ...transform,
      x: Math.round(transform.x / largura) * largura,
      y: Math.round(transform.y / altura) * altura,
    }
  }

/** O arrasto fala pela região viva do mapa, ao soltar; o dnd-kit fica calado. */
const ANUNCIOS_DO_ARRASTE: Announcements = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
}

/** As mesas como estão na tela: na edição, com as posições do rascunho. */
const naTela = (linhas: MesaNaGrade[], rascunho: Map<string, PosicaoMesa>): Mesa[] =>
  linhas.map(({ mesa }) => ({ ...mesa, posicao: rascunho.get(mesa.id) ?? mesa.posicao }))

/** A planta de uma área: a grade 24 × 16, com as mesas nos lugares delas. */
function Planta({
  area,
  linhas,
  agora,
  editando,
  rascunho,
  aoMover,
  ...acoes
}: AcoesNoMapa & {
  area: AreaSalao
  linhas: MesaNaGrade[]
  agora: Date | null
  editando: boolean
  rascunho: Map<string, PosicaoMesa>
  aoMover: (mesa: Mesa, posicao: PosicaoMesa) => void
}) {
  const mesas = naTela(linhas, rascunho)
  const naPlanta = (linha: MesaNaGrade) =>
    mesas.find((mesa) => mesa.id === linha.mesa.id) ?? linha.mesa
  const planta = useRef<HTMLUListElement>(null)
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const soltar = ({ active, delta }: DragEndEvent) => {
    const mesa = mesas.find((item) => item.id === active.id)
    if (mesa) aoMover(mesa, arrastar(mesa, delta, celulaDa(planta)))
  }
  return (
    // No celular a planta rola de lado dentro da própria faixa; a página não.
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <DndContext
        sensors={sensores}
        modifiers={[encaixarNa(planta)]}
        onDragEnd={soltar}
        accessibility={{
          announcements: ANUNCIOS_DO_ARRASTE,
          screenReaderInstructions: { draggable: INSTRUCAO },
        }}
      >
        <ul
          ref={planta}
          aria-label={`Mapa: ${area.nome}`}
          aria-describedby={editando ? "mapa-instrucao" : undefined}
          className="grid aspect-[3/2] min-w-[720px] rounded-xl border border-border/70 bg-foreground/[0.015] bg-[size:calc(100%/24)_calc(100%/16)] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] p-0"
          style={{
            gridTemplateColumns: `repeat(${GRADE_MAPA.colunas}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRADE_MAPA.linhas}, minmax(0, 1fr))`,
          }}
        >
          {/* A ordem é a do mapa salvo: mover no rascunho não mexe no DOM nem tira o foco. */}
          {linhas.toSorted(emOrdemDeLeitura).map((linha) => (
            <MesaNoMapa
              key={linha.mesa.id}
              linha={linha}
              agora={agora}
              editando={editando}
              posicao={naPlanta(linha).posicao}
              sobreOutra={colide(naPlanta(linha), mesas)}
              aoMover={(direcao, passo) =>
                aoMover(naPlanta(linha), moverPorTeclado(naPlanta(linha), direcao, passo))
              }
              {...acoes}
            />
          ))}
        </ul>
      </DndContext>
      {editando && (
        <p id="mapa-instrucao" className="sr-only">
          {INSTRUCAO}
        </p>
      )}
    </div>
  )
}

/** O mapa do salão: uma aba por área (só as que têm mesa) e a planta da área escolhida. */
export function MapaSalao({
  linhas,
  areas,
  areaId,
  aoMudarArea,
  agora,
  podeEditar,
  editando,
  aoMudarEdicao: mudarEdicao,
  ...acoes
}: AcoesNoMapa & {
  linhas: MesaNaGrade[]
  areas: AreaSalao[]
  /** A área do endereço (`?area=`); sem ela, a primeira. */
  areaId: string | null
  aoMudarArea: (areaId: string) => void
  agora: Date | null
  /** Tablet para cima: no celular o mapa só é visto. */
  podeEditar: boolean
  editando: boolean
  aoMudarEdicao: (editando: boolean) => void
}) {
  const posicionar = usePosicionarMesas()
  const [rascunho, setRascunho] = useState(() => new Map<string, PosicaoMesa>())
  const [anuncio, setAnuncio] = useState("")
  const daArea = (area: AreaSalao) => linhas.filter(({ mesa }) => mesa.areaId === area.id)
  const comMesa = areas
    .toSorted((a, b) => a.ordem - b.ordem)
    .filter((area) => daArea(area).length > 0)
  const atual = comMesa.find((area) => area.id === areaId) ?? comMesa[0]

  const aoMudarEdicao = (editar: boolean) => {
    setRascunho(new Map())
    setAnuncio("")
    mudarEdicao(editar)
  }

  const mover = (mesa: Mesa, posicao: PosicaoMesa) => {
    const proximo = new Map(rascunho).set(mesa.id, posicao)
    setRascunho(proximo)
    const movida = { ...mesa, posicao }
    const sobre = colide(movida, naTela(daArea(atual), proximo))
    setAnuncio(
      `Mesa ${mesa.numero}: ${descreverPosicao(posicao)}${sobre ? ", sobre outra mesa" : ""}`,
    )
  }

  /** Confere por cima de outra na tela e manda só as mesas que mudaram de lugar. */
  const salvar = () => {
    const mesas = naTela(daArea(atual), rascunho)
    const porCima = mesas.find((mesa) => colide(mesa, mesas))
    if (porCima) {
      toast.error(`A mesa ${porCima.numero} está sobre outra mesa. Mova antes de salvar.`)
      return
    }
    const lote = daArea(atual).flatMap(({ mesa }) => {
      const posicao = rascunho.get(mesa.id)
      const mudou = posicao && (posicao.x !== mesa.posicao.x || posicao.y !== mesa.posicao.y)
      return mudou ? [{ id: mesa.id, posicao }] : []
    })
    if (lote.length === 0) {
      aoMudarEdicao(false)
      return
    }
    posicionar.mutate(lote, {
      onSuccess: () => {
        toast.success("Mapa salvo.")
        aoMudarEdicao(false)
      },
      onError: (erro: Error) => toast.error(erro.message),
    })
  }

  if (!atual) return null
  return (
    <Tabs value={atual.id} onValueChange={aoMudarArea} className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList aria-label="Áreas">
          {comMesa.map((area) => (
            // Texto da aba inativa mais forte: o padrão não passa no contraste sobre o fundo cinza.
            <TabsTrigger
              key={area.id}
              value={area.id}
              disabled={editando}
              className="text-foreground/80 dark:text-foreground/80"
            >
              {area.nome}
            </TabsTrigger>
          ))}
        </TabsList>
        {editando ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => aoMudarEdicao(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={posicionar.isPending} onClick={salvar}>
              Salvar posições
            </Button>
          </div>
        ) : (
          podeEditar && (
            <Button type="button" size="sm" variant="outline" onClick={() => aoMudarEdicao(true)}>
              <MoveIcon data-icon="inline-start" />
              Editar mapa
            </Button>
          )
        )}
      </div>
      {comMesa.map((area) => (
        <TabsContent key={area.id} value={area.id}>
          <Planta
            area={area}
            linhas={daArea(area)}
            agora={agora}
            editando={editando}
            rascunho={rascunho}
            aoMover={mover}
            {...acoes}
          />
        </TabsContent>
      ))}
      {/* Sempre montada, só o texto muda: assim o leitor de tela anuncia cada movimento. */}
      <output aria-live="polite" className="sr-only">
        {anuncio}
      </output>
    </Tabs>
  )
}

/** A explicação do mapa quando a função Pro está desligada no salão. */
export function MapaPro({
  aberta,
  aoMudar,
  aoConfigurar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoConfigurar: () => void
}) {
  const { preco } = FUNCOES_PRO_SALAO.mapa
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <SeloPro liberada={false} className="w-fit" />
          <DialogTitle>Mapa do salão é Pro</DialogTitle>
          <DialogDescription>
            Veja as mesas na planta de cada área, com o estado de cada uma, e monte o salão
            arrastando as mesas. {emReais(preco)} por mês no plano Pro. Ligue em Configurar salão,
            em Funções Pro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => aoMudar(false)}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              aoMudar(false)
              aoConfigurar()
            }}
          >
            Abrir Configurar salão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
