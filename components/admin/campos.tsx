"use client"

import {
  LockIcon,
  MonitorIcon,
  RotateCcwIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type Config, ehPro, type SecaoConfig, useConfig, useOpcaoPro } from "@/lib/admin/config"
import { buscarSecao } from "@/lib/admin/secoes"
import { cn } from "@/lib/utils"
import { BlocoSecao } from "./bloco-secao"
import { type Dispositivo, usePrevia } from "./previa/estado"
import { useFocoNaPrevia } from "./previa/foco"

/** Campos de uma seção cujo valor é do tipo `V`. */
type CampoDe<S extends SecaoConfig, V> = {
  [K in keyof Config[S]]: Config[S][K] extends V ? K : never
}[keyof Config[S]] &
  string

/**
 * Valor de um campo da configuração e como mudá-lo. Mexer no campo (passar o mouse, focar ou
 * mudar o valor) mostra na prévia a seção e o item; `eventos` vai no elemento do campo.
 */
function useCampo<S extends SecaoConfig, K extends keyof Config[S]>(
  secao: S,
  campo: K,
  titulo: string,
) {
  const valor = useConfig((estado) => estado.config[secao][campo])
  const atualizar = useConfig((estado) => estado.atualizar)
  const { avisar, eventos } = useFocoNaPrevia({
    alvo: `${secao}.${String(campo)}`,
    secao: buscarSecao(secao)?.titulo ?? secao,
    rotulo: titulo,
  })
  const definir = (novo: Config[S][K]) => {
    atualizar(secao, { [campo]: novo } as unknown as Partial<Config[S]>)
    avisar()
  }
  return [valor, definir, eventos] as const
}

/**
 * Uma opção Pro foi escolhida sem estar contratada: ela já vale na prévia e
 * entra na sacola do painel, para contratar na hora de aplicar no site.
 */
export function avisarSacola(nome: string) {
  toast(`${nome} foi para a sacola`, {
    id: `sacola-${nome}`,
    description: "Já aparece na prévia. Você contrata ao aplicar no site.",
    icon: <ShoppingBagIcon className="size-4" />,
    action: {
      label: "Ver sacola",
      onClick: () => useConfig.getState().abrirSacola(true),
    },
  })
}

export function liberarPro() {
  useConfig.getState().contratar("tudo")
  toast.success("Recursos Pro liberados", {
    description: "As opções liberadas agora brilham nas configurações.",
    icon: <SparklesIcon className="size-4" />,
  })
}

/**
 * Selo das opções pagas, igual em todo o painel: cadeado discreto enquanto bloqueada,
 * sacola quando escolhida e ainda não contratada, e o brilho dourado depois de liberada,
 * que é o único momento chamativo do plano Pro.
 */
export function SeloPro({
  liberada,
  naSacola = false,
  className,
}: {
  liberada: boolean
  naSacola?: boolean
  className?: string
}) {
  // Mesmo tamanho nos três estados: a troca de um para o outro não mexe a linha.
  const base = "h-5 shrink-0 gap-1 px-1.5 text-xs font-semibold"
  if (naSacola) {
    return (
      <Badge
        variant="outline"
        className={cn(base, "border-(--tom-preparo)/45 text-(--tom-preparo)", className)}
      >
        <ShoppingBagIcon data-icon="inline-start" className="size-3" />
        Na sacola
      </Badge>
    )
  }
  if (liberada) {
    return (
      <Badge data-pro-liberada className={cn("selo-pro", base, className)}>
        <SparklesIcon data-icon="inline-start" className="size-3" />
        Pro
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn("selo-pro", base, className)}>
      <LockIcon data-icon="inline-start" className="size-3" />
      Pro
    </Badge>
  )
}

/**
 * Opção escolhível (cartão de rádio): folha branca com fio fino; a escolhida ganha o
 * anel na tinta, com transição curta. Vale para escolhas, paletas e planos.
 */
export const CLASSE_OPCAO = cn(
  "rounded-xl bg-card transition-[border-color,box-shadow,scale] duration-150 ease-saida active:scale-[0.99] motion-reduce:active:scale-100",
  "has-[>[data-slot=field]]:border-border/80 has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:border-foreground/30 has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-card",
  "has-data-checked:border-foreground has-data-checked:bg-card has-data-checked:ring-1 has-data-checked:ring-foreground",
  "dark:has-data-checked:border-foreground dark:has-data-checked:bg-card",
)

/* ------------------------------------------------------------------ */

type BlocoConfigProps = {
  titulo: string
  descricao?: string
  /** Seção que o botão "Restaurar" volta ao padrão. */
  restaurar?: SecaoConfig
  children: ReactNode
}

/**
 * Um grupo de ajustes dentro de uma seção: bloco plano com fio no topo, título e
 * descrição curtos, e os campos numa coluna com o mesmo espaço entre eles.
 */
export function BlocoConfig({ titulo, descricao, restaurar, children }: BlocoConfigProps) {
  const restaurarSecao = useConfig((estado) => estado.restaurarSecao)
  const atualizar = useConfig((estado) => estado.atualizar)
  return (
    <BlocoSecao
      titulo={titulo}
      descricao={descricao}
      acao={
        restaurar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-my-1 text-muted-foreground max-md:min-h-11"
            onClick={() => {
              // Guarda o que havia antes: o aviso deixa voltar atrás, sem pedir confirmação.
              const anterior = useConfig.getState().config[restaurar]
              restaurarSecao(restaurar)
              toast("Seção restaurada para o padrão", {
                action: {
                  label: "Desfazer",
                  onClick: () => atualizar(restaurar, anterior),
                },
              })
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Restaurar
          </Button>
        )
      }
    >
      <FieldGroup className="gap-6">{children}</FieldGroup>
    </BlocoSecao>
  )
}

/* ------------------------------------------------------------------ */

type CampoSwitchProps<S extends SecaoConfig> = {
  secao: S
  campo: CampoDe<S, boolean>
  titulo: string
  descricao?: string
}

/** Liga e desliga, com título e explicação. Ligar uma opção Pro não contratada a põe na sacola. */
export function CampoSwitch<S extends SecaoConfig>({
  secao,
  campo,
  titulo,
  descricao,
}: CampoSwitchProps<S>) {
  const [valor, definir, eventos] = useCampo(secao, campo, titulo)
  const { ehPro, bloqueada, naSacola, liberada } = useOpcaoPro(`${secao}.${campo}`)
  const id = `campo-${secao}-${campo}`

  return (
    <Field
      {...eventos}
      orientation="horizontal"
      data-pro-liberada={liberada || undefined}
      className={cn("rounded-xl", liberada && "opcao-pro -m-2 w-auto p-2")}
    >
      <FieldContent>
        <FieldLabel htmlFor={id} className="flex flex-wrap items-center gap-2">
          {titulo}
          {ehPro && <SeloPro liberada={liberada} naSacola={naSacola} />}
        </FieldLabel>
        {descricao && <FieldDescription>{descricao}</FieldDescription>}
      </FieldContent>
      <Switch
        id={id}
        checked={Boolean(valor)}
        aria-describedby={bloqueada ? `${id}-pro` : undefined}
        onCheckedChange={(marcado) => {
          definir(marcado as Config[S][typeof campo])
          if (marcado && bloqueada) avisarSacola(titulo)
        }}
      />
      {bloqueada && (
        <span id={`${id}-pro`} className="sr-only">
          Recurso Pro: ao ligar, vai para a sacola do painel
        </span>
      )}
    </Field>
  )
}

/* ------------------------------------------------------------------ */

export type OpcaoEscolha<V extends string> = {
  valor: V
  rotulo: string
  descricao?: string
  /** Desenho pequeno que mostra a opção: miniatura, cor ou ícone. */
  visual?: ReactNode
  /** A opção muda a loja só nesse aparelho. */
  aparelho?: Dispositivo
}

/** Selo de ajuste que só muda a loja no celular ou só no computador. */
export function SeloAparelho({ aparelho }: { aparelho: Dispositivo }) {
  const celular = aparelho === "celular"
  return (
    <Badge variant="outline" className="shrink-0 gap-1 font-medium text-muted-foreground">
      {celular ? (
        <SmartphoneIcon data-icon="inline-start" />
      ) : (
        <MonitorIcon data-icon="inline-start" />
      )}
      {celular ? "Só no celular" : "Só no computador"}
    </Badge>
  )
}

/** Leva a prévia para o aparelho onde o ajuste aparece. */
function mostrarNoAparelho(aparelho: Dispositivo) {
  usePrevia.getState().definirDispositivo(aparelho)
}

type CampoEscolhaProps<S extends SecaoConfig, V extends string> = {
  secao: S
  campo: CampoDe<S, V>
  titulo: string
  descricao?: string
  opcoes: OpcaoEscolha<V>[]
  /** Colunas da grade de cartões em telas largas. */
  colunas?: 1 | 2 | 3
  /** Visual em cima (cartão alto) ou ao lado do texto. */
  formato?: "vertical" | "horizontal"
}

/** Escolha única em cartões (RadioGroup do shadcn), cada um com seu desenho. */
export function CampoEscolha<S extends SecaoConfig, V extends string>({
  secao,
  campo,
  titulo,
  descricao,
  opcoes,
  colunas = 2,
  formato = "horizontal",
}: CampoEscolhaProps<S, V>) {
  const [valor, definir, eventos] = useCampo(secao, campo, titulo)
  const liberadas = useConfig((estado) => (estado.pro ? "tudo" : estado.compradas))

  return (
    <Field {...eventos}>
      <FieldContent>
        <FieldTitle>{titulo}</FieldTitle>
        {descricao && <FieldDescription>{descricao}</FieldDescription>}
      </FieldContent>
      <RadioGroup
        value={String(valor)}
        aria-label={titulo}
        onValueChange={(novo) => {
          const opcao = opcoes.find((item) => item.valor === novo)
          if (!opcao) return
          definir(novo as Config[S][typeof campo])
          if (bloqueadaPro(`${secao}.${campo}:${novo}`, liberadas)) avisarSacola(opcao.rotulo)
          if (opcao.aparelho) mostrarNoAparelho(opcao.aparelho)
        }}
        className={cn(
          "grid gap-2",
          colunas === 2 && "@md/conteudo:grid-cols-2",
          colunas === 3 && "grid-cols-2 @lg/conteudo:grid-cols-3",
        )}
      >
        {opcoes.map((opcao) => (
          <CartaoEscolha
            key={opcao.valor}
            chave={`${secao}.${campo}:${opcao.valor}`}
            id={`escolha-${secao}-${campo}-${opcao.valor}`}
            opcao={opcao}
            formato={formato}
          />
        ))}
      </RadioGroup>
    </Field>
  )
}

function bloqueadaPro(chave: string, liberadas: string[] | "tudo") {
  return liberadas !== "tudo" && ehPro(chave) && !liberadas.includes(chave)
}

function CartaoEscolha<V extends string>({
  chave,
  id,
  opcao,
  formato,
}: {
  chave: string
  id: string
  opcao: OpcaoEscolha<V>
  formato: "vertical" | "horizontal"
}) {
  const { ehPro, bloqueada, naSacola, liberada } = useOpcaoPro(chave)

  return (
    <FieldLabel
      htmlFor={id}
      data-pro-liberada={liberada || undefined}
      className={cn("relative", CLASSE_OPCAO, liberada && "opcao-pro")}
    >
      <Field
        orientation={formato === "vertical" ? "vertical" : "horizontal"}
        className={cn("gap-3 p-3!", formato === "horizontal" ? "items-center" : "items-stretch")}
      >
        {opcao.visual && (
          <span
            aria-hidden="true"
            className={cn(
              "relative block shrink-0 overflow-hidden",
              formato === "vertical" ? "w-full" : "",
              bloqueada && !naSacola && "opacity-60 saturate-50",
            )}
          >
            {opcao.visual}
          </span>
        )}
        <FieldContent className="min-w-0">
          <FieldTitle className="flex w-full items-center gap-2">
            <span className="truncate">{opcao.rotulo}</span>
            {ehPro && <SeloPro liberada={liberada} naSacola={naSacola} className="ml-auto" />}
          </FieldTitle>
          {opcao.aparelho && <SeloAparelho aparelho={opcao.aparelho} />}
          {opcao.descricao && <FieldDescription>{opcao.descricao}</FieldDescription>}
        </FieldContent>
        <RadioGroupItem
          value={opcao.valor}
          id={id}
          aria-label={bloqueada ? `${opcao.rotulo} (Pro)` : opcao.rotulo}
          className={cn(
            formato === "vertical" && "absolute top-4.5 right-4.5 z-10 size-4.5! bg-card shadow-xs",
          )}
        />
      </Field>
    </FieldLabel>
  )
}

/* ------------------------------------------------------------------ */

type CampoSegmentadoProps<S extends SecaoConfig, V extends string | number> = {
  secao: S
  campo: CampoDe<S, V>
  titulo: string
  descricao?: string
  opcoes: { valor: V; rotulo: ReactNode; nome: string }[]
  /** O ajuste só vale nesse aparelho: mostra o selo e leva a prévia para ele. */
  aparelho?: Dispositivo
}

/** Poucas opções curtas lado a lado (ToggleGroup do shadcn): colunas, tamanhos. */
export function CampoSegmentado<S extends SecaoConfig, V extends string | number>({
  secao,
  campo,
  titulo,
  descricao,
  opcoes,
  aparelho,
}: CampoSegmentadoProps<S, V>) {
  const [valor, definir, eventos] = useCampo(secao, campo, titulo)
  const id = `campo-${secao}-${campo}`

  return (
    <Field {...eventos} orientation="responsive" className="@md/conteudo:items-center">
      <FieldContent>
        <FieldTitle id={id} className="flex-wrap">
          {titulo}
          {aparelho && <SeloAparelho aparelho={aparelho} />}
        </FieldTitle>
        {descricao && <FieldDescription>{descricao}</FieldDescription>}
      </FieldContent>
      <ToggleGroup
        type="single"
        variant="segmento"
        aria-labelledby={id}
        value={String(valor)}
        onValueChange={(novo) => {
          if (!novo) return
          const opcao = opcoes.find((item) => String(item.valor) === novo)
          if (!opcao) return
          definir(opcao.valor as Config[S][typeof campo])
          if (aparelho) mostrarNoAparelho(aparelho)
        }}
        className="shrink-0"
      >
        {opcoes.map((opcao) => (
          <ToggleGroupItem
            key={String(opcao.valor)}
            value={String(opcao.valor)}
            aria-label={opcao.nome}
            className="min-w-10 px-3 max-md:min-h-11"
          >
            {opcao.rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  )
}

/* ------------------------------------------------------------------ */

type CampoSliderProps<S extends SecaoConfig> = {
  secao: S
  campo: CampoDe<S, number>
  titulo: string
  descricao?: string
  min: number
  max: number
  passo?: number
  formatar?: (valor: number) => string
  /** Desenho pequeno que mostra o valor atual, ao lado do número. */
  amostra?: (valor: number) => ReactNode
}

/** Valor contínuo (Slider do shadcn) com o número sempre à vista. */
export function CampoSlider<S extends SecaoConfig>({
  secao,
  campo,
  titulo,
  descricao,
  min,
  max,
  passo = 1,
  formatar = String,
  amostra,
}: CampoSliderProps<S>) {
  const [valor, definir, eventos] = useCampo(secao, campo, titulo)
  const id = `campo-${secao}-${campo}`
  const numero = Number(valor)

  return (
    <Field {...eventos}>
      <div className="flex items-center justify-between gap-3">
        <FieldTitle id={id}>{titulo}</FieldTitle>
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground tabular-nums">
          {formatar(numero)}
          {amostra?.(numero)}
        </span>
      </div>
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
      <Slider
        aria-labelledby={id}
        value={[numero]}
        min={min}
        max={max}
        step={passo}
        onValueChange={([novo]) => definir(novo as Config[S][typeof campo])}
        className="py-1.5"
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */

type CampoTextoProps<S extends SecaoConfig> = {
  secao: S
  campo: CampoDe<S, string>
  titulo: string
  descricao?: string
  limite: number
  placeholder?: string
}

/** Texto curto com contador de caracteres. */
export function CampoTexto<S extends SecaoConfig>({
  secao,
  campo,
  titulo,
  descricao,
  limite,
  placeholder,
}: CampoTextoProps<S>) {
  const [valor, definir, eventos] = useCampo(secao, campo, titulo)
  const texto = String(valor ?? "")
  const id = `campo-${secao}-${campo}`

  return (
    <Field {...eventos}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{titulo}</FieldLabel>
        <span className="text-xs text-muted-foreground tabular-nums">
          {texto.length}/{limite}
        </span>
      </div>
      <Input
        id={id}
        value={texto}
        maxLength={limite}
        className="max-md:h-11"
        placeholder={placeholder}
        onChange={(evento) => definir(evento.target.value as Config[S][typeof campo])}
      />
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
    </Field>
  )
}
