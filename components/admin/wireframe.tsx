"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { EyeIcon, EyeOffIcon, GripVerticalIcon, LockIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  type Bloco,
  type BlocoId,
  type ExibicaoBloco,
  nomeDoBloco,
  useConfig,
  useOpcaoPro,
} from "@/lib/admin/config"
import { cn } from "@/lib/utils"
import { avisarSacola, SeloPro } from "./campos"
import { usePrevia } from "./previa/estado"
import { useFocoNaPrevia } from "./previa/foco"

const ROTULO_EXIBICAO: Record<ExibicaoBloco, string> = {
  padrao: "Padrão",
  grade: "Grade",
  lista: "Lista",
  carrossel: "Carrossel",
}

/** Desenho do bloco no wireframe: cada tipo de seção tem o seu esqueleto. */
function Esqueleto({ id, exibicao }: { id: BlocoId; exibicao: ExibicaoBloco }) {
  const barra = "rounded-[3px] bg-muted-foreground/25"
  if (id === "promocional") {
    return <div className="h-7 rounded-md bg-linear-to-r from-primary/50 to-marca-acento/50" />
  }
  if (id === "avaliacoes") {
    return (
      <div className="flex gap-1">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex h-7 flex-1 flex-col justify-center gap-1 rounded-md bg-foreground/8 px-1.5"
          >
            <span className={cn(barra, "h-1 w-1/2 bg-[#F5B700]/70")} />
            <span className={cn(barra, "h-1 w-4/5")} />
          </div>
        ))}
      </div>
    )
  }
  if (exibicao === "carrossel" || (id === "mais-pedidas" && exibicao === "padrao")) {
    return (
      <div className="flex gap-1 overflow-hidden">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-8 w-[30%] shrink-0 rounded-md bg-foreground/8" />
        ))}
      </div>
    )
  }
  if (exibicao === "lista") {
    return (
      <div className="flex flex-col gap-1">
        {[0, 1].map((item) => (
          <div key={item} className="flex h-3.5 items-center gap-1 rounded-sm bg-foreground/8 px-1">
            <span className="size-2 rounded-[2px] bg-muted-foreground/30" />
            <span className={cn(barra, "h-1 w-1/3")} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-8 rounded-md bg-foreground/8" />
      ))}
    </div>
  )
}

function LinhaBloco({ bloco }: { bloco: Bloco }) {
  const blocos = useConfig((estado) => estado.config.inicio.blocos)
  const atualizar = useConfig((estado) => estado.atualizar)
  const { ehPro, bloqueada, naSacola, liberada } = useOpcaoPro(`inicio.bloco:${bloco.id}`)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloco.id,
  })
  const nome = nomeDoBloco(bloco.id)
  const ativo = bloco.ativo
  const categoria = bloco.id.startsWith("categoria:")
  // Mostra na prévia onde este bloco fica (ou que está desligado).
  const { avisar, eventos } = useFocoNaPrevia({
    alvo: `bloco:${bloco.id}`,
    secao: "Página inicial",
    rotulo: nome,
    desligado: !ativo,
  })

  function mudar(parcial: Partial<Bloco>) {
    atualizar("inicio", {
      blocos: blocos.map((item) => (item.id === bloco.id ? { ...item, ...parcial } : item)),
    })
    avisar(parcial.ativo === undefined ? {} : { desligado: !parcial.ativo })
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-pro-liberada={liberada || undefined}
      data-testid={`bloco-${bloco.id}`}
      {...eventos}
      className={cn(
        "relative flex items-stretch gap-2 rounded-2xl bg-card p-2 ring-1 ring-border",
        isDragging && "z-10 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)] ring-2 ring-primary",
        liberada && "opcao-pro",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        // Entra na tela na hora, sem a rolagem suave da página: o arraste pelo teclado
        // mede as posições logo em seguida e erraria o alvo no meio da animação.
        onFocus={(evento) =>
          evento.currentTarget.scrollIntoView({ block: "nearest", behavior: "instant" })
        }
        aria-label={`Mover ${nome}. Use espaço e as setas para mudar a posição.`}
        className="grid w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 py-0.5", !ativo && "opacity-45")}>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{nome}</span>
          {ehPro && <SeloPro liberada={liberada} naSacola={naSacola} />}
          {!ativo && <EyeOffIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
        </div>
        <Esqueleto id={bloco.id} exibicao={bloco.exibicao} />
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <Switch
          checked={ativo}
          aria-label={`Mostrar ${nome}`}
          onCheckedChange={(marcado) => {
            mudar({ ativo: marcado })
            if (marcado && bloqueada) avisarSacola(nome)
          }}
        />
        {(categoria || bloco.id === "mais-pedidas" || bloco.id === "ofertas") && (
          <Select
            value={bloco.exibicao}
            onValueChange={(valor) => mudar({ exibicao: valor as ExibicaoBloco })}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-[116px] text-xs"
              aria-label={`Disposição de ${nome}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(Object.keys(ROTULO_EXIBICAO) as ExibicaoBloco[]).map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ROTULO_EXIBICAO[valor]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>
    </li>
  )
}

function Fixo({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2.5 text-muted-foreground">
      <LockIcon className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="text-xs">{descricao}</p>
      </div>
    </div>
  )
}

/**
 * Wireframe da página inicial: arraste os blocos para mudar a ordem, ligue e desligue
 * cada um e escolha como os produtos aparecem. Cabeçalho e rodapé ficam presos.
 */
export function Wireframe() {
  const blocos = useConfig((estado) => estado.config.inicio.blocos)
  const atualizar = useConfig((estado) => estado.atualizar)
  const definirTela = usePrevia((estado) => estado.definirTela)
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Rolagem instantânea a cada passo: com a suave, as setas mediam o bloco no meio do caminho.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "instant",
    }),
  )

  function soltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const de = blocos.findIndex((bloco) => bloco.id === active.id)
    const para = blocos.findIndex((bloco) => bloco.id === over.id)
    atualizar("inicio", { blocos: arrayMove(blocos, de, para) })
    definirTela("inicio")
  }

  return (
    <div className="flex flex-col gap-2" data-testid="wireframe">
      <Fixo titulo="Cabeçalho" descricao="Banner, logo, nome e informações da loja" />
      <DndContext
        sensors={sensores}
        collisionDetection={closestCenter}
        // A página rola enquanto o bloco anda pelo teclado: mede de novo a cada passo.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragEnd={soltar}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Movendo ${nomeDoBloco(active.id as BlocoId)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${nomeDoBloco(active.id as BlocoId)} sobre ${nomeDoBloco(over.id as BlocoId)}.`
                : "",
            onDragEnd: ({ active }) =>
              `${nomeDoBloco(active.id as BlocoId)} solto na nova posição.`,
            onDragCancel: () => "Movimento cancelado.",
          },
          screenReaderInstructions: {
            draggable:
              "Para mover, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar.",
          },
        }}
      >
        <SortableContext
          items={blocos.map((bloco) => bloco.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {blocos.map((bloco) => (
              <LinhaBloco key={bloco.id} bloco={bloco} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Fixo titulo="Rodapé" descricao="Sempre no fim da página" />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <EyeIcon className="size-3.5" aria-hidden="true" />
        Blocos desligados continuam aqui, prontos para voltar quando quiser.
      </p>
    </div>
  )
}
