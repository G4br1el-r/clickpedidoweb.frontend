"use client"

import { BanknoteIcon, CreditCardIcon, PlusIcon, QrCodeIcon } from "lucide-react"
import { useState } from "react"
import { PatternFormat } from "react-number-format"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useCriarAgendamento } from "@/lib/admin/dados/consultas-agenda"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { NovoAgendamento as Novo } from "@/lib/admin/dados/servidor"
import type { HorarioFuncionamento } from "@/lib/admin/dados/tipos"
import { emReais } from "@/lib/formato"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { EscolhaHorario, textoDoHorario, textoDuracao } from "./escolha-horario"

const PAGAMENTOS: { valor: Novo["pagamento"]; rotulo: string; icone: typeof BanknoteIcon }[] = [
  { valor: "pix", rotulo: "Pix", icone: QrCodeIcon },
  { valor: "dinheiro", rotulo: "Dinheiro", icone: BanknoteIcon },
  { valor: "cartao-na-entrega", rotulo: "Cartão", icone: CreditCardIcon },
]

function Formulario({
  dia,
  agora,
  horarios,
  aoMarcar,
}: {
  dia: Date
  agora: Date
  horarios: HorarioFuncionamento[]
  aoMarcar: (inicio: Date) => void
}) {
  const { data: produtos = [] } = useProdutos()
  const criar = useCriarAgendamento()
  const [nome, setNome] = useState("")
  const [telefone, setTelefone] = useState("")
  const [servicos, setServicos] = useState<string[]>([])
  const [inicio, setInicio] = useState<string | null>(null)
  const [pagamento, setPagamento] = useState<Novo["pagamento"] | null>(null)
  const [observacao, setObservacao] = useState("")

  const disponiveis = produtos.filter((produto) => produto.ativo && produto.disponivel)
  const escolhidos = disponiveis.filter((produto) => servicos.includes(produto.id))
  const duracao = escolhidos.reduce((soma, produto) => soma + (produto.duracaoMin ?? 60), 0)
  const total = escolhidos.reduce((soma, produto) => soma + produto.preco, 0)
  const pronto = nome.trim() && servicos.length > 0 && inicio && pagamento && !criar.isPending

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!pronto) return
        criar.mutate(
          {
            cliente: { nome, telefone },
            servicos,
            inicio,
            pagamento,
            ...(observacao.trim() ? { observacao } : {}),
          },
          {
            onSuccess: (pedido) => {
              const marcado = new Date(pedido.agendamento?.inicio ?? inicio)
              toast.success(`Marcado para ${textoDoHorario(marcado)}.`)
              aoMarcar(marcado)
            },
            onError: (erro) => {
              toast.error(erro.message)
              setInicio(null)
            },
          },
        )
      }}
    >
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="agenda-nome">Nome da cliente</FieldLabel>
          <Input
            id="agenda-nome"
            autoComplete="off"
            maxLength={80}
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agenda-telefone">Telefone</FieldLabel>
          <PatternFormat
            id="agenda-telefone"
            customInput={Input}
            format="(##) #####-####"
            mask="_"
            inputMode="tel"
            value={telefone}
            onValueChange={({ value }) => setTelefone(value)}
          />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend variant="label">Serviços</FieldLegend>
        <ul className="flex max-h-56 flex-col overflow-y-auto rounded-xl p-1 ring-1 ring-border/80">
          {disponiveis.map((produto) => {
            const id = `servico-${produto.id}`
            return (
              <li key={produto.id}>
                <Label
                  htmlFor={id}
                  className="flex min-h-10 cursor-pointer max-sm:min-h-11 items-center gap-3 rounded-md px-2 py-1.5 font-normal transition-colors duration-150 hover:bg-foreground/[0.04]"
                >
                  <Checkbox
                    id={id}
                    checked={servicos.includes(produto.id)}
                    onCheckedChange={(marcado) => {
                      setServicos((atuais) =>
                        marcado
                          ? [...atuais, produto.id]
                          : atuais.filter((item) => item !== produto.id),
                      )
                      setInicio(null)
                    }}
                  />
                  <span className="flex-1">{produto.nome}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {textoDuracao(produto.duracaoMin ?? 60)} · {emReais(produto.preco)}
                  </span>
                </Label>
              </li>
            )
          })}
        </ul>
        {escolhidos.length > 0 && (
          <p className="text-sm tabular-nums">
            Duração: {textoDuracao(duracao)} · {emReais(total)}
          </p>
        )}
      </FieldSet>

      <EscolhaHorario
        servicos={servicos}
        diaInicial={dia}
        agora={agora}
        horarios={horarios}
        valor={inicio}
        aoMudar={setInicio}
      />

      <FieldSet>
        <FieldLegend variant="label">Pagamento no salão</FieldLegend>
        <RadioGroup
          value={pagamento ?? ""}
          onValueChange={(valor) => setPagamento(valor as Novo["pagamento"])}
          className="grid grid-cols-3 gap-2"
        >
          {PAGAMENTOS.map(({ valor, rotulo, icone: Icone }) => (
            <Label
              key={valor}
              htmlFor={`agenda-pagamento-${valor}`}
              className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-background p-2 text-xs ring-1 ring-border/80 transition-[box-shadow,background-color] duration-150 active:scale-[0.97] has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-[[data-state=checked]]:bg-foreground/[0.04] has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-foreground"
            >
              <RadioGroupItem value={valor} id={`agenda-pagamento-${valor}`} className="sr-only" />
              <Icone className="size-4" aria-hidden="true" />
              {rotulo}
            </Label>
          ))}
        </RadioGroup>
      </FieldSet>

      <Field>
        <FieldLabel htmlFor="agenda-observacao">Observação (opcional)</FieldLabel>
        <Textarea
          id="agenda-observacao"
          maxLength={280}
          rows={2}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </Field>

      <DialogFooter>
        <BotaoCarregando
          type="submit"
          disabled={!pronto}
          carregando={criar.isPending}
          rotuloCarregando="Marcando o agendamento"
        >
          Marcar
        </BotaoCarregando>
      </DialogFooter>
    </form>
  )
}

/** Botão e janela de novo agendamento. Ao marcar, a agenda vai para o dia marcado. */
export function NovoAgendamento({
  dia,
  agora,
  horarios,
  aoMarcar,
}: {
  dia: Date
  agora: Date
  horarios: HorarioFuncionamento[]
  aoMarcar: (inicio: Date) => void
}) {
  const [aberta, setAberta] = useState(false)
  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="max-sm:h-11">
          <PlusIcon data-icon="inline-start" />
          Novo agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            O preço e a duração saem dos serviços. A cliente paga no salão.
          </DialogDescription>
        </DialogHeader>
        {aberta && (
          <Formulario
            dia={dia}
            agora={agora}
            horarios={horarios}
            aoMarcar={(inicio) => {
              setAberta(false)
              aoMarcar(inicio)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
