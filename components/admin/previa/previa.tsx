"use client"

import {
  ExpandIcon,
  MonitorIcon,
  MoonIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type Config, useConfigCarregada, useConfigEfetiva } from "@/lib/admin/config"
import { FONTES_TEXTO, FONTES_TITULO, VARIAVEIS_FONTES } from "@/lib/admin/fontes"
import { ROTULO_TELA, type TelaPrevia } from "@/lib/admin/secoes"
import { variaveisClaras, variaveisEscuras } from "@/lib/tema"
import { cn } from "@/lib/utils"
import { type Dispositivo, usePrevia } from "./estado"
import { raio } from "./estilos"
import { MarcaFoco } from "./marca-foco"
import { TelaAcompanhamento } from "./tela-acompanhamento"
import { TelaConversa } from "./tela-conversa"
import { TelaFinalizar } from "./tela-finalizar"
import { TelaInicio } from "./tela-inicio"
import { TelaProduto } from "./tela-produto"
import { TelaSacola } from "./tela-sacola"

const TAMANHO: Record<Dispositivo, { largura: number; altura: number }> = {
  celular: { largura: 390, altura: 844 },
  computador: { largura: 1280, altura: 800 },
}

/** Variáveis de cor, cantos e fontes da loja simulada. */
function estiloDaLoja(config: Config, escuro: boolean): CSSProperties {
  const tema = {
    primaria: config.cores.primaria,
    acento: config.cores.acento,
    fundo: config.cores.fundo,
    tinta: config.cores.tinta,
  }
  return {
    ...(escuro ? variaveisEscuras(tema) : variaveisClaras(tema)),
    "--radius": raio(config.cores.cantos),
    "--fonte-titulo": FONTES_TITULO[config.tipografia.titulo].css,
    "--fonte-texto": FONTES_TEXTO[config.tipografia.texto].css,
    fontFamily: FONTES_TEXTO[config.tipografia.texto].css,
  } as CSSProperties
}

function TelaAtual({ tela }: { tela: TelaPrevia }) {
  switch (tela) {
    case "produto":
      return <TelaProduto />
    case "sacola":
      return <TelaSacola />
    case "finalizar":
      return <TelaFinalizar />
    case "acompanhamento":
      return <TelaAcompanhamento />
    case "conversa":
      return <TelaConversa />
    default:
      return <TelaInicio />
  }
}

/** Tema efetivo da prévia: o escolhido nela, senão o padrão da loja, senão o do painel. */
function useEscuro() {
  const escolhido = usePrevia((estado) => estado.escuro)
  const temaPadrao = useConfigEfetiva().cores.temaPadrao
  const { resolvedTheme } = useTheme()
  if (escolhido !== null) return escolhido
  if (temaPadrao !== "sistema") return temaPadrao === "escuro"
  return resolvedTheme === "dark"
}

/**
 * A loja desenhada no tamanho real do aparelho e reduzida para caber no espaço.
 * Media queries não enxergam o aparelho simulado, então as telas usam container queries
 * (`@3xl/tela:`) para saber se estão no celular ou no computador.
 */
function Tela({ className }: { className?: string }) {
  const config = useConfigEfetiva()
  const tela = usePrevia((estado) => estado.tela)
  const dispositivo = usePrevia((estado) => estado.dispositivo)
  const rodada = usePrevia((estado) => estado.rodada)
  const escuro = useEscuro()
  const moldura = useRef<HTMLDivElement>(null)
  // A tela que rola por dentro: a marca de foco mede e rola por ela.
  const rolavel = useRef<HTMLDivElement>(null)
  const [espaco, setEspaco] = useState({ largura: 0, altura: 0 })
  const { largura, altura } = TAMANHO[dispositivo]

  useLayoutEffect(() => {
    const elemento = moldura.current
    if (!elemento) return
    const observador = new ResizeObserver(([entrada]) => {
      setEspaco({ largura: entrada.contentRect.width, altura: entrada.contentRect.height })
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const celular = dispositivo === "celular"
  // Celular: cabe na altura. Computador: ocupa a largura e a tela rola por dentro.
  const escala =
    espaco.largura === 0
      ? 0
      : celular
        ? Math.min(1, (espaco.largura - 24) / largura, (espaco.altura - 24) / altura)
        : Math.min(1, espaco.largura / largura)
  const alturaInterna = celular ? altura : Math.max(480, espaco.altura / (escala || 1))

  return (
    <div ref={moldura} className={cn("relative grid min-h-0 place-items-center", className)}>
      {escala > 0 && (
        <div
          style={{ width: largura * escala, height: alturaInterna * escala }}
          className={cn(
            "relative overflow-hidden",
            celular
              ? "rounded-[44px] shadow-[0_0_0_6px_#1d1d22,0_0_0_7px_var(--border),0_24px_48px_-28px_rgb(0_0_0/0.4)]"
              : "rounded-lg shadow-[0_0_0_1px_var(--border),0_20px_40px_-28px_rgb(0_0_0/0.35)]",
          )}
          data-testid="previa-tela"
          data-dispositivo={dispositivo}
        >
          <div
            ref={rolavel}
            style={{
              width: largura,
              height: alturaInterna,
              transform: `scale(${escala})`,
              ...estiloDaLoja(config, escuro),
            }}
            className={cn(
              "@container/tela absolute top-0 left-0 origin-top-left overflow-x-hidden overflow-y-auto bg-background text-foreground [scrollbar-width:none]",
              escuro ? "dark" : "light",
            )}
          >
            <div
              style={{ zoom: config.tipografia.escala / 100 }}
              className="relative grid min-h-full grid-cols-[minmax(0,1fr)] grid-rows-[1fr]"
            >
              <TelaAtual key={`${tela}-${rodada}`} tela={tela} />
            </div>
          </div>
          <MarcaFoco tela={rolavel} />
        </div>
      )}
    </div>
  )
}

function BarraFerramentas({ aoAmpliar }: { aoAmpliar?: () => void }) {
  const tela = usePrevia((estado) => estado.tela)
  const dispositivo = usePrevia((estado) => estado.dispositivo)
  const definirTela = usePrevia((estado) => estado.definirTela)
  const definirDispositivo = usePrevia((estado) => estado.definirDispositivo)
  const definirEscuro = usePrevia((estado) => estado.definirEscuro)
  const repetir = usePrevia((estado) => estado.repetir)
  const escuro = useEscuro()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={tela} onValueChange={(valor) => definirTela(valor as TelaPrevia)}>
        <SelectTrigger size="sm" className="w-[132px]" aria-label="Tela da prévia">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(Object.keys(ROTULO_TELA) as TelaPrevia[]).map((item) => (
              <SelectItem key={item} value={item}>
                {ROTULO_TELA[item]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <ToggleGroup
        type="single"
        variant="segmento"
        size="sm"
        value={dispositivo}
        onValueChange={(valor) => valor && definirDispositivo(valor as Dispositivo)}
        aria-label="Aparelho"
      >
        <ToggleGroupItem value="celular" aria-label="Celular">
          <SmartphoneIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="computador" aria-label="Computador">
          <MonitorIcon />
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="ml-auto flex items-center gap-1">
        <Dica texto={escuro ? "Ver no tema claro" : "Ver no tema escuro"}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={escuro ? "Ver no tema claro" : "Ver no tema escuro"}
            onClick={() => definirEscuro(!escuro)}
          >
            {escuro ? <SunIcon /> : <MoonIcon />}
          </Button>
        </Dica>
        <Dica texto="Repetir animações">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Repetir animações"
            onClick={repetir}
          >
            <RotateCcwIcon />
          </Button>
        </Dica>
        {aoAmpliar && (
          <Dica texto="Ampliar prévia">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ampliar prévia"
              onClick={aoAmpliar}
            >
              <ExpandIcon />
            </Button>
          </Dica>
        )}
      </div>
    </div>
  )
}

/** Prévia ao vivo da loja: tudo que muda nas configurações aparece aqui na hora. */
export function Previa({ className, rodape }: { className?: string; rodape?: ReactNode }) {
  const [ampliada, setAmpliada] = useState(false)
  // A prévia depende do que foi salvo no navegador e do tema: só desenha depois de carregar.
  const hidratada = useConfigCarregada()

  if (!hidratada) {
    return (
      <div className={cn("flex min-h-0 flex-col gap-3", className)}>
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="flex-1 rounded-[44px]" />
      </div>
    )
  }

  return (
    <section
      aria-label="Prévia da loja"
      className={cn("flex min-h-0 flex-col gap-3", className)}
      data-testid="previa"
    >
      <BarraFerramentas aoAmpliar={() => setAmpliada(true)} />
      <Tela className="flex-1" />
      {rodape}
      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent
          className={cn(
            "flex h-[92dvh] w-[min(1400px,96vw)] max-w-none! flex-col gap-3 sm:max-w-none",
            VARIAVEIS_FONTES,
          )}
        >
          <DialogHeader>
            <DialogTitle>Prévia da loja</DialogTitle>
            <DialogDescription>
              Veja como a loja fica com as configurações atuais.
            </DialogDescription>
          </DialogHeader>
          <BarraFerramentas />
          <Tela className="flex-1" />
        </DialogContent>
      </Dialog>
    </section>
  )
}
