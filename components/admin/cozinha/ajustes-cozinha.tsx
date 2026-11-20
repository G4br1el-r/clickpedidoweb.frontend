"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useLigarViaDaCozinha, useSalvarTemposCozinha } from "@/lib/admin/dados/consultas-entrega"
import type { TemposCozinha } from "@/lib/admin/dados/tipos"
import {
  type EventoDeSom,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { TEMPOS_PADRAO } from "@/lib/admin/regras/cozinha"
import { esquemaTemposCozinha } from "@/lib/admin/regras/esquema-loja"
import { tocarAlerta, tocarSom } from "@/lib/admin/som"
import { PracasDaCozinha } from "./pracas-da-cozinha"

/** Uma parte dos ajustes: título e explicação à esquerda, o conteúdo à direita. */
export function SecaoAjuste({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="grid min-w-0 gap-4 border-t border-border/70 pt-5 pb-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 lg:pt-6"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
          {titulo}
        </h2>
        <p className="text-[13px] text-pretty text-muted-foreground">{descricao}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

const CAMPOS: { nome: keyof TemposCozinha; rotulo: string; descricao: string }[] = [
  {
    nome: "atencaoMin",
    rotulo: "Atenção a partir de",
    descricao: "O tempo do ticket fica âmbar.",
  },
  {
    nome: "atrasoMin",
    rotulo: "Atraso a partir de",
    descricao: "O tempo do ticket fica vermelho.",
  },
  {
    nome: "prontoFicaMin",
    rotulo: "Pronto fica na tela por",
    descricao: "Se ninguém servir nem despachar antes.",
  },
]

function FormularioTempos({ tempos }: { tempos: TemposCozinha }) {
  const salvar = useSalvarTemposCozinha()
  const {
    control: controle,
    handleSubmit,
    formState: { errors: erros },
    reset,
  } = useForm<TemposCozinha>({
    resolver: zodResolver(esquemaTemposCozinha),
    defaultValues: tempos,
  })
  const enviar = handleSubmit((dados) =>
    salvar.mutate(dados, {
      onSuccess: (loja) => {
        toast.success("Tempos da cozinha salvos.")
        reset(loja.temposCozinha)
      },
      onError: (erro) => toast.error(erro.message),
    }),
  )

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-3">
        {CAMPOS.map(({ nome, rotulo, descricao }) => (
          <Controller
            key={nome}
            control={controle}
            name={nome}
            render={({ field }) => (
              <Field data-invalid={Boolean(erros[nome])}>
                <FieldLabel htmlFor={`cozinha-${nome}`}>{rotulo}</FieldLabel>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Input
                    id={`cozinha-${nome}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="w-20 tabular-nums"
                    aria-invalid={Boolean(erros[nome])}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(evento) => field.onChange(evento.target.valueAsNumber)}
                    onBlur={field.onBlur}
                  />
                  min
                </div>
                <FieldDescription>{descricao}</FieldDescription>
                {erros[nome] && <FieldError>{erros[nome].message}</FieldError>}
              </Field>
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={salvar.isPending}>
          Salvar tempos
        </Button>
        <p className="text-[13px] text-muted-foreground">
          O tempo prometido ao cliente fica em{" "}
          <Link
            href="/admin/loja"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Tempos de entrega e retirada
          </Link>
          .
        </p>
      </div>
    </form>
  )
}

const SONS: { evento: EventoDeSom; rotulo: string; descricao: string }[] = [
  {
    evento: "novo",
    rotulo: "Pedido ou rodada nova",
    descricao: "O alerta deste aparelho, quando chega algo em A fazer.",
  },
  {
    evento: "cancelado",
    rotulo: "Cancelado ou alterado",
    descricao: "Um alarme que repete a cada 5 s até alguém tocar em Ciente.",
  },
  {
    evento: "atrasado",
    rotulo: "Ticket atrasado",
    descricao: "Um toque curto quando o ticket passa do tempo de atraso.",
  },
  {
    evento: "repetirNovo",
    rotulo: "Repetir o alerta de novo",
    descricao: "A cada 30 s, enquanto houver ticket em A fazer.",
  },
]

/** As chaves de cada som. Ligar toca o som, para ouvir como é (e libera o áudio). */
function ChavesDeSom() {
  const sons = usePreferenciasFila((estado) => estado.sons)
  const ligar = usePreferenciasFila((estado) => estado.ligarSomDoEvento)
  const tipoSom = useSomDoAparelho()
  const ouvir = (evento: EventoDeSom) => {
    if (evento === "cancelado" || evento === "atrasado") tocarSom(evento)
    else tocarAlerta(tipoSom)
  }
  return (
    <div className="flex flex-col divide-y divide-border/70">
      {SONS.map(({ evento, rotulo, descricao }) => (
        <div key={evento} className="flex min-h-14 items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor={`som-${evento}`} className="text-sm font-medium">
              {rotulo}
            </label>
            <span className="text-[13px] text-muted-foreground">{descricao}</span>
          </div>
          <Switch
            id={`som-${evento}`}
            checked={sons[evento]}
            onCheckedChange={(ligado) => {
              ligar(evento, ligado)
              if (ligado) ouvir(evento)
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** As vias: a chave deste aparelho e, sem praças, a via da cozinha da loja. */
function ViasDaCozinha() {
  const { data: loja } = useLoja()
  const ligarDaLoja = useLigarViaDaCozinha()
  const imprimirVias = usePreferenciasFila((estado) => estado.imprimirVias)
  const ligarVias = usePreferenciasFila((estado) => estado.ligarVias)
  const semPracas = loja && (loja.pracas ?? []).length === 0
  return (
    <div className="flex flex-col divide-y divide-border/70">
      <LinhaDeChave
        id="vias-aparelho"
        rotulo="Imprimir as vias neste aparelho"
        descricao="A via sai sozinha quando a rodada chega em A fazer. Ligue em um aparelho por praça."
        ligada={imprimirVias}
        aoMudar={ligarVias}
      />
      {semPracas ? (
        <LinhaDeChave
          id="vias-loja"
          rotulo="Imprimir a via da cozinha"
          descricao="Sem praças, sai uma via só, com todos os itens."
          ligada={Boolean(loja.viaDaCozinha)}
          aoMudar={(ligada) =>
            ligarDaLoja.mutate(ligada, { onError: (erro) => toast.error(erro.message) })
          }
        />
      ) : (
        <p className="py-3 text-[13px] text-muted-foreground">
          Cada praça escolhe se imprime a via, em Praças.
        </p>
      )}
    </div>
  )
}

function LinhaDeChave({
  id,
  rotulo,
  descricao,
  ligada,
  aoMudar,
}: {
  id: string
  rotulo: string
  descricao: string
  ligada: boolean
  aoMudar: (ligada: boolean) => void
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {rotulo}
        </label>
        <span className="text-[13px] text-muted-foreground">{descricao}</span>
      </div>
      <Switch id={id} checked={ligada} onCheckedChange={aoMudar} />
    </div>
  )
}

/** Aba Ajustes da cozinha: os tempos da loja e os sons deste aparelho. */
export function AjustesCozinha() {
  const { data: loja } = useLoja()
  return (
    <div className="flex flex-col gap-3">
      <SecaoAjuste
        titulo="Tempos da cozinha"
        descricao="Valem para todos os aparelhos da loja, contando da chegada de cada rodada."
      >
        {loja ? (
          <FormularioTempos tempos={loja.temposCozinha ?? TEMPOS_PADRAO} />
        ) : (
          <Skeleton className="h-24 rounded-lg" />
        )}
      </SecaoAjuste>
      <SecaoAjuste
        titulo="Praças"
        descricao="Pontos de preparo, com as categorias de cada um. Cada aparelho escolhe a sua praça no Quadro."
      >
        <PracasDaCozinha />
      </SecaoAjuste>
      <SecaoAjuste
        titulo="Vias da cozinha"
        descricao="A via impressa de cada praça, sem preço, para quem prepara."
      >
        <ViasDaCozinha />
      </SecaoAjuste>
      <SecaoAjuste
        titulo="Sons deste aparelho"
        descricao="Tocam com o Alerta sonoro ligado no Quadro. Cada aparelho escolhe os seus."
      >
        <ChavesDeSom />
      </SecaoAjuste>
    </div>
  )
}
