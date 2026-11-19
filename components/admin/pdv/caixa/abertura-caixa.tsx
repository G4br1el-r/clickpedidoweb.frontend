"use client"

import { format } from "date-fns"
import { useId, useState } from "react"
import { NumericFormat } from "react-number-format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useAbrirCaixa, useHistoricoCaixas } from "@/lib/admin/dados/consultas-caixa"
import { useEquipe, useUsuarioAtual } from "@/lib/admin/dados/consultas-equipe"
import type { ConfigLoja, MembroEquipe, TurnoCaixa } from "@/lib/admin/dados/tipos"
import {
  CEDULAS,
  configPdv,
  diferencaDinheiro,
  diferencaEmReais,
  totalDaContagem,
} from "@/lib/admin/regras/caixa"
import { emReais } from "@/lib/formato"
import { EscolherPessoa } from "../../equipe/escolher-pessoa"
import { TecladoPin } from "../../equipe/teclado-pin"
import { ContagemCedulas } from "./contagem-cedulas"

const SEM_CONTAGEM = CEDULAS.map(() => 0)

const dinheiro = {
  customInput: Input,
  inputMode: "decimal" as const,
  prefix: "R$ ",
  decimalSeparator: ",",
  thousandSeparator: ".",
  decimalScale: 2,
  fixedDecimalScale: true,
}

/** "Último fechamento em 12/11 às 22:10, por João P., com diferença de −R$ 2,00." */
function ultimoFechamento(turno: TurnoCaixa, equipe: MembroEquipe[]) {
  if (!turno.fechadoEm || !turno.conferencia) return undefined
  const quem = equipe.find((membro) => membro.id === turno.fechadoPor)?.nome ?? "alguém da equipe"
  const diferenca = diferencaDinheiro(turno.conferencia)
  const fechado = new Date(turno.fechadoEm)
  return `Último fechamento em ${format(fechado, "dd/MM")} às ${format(fechado, "HH:mm")}, por ${quem}, ${
    diferenca === 0 ? "sem diferença" : `com diferença de ${diferencaEmReais(diferenca)}`
  }.`
}

/**
 * Abertura do turno de caixa: quem abre, o fundo de troco (a contagem por cédula é
 * opcional e, quando usada, vale ela) e o PIN. Quem abre passa a usar o painel.
 */
export function AberturaCaixa() {
  const { data: loja } = useLoja()
  const { data: equipe } = useEquipe()
  if (!loja || !equipe) {
    return (
      <div
        role="status"
        aria-label="Carregando a abertura do caixa"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  return <Abertura loja={loja} equipe={equipe} />
}

function Abertura({ loja, equipe }: { loja: ConfigLoja; equipe: MembroEquipe[] }) {
  const id = useId()
  const { data: historico } = useHistoricoCaixas()
  const { membro: atual } = useUsuarioAtual()
  const abrir = useAbrirCaixa()

  const [escolhido, setEscolhido] = useState<string>()
  const [digitado, setDigitado] = useState<number>()
  const [contagem, setContagem] = useState<number[]>(SEM_CONTAGEM)
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState<string>()

  const ativos = equipe.filter((membro) => membro.ativo)
  const pessoa = ativos.find((membro) => membro.id === (escolhido ?? atual?.id))
  const sugerido = configPdv(loja).fundoSugerido
  const contou = contagem.some(Boolean)
  const fundo = contou ? totalDaContagem(contagem) : (digitado ?? sugerido)
  const pronto = Boolean(pessoa) && pin.length >= 4 && !abrir.isPending
  const anterior = historico?.find((item) => item.turno.fechadoEm)?.turno
  const resumoAnterior = anterior && ultimoFechamento(anterior, equipe)

  function confirmar() {
    if (!pronto || !pessoa) return
    setErro(undefined)
    abrir.mutate(
      { operadorId: pessoa.id, pin, fundo },
      {
        onError: (falha) => {
          setErro(falha.message)
          setPin("")
        },
      },
    )
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-0"
    >
      <div className="flex flex-col gap-6 lg:border-r lg:border-border/70 lg:pr-8">
        <div className="flex flex-col gap-1">
          <h1
            id={`${id}-titulo`}
            className="text-2xl leading-tight font-semibold tracking-[-0.02em]"
          >
            Abrir o caixa
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {resumoAnterior ?? "Sem caixa aberto, o PDV não vende."}
          </p>
        </div>

        <EscolherPessoa
          id={`${id}-quem`}
          rotulo="Quem abre"
          pessoas={ativos}
          valor={pessoa?.id ?? ""}
          aoMudar={(novo) => {
            setEscolhido(novo)
            setPin("")
            setErro(undefined)
          }}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-fundo`}>Fundo de troco</Label>
          <p className="text-[13px] text-muted-foreground">
            Dinheiro que fica na gaveta para dar troco. Sugestão da loja: {emReais(sugerido)}.
          </p>
          <NumericFormat
            {...dinheiro}
            id={`${id}-fundo`}
            className="h-12 text-lg font-semibold tabular-nums"
            readOnly={contou}
            value={fundo}
            onValueChange={({ floatValue }, { source }) => {
              if (source === "event") setDigitado(floatValue ?? 0)
            }}
          />
          {contou && <p className="text-[13px] text-muted-foreground">Pela contagem da gaveta.</p>}
        </div>
      </div>

      <section
        aria-labelledby={`${id}-contagem`}
        className="flex flex-col gap-3 lg:border-r lg:border-border/70 lg:px-8"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id={`${id}-contagem`} className="text-[15px] font-semibold">
            Contagem da gaveta
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Opcional. Conte cédula por cédula e o fundo se preenche.
          </p>
        </div>
        <ContagemCedulas quantidades={contagem} aoMudar={setContagem} />
        <div className="flex justify-between border-t border-foreground/80 pt-2 text-sm font-semibold tabular-nums">
          <span>Total contado</span>
          <span>{emReais(totalDaContagem(contagem))}</span>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:pl-8">
        {pessoa ? (
          <TecladoPin
            id={`${id}-pin`}
            rotulo={`PIN de ${pessoa.nome}`}
            valor={pin}
            aoMudar={setPin}
            aoConfirmar={confirmar}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Escolha quem abre o caixa.</p>
        )}
        <p className="text-[13px] text-muted-foreground">
          4 a 6 números. O turno fica no nome de quem abre até o fechamento.
        </p>
        {erro && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {erro}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          className="h-12 justify-between rounded-full px-5"
          disabled={!pronto}
          onClick={confirmar}
        >
          <span>Abrir caixa</span>
          <span className="tabular-nums">{emReais(fundo)}</span>
        </Button>
      </div>
    </section>
  )
}
