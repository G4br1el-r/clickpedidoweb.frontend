"use client"

import { format } from "date-fns"
import { HistoryIcon } from "lucide-react"
import { type FormEvent, type ReactNode, useId, useState } from "react"
import { NumericFormat } from "react-number-format"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  useConfigurarEstoque,
  useContagemEstoque,
  useEntradaEstoque,
  useMovimentos,
  useSaidaEstoque,
} from "@/lib/admin/dados/consultas-estoque"
import type { MovimentoEstoque, Produto, TipoMovimento } from "@/lib/admin/dados/tipos"
import {
  emQuantidade,
  errosDoMovimento,
  numeroComSinal,
  saldoDepois,
} from "@/lib/admin/regras/estoque"
import { emReais } from "@/lib/formato"

export type AcaoEstoque = "entrada" | "saida" | "contagem" | "historico" | "configurar"

const MOTIVOS = ["Quebra", "Vencimento", "Consumo interno", "Ajuste", "Outro"] as const

const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  saida: "Saída",
  contagem: "Contagem",
  venda: "Venda",
  devolucao: "Devolução",
  pesagem: "Pesagem",
}

/** O que a pessoa digitou no campo de número; vazio é `null`. */
const lerNumero = (texto: string) => (texto.trim() === "" ? null : Number(texto.replace(",", ".")))

const avisarErro = (erro: Error) => toast.error(erro.message)

/** Janela de um movimento: título, saldo atual, campos e o botão de registrar. */
function JanelaMovimento({
  titulo,
  descricao,
  botao,
  podeEnviar,
  enviando,
  aoEnviar,
  aoFechar,
  children,
}: {
  titulo: string
  descricao: string
  botao: string
  podeEnviar: boolean
  enviando: boolean
  aoEnviar: () => void
  aoFechar: () => void
  children: ReactNode
}) {
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento: FormEvent) => {
            evento.preventDefault()
            if (podeEnviar) aoEnviar()
          }}
        >
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descricao}</DialogDescription>
          </DialogHeader>
          <FieldGroup>{children}</FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={!podeEnviar || enviando}>
              {botao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Campo de quantidade: inteiro na unidade, até gramas no quilo. */
function CampoQuantidade({
  rotulo,
  produto,
  valor,
  aoMudar,
  erro,
  descricao,
}: {
  rotulo: string
  produto: Produto
  valor: string
  aoMudar: (valor: string) => void
  erro: string | null
  descricao?: ReactNode
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro) || undefined}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={produto.unidade === "kg" ? 0.001 : 1}
        aria-invalid={Boolean(erro) || undefined}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
      {erro && <FieldError>{erro}</FieldError>}
    </Field>
  )
}

function CampoObservacao({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>Observação</FieldLabel>
      <Textarea
        id={id}
        rows={2}
        maxLength={140}
        placeholder="Opcional"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Field>
  )
}

function CampoCusto({
  valor,
  aoMudar,
  descricao,
  desativado,
}: {
  valor: number | undefined
  aoMudar: (valor: number | undefined) => void
  descricao?: string
  desativado?: boolean
}) {
  const id = useId()
  return (
    <Field data-disabled={desativado || undefined}>
      <FieldLabel htmlFor={id}>Custo unitário</FieldLabel>
      <NumericFormat
        id={id}
        customInput={Input}
        inputMode="decimal"
        prefix="R$ "
        decimalSeparator=","
        thousandSeparator="."
        decimalScale={2}
        allowNegative={false}
        disabled={desativado}
        value={valor ?? ""}
        onValueChange={({ floatValue }) => aoMudar(floatValue)}
      />
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
    </Field>
  )
}

/** Como fica o saldo depois do movimento; só aparece com uma quantidade válida. */
function SaldoDepois({ produto, movimento }: { produto: Produto; movimento: number | null }) {
  if (movimento === null) return null
  const depois = saldoDepois(produto.estoque?.quantidade ?? 0, movimento)
  return (
    <span aria-live="polite" className="tabular-nums">
      Saldo depois: {emQuantidade(depois, produto.unidade)}
    </span>
  )
}

const saldoAtual = (produto: Produto) =>
  `Saldo atual: ${emQuantidade(produto.estoque?.quantidade ?? 0, produto.unidade)}.`

export function JanelaEntrada({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const [quantidade, setQuantidade] = useState("")
  const [custo, setCusto] = useState<number | undefined>()
  const [observacao, setObservacao] = useState("")
  const entrada = useEntradaEstoque()
  const numero = lerNumero(quantidade)
  const erro =
    numero === null
      ? null
      : errosDoMovimento({ tipo: "entrada", quantidade: numero, unidade: produto.unidade })
  const custoAtual = produto.custo
  return (
    <JanelaMovimento
      titulo={`Entrada de ${produto.nome}`}
      descricao={`Compra ou reposição. ${saldoAtual(produto)}`}
      botao="Registrar entrada"
      podeEnviar={numero !== null && !erro}
      enviando={entrada.isPending}
      aoFechar={aoFechar}
      aoEnviar={() =>
        entrada.mutate(
          {
            id: produto.id,
            quantidade: numero as number,
            ...(custo !== undefined ? { custoUnitario: custo } : {}),
            observacao,
          },
          {
            onSuccess: () => {
              toast.success("Entrada registrada.")
              aoFechar()
            },
            onError: avisarErro,
          },
        )
      }
    >
      <CampoQuantidade
        rotulo="Quantidade"
        produto={produto}
        valor={quantidade}
        aoMudar={setQuantidade}
        erro={erro}
        descricao={
          <SaldoDepois produto={produto} movimento={numero === null || erro ? null : numero} />
        }
      />
      <CampoCusto
        valor={custo}
        aoMudar={setCusto}
        descricao={
          custoAtual !== undefined
            ? `Em branco, o custo continua ${emReais(custoAtual)}.`
            : "Opcional. Entra no valor do estoque."
        }
      />
      <CampoObservacao valor={observacao} aoMudar={setObservacao} />
    </JanelaMovimento>
  )
}

export function JanelaSaida({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const [quantidade, setQuantidade] = useState("")
  const [motivo, setMotivo] = useState("")
  const [observacao, setObservacao] = useState("")
  const saida = useSaidaEstoque()
  const idMotivo = useId()
  const numero = lerNumero(quantidade)
  const erro =
    numero === null
      ? null
      : // O motivo é conferido à parte, pelo botão: aqui só a quantidade.
        errosDoMovimento({ tipo: "entrada", quantidade: numero, unidade: produto.unidade })
  return (
    <JanelaMovimento
      titulo={`Saída de ${produto.nome}`}
      descricao={`Perda ou uso que não é venda. ${saldoAtual(produto)}`}
      botao="Registrar saída"
      podeEnviar={numero !== null && !erro && motivo !== ""}
      enviando={saida.isPending}
      aoFechar={aoFechar}
      aoEnviar={() =>
        saida.mutate(
          { id: produto.id, quantidade: numero as number, motivo, observacao },
          {
            onSuccess: () => {
              toast.success("Saída registrada.")
              aoFechar()
            },
            onError: avisarErro,
          },
        )
      }
    >
      <CampoQuantidade
        rotulo="Quantidade"
        produto={produto}
        valor={quantidade}
        aoMudar={setQuantidade}
        erro={erro}
        descricao={
          <SaldoDepois produto={produto} movimento={numero === null || erro ? null : -numero} />
        }
      />
      <FieldSet>
        <FieldLegend variant="label">Motivo</FieldLegend>
        <RadioGroup value={motivo} onValueChange={setMotivo} className="grid grid-cols-2 gap-2">
          {MOTIVOS.map((item) => (
            <Field key={item} orientation="horizontal">
              <RadioGroupItem id={`${idMotivo}-${item}`} value={item} />
              <FieldLabel htmlFor={`${idMotivo}-${item}`} className="font-normal">
                {item}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
      <CampoObservacao valor={observacao} aoMudar={setObservacao} />
    </JanelaMovimento>
  )
}

export function JanelaContagem({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const [contado, setContado] = useState("")
  const [observacao, setObservacao] = useState("")
  const contagem = useContagemEstoque()
  const numero = lerNumero(contado)
  const erro =
    numero === null
      ? null
      : errosDoMovimento({ tipo: "contagem", quantidade: numero, unidade: produto.unidade })
  const saldo = produto.estoque?.quantidade ?? 0
  const diferenca = numero === null || erro ? null : saldoDepois(numero, -saldo)
  return (
    <JanelaMovimento
      titulo={`Contagem de ${produto.nome}`}
      descricao={`Conte o que tem na prateleira; o saldo passa a ser o contado. ${saldoAtual(produto)}`}
      botao="Registrar contagem"
      podeEnviar={numero !== null && !erro}
      enviando={contagem.isPending}
      aoFechar={aoFechar}
      aoEnviar={() =>
        contagem.mutate(
          { id: produto.id, contado: numero as number, observacao },
          {
            onSuccess: () => {
              toast.success("Contagem registrada.")
              aoFechar()
            },
            onError: avisarErro,
          },
        )
      }
    >
      <CampoQuantidade
        rotulo="Quantidade contada"
        produto={produto}
        valor={contado}
        aoMudar={setContado}
        erro={erro}
        descricao={
          diferenca !== null ? (
            <span aria-live="polite">Diferença: {numeroComSinal(diferenca)}</span>
          ) : undefined
        }
      />
      <CampoObservacao valor={observacao} aoMudar={setObservacao} />
    </JanelaMovimento>
  )
}

export function JanelaConfigurar({
  produto,
  aoFechar,
}: {
  produto: Produto
  aoFechar: () => void
}) {
  const atual = produto.estoque
  const [controlar, setControlar] = useState(atual?.controlar ?? true)
  const [minimo, setMinimo] = useState(String(atual?.minimo ?? 0))
  const [custo, setCusto] = useState<number | undefined>(produto.custo)
  const [esgotar, setEsgotar] = useState(atual?.esgotarAoZerar ?? true)
  const configurar = useConfigurarEstoque()
  const ids = { controlar: useId(), minimo: useId(), esgotar: useId() }
  const numero = lerNumero(minimo)
  const erro =
    controlar && (numero === null || !(numero >= 0)) ? "Informe um mínimo de zero ou mais." : null
  return (
    <JanelaMovimento
      titulo={`Estoque de ${produto.nome}`}
      descricao="Com o controle ligado, as vendas baixam o saldo sozinhas."
      botao="Salvar"
      podeEnviar={!erro}
      enviando={configurar.isPending}
      aoFechar={aoFechar}
      aoEnviar={() =>
        configurar.mutate(
          {
            id: produto.id,
            controlar,
            minimo: numero ?? 0,
            ...(custo !== undefined ? { custo } : {}),
            esgotarAoZerar: esgotar,
          },
          {
            onSuccess: () => {
              toast.success(`Estoque de ${produto.nome} salvo.`)
              aoFechar()
            },
            onError: avisarErro,
          },
        )
      }
    >
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={ids.controlar}>Controlar o estoque</FieldLabel>
          <FieldDescription>Desligado, o produto vende sem olhar o saldo.</FieldDescription>
        </FieldContent>
        <Switch id={ids.controlar} checked={controlar} onCheckedChange={setControlar} />
      </Field>
      <Field data-invalid={Boolean(erro) || undefined} data-disabled={!controlar || undefined}>
        <FieldLabel htmlFor={ids.minimo}>Estoque mínimo</FieldLabel>
        <Input
          id={ids.minimo}
          type="number"
          inputMode="decimal"
          min={0}
          step={produto.unidade === "kg" ? 0.001 : 1}
          disabled={!controlar}
          aria-invalid={Boolean(erro) || undefined}
          value={minimo}
          onChange={(evento) => setMinimo(evento.target.value)}
        />
        <FieldDescription>No mínimo ou abaixo, o produto aparece como baixo.</FieldDescription>
        {erro && <FieldError>{erro}</FieldError>}
      </Field>
      <CampoCusto valor={custo} aoMudar={setCusto} desativado={!controlar} />
      <Field orientation="horizontal" data-disabled={!controlar || undefined}>
        <FieldContent>
          <FieldLabel htmlFor={ids.esgotar}>Esgotar ao zerar</FieldLabel>
          <FieldDescription>
            Some do cardápio e do PDV quando o saldo chega a zero.
          </FieldDescription>
        </FieldContent>
        <Switch
          id={ids.esgotar}
          checked={esgotar}
          disabled={!controlar}
          onCheckedChange={setEsgotar}
        />
      </Field>
    </JanelaMovimento>
  )
}

function LinhaMovimento({ movimento, produto }: { movimento: MovimentoEstoque; produto: Produto }) {
  const detalhe = [movimento.motivo, movimento.observacao].filter(Boolean).join(" · ")
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-baseline gap-2 text-sm font-medium">
          {ROTULO_MOVIMENTO[movimento.tipo]}
          {movimento.pedidoId !== undefined && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              Pedido #{movimento.pedidoId}
            </span>
          )}
        </span>
        {detalhe && <span className="text-sm text-muted-foreground">{detalhe}</span>}
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(movimento.criadoEm), "dd/MM/yyyy HH:mm")}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
        <span className="font-semibold">
          {numeroComSinal(movimento.quantidade)}
          {produto.unidade === "kg" ? " kg" : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          saldo {emQuantidade(movimento.saldo, produto.unidade)}
        </span>
      </div>
    </li>
  )
}

export function HistoricoEstoque({
  produto,
  aoFechar,
}: {
  produto: Produto
  aoFechar: () => void
}) {
  const { data: movimentos } = useMovimentos(produto.id)
  return (
    <Sheet open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Histórico de {produto.nome}</SheetTitle>
          <SheetDescription>{saldoAtual(produto)} Do mais novo ao mais antigo.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!movimentos ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : movimentos.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HistoryIcon />
                </EmptyMedia>
                <EmptyTitle>Sem movimentos</EmptyTitle>
                <EmptyDescription>Entradas, saídas e vendas aparecem aqui.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border/70">
              {movimentos.map((movimento) => (
                <LinhaMovimento key={movimento.id} movimento={movimento} produto={produto} />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
