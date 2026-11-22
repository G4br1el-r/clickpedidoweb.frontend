"use client"

import { BanknoteIcon, CreditCardIcon, QrCodeIcon } from "lucide-react"
import { useState } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { usePagar } from "@/lib/admin/dados/consultas-mesas"
import type { PagamentoMesa } from "@/lib/admin/dados/servidor"
import type { CartaoPagamento, Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { emCentavos, resumoDaConta, valorDosItens } from "@/lib/admin/regras/conta"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { sugestoesDeTroco } from "@/lib/checkout"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

/** O que vai ser recebido: uma parte (dividir) ou os itens marcados. Sem nada, o saldo. */
export type ParteDaConta = { valor?: number; itens?: string[] }

const FORMAS: { valor: PagamentoMesa; rotulo: string; icone: typeof BanknoteIcon }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro", icone: BanknoteIcon },
  { valor: "pix", rotulo: "Pix", icone: QrCodeIcon },
  { valor: "cartao-na-entrega", rotulo: "Cartão", icone: CreditCardIcon },
]

const CARTOES: { valor: CartaoPagamento; rotulo: string }[] = [
  { valor: "credito", rotulo: "Crédito" },
  { valor: "debito", rotulo: "Débito" },
]

/** Controle segmentado: a opção escolhida vira a etiqueta branca no trilho. */
const SEGMENTO = cn(
  "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium text-muted-foreground",
  "transition-[background-color,color,box-shadow,transform] duration-150 ease-saida hover:text-foreground active:scale-[0.97]",
  "has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]",
  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
)

function CampoDinheiro({
  id,
  rotulo,
  valor,
  aoMudar,
  desabilitado,
}: {
  id: string
  rotulo: string
  valor: number | undefined
  aoMudar: (valor: number | undefined) => void
  desabilitado?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <NumericFormat
        id={id}
        customInput={Input}
        inputMode="decimal"
        prefix="R$ "
        decimalSeparator=","
        thousandSeparator="."
        decimalScale={2}
        fixedDecimalScale
        disabled={desabilitado}
        value={valor ?? ""}
        onValueChange={({ floatValue }) => aoMudar(floatValue)}
      />
    </Field>
  )
}

function Formulario({
  mesa,
  pedido,
  parte,
  aoReceber,
}: {
  mesa: Mesa
  pedido: Pedido
  parte: ParteDaConta
  aoReceber: (fechou: boolean) => void
}) {
  const { saldo } = resumoDaConta(pedido)
  const porItem = Boolean(parte.itens?.length)
  const [forma, setForma] = useState<PagamentoMesa | null>(null)
  const [cartao, setCartao] = useState<CartaoPagamento | null>(null)
  const [valor, setValor] = useState<number | undefined>(
    porItem ? valorDosItens(pedido, parte.itens ?? []) : (parte.valor ?? saldo),
  )
  const [recebido, setRecebido] = useState<number | undefined>()
  const pagar = usePagar()
  const por = useGarcom((estado) => estado.nome)
  const dinheiro = forma === "dinheiro"
  const troco =
    dinheiro && valor !== undefined && recebido !== undefined
      ? (emCentavos(recebido) - emCentavos(valor)) / 100
      : 0
  const pronto =
    forma !== null &&
    (forma !== "cartao-na-entrega" || cartao !== null) &&
    valor !== undefined &&
    valor > 0 &&
    (!dinheiro || recebido === undefined || recebido >= valor)

  return (
    <>
      <RadioGroup
        aria-label="Forma de pagamento"
        value={forma ?? ""}
        onValueChange={(escolhida) => setForma(escolhida as PagamentoMesa)}
        className="grid grid-cols-3 gap-0.5 rounded-xl bg-foreground/[0.05] p-0.5"
      >
        {FORMAS.map(({ valor: opcao, rotulo, icone: Icone }) => (
          <Label key={opcao} htmlFor={`receber-forma-${opcao}`} className={SEGMENTO}>
            <RadioGroupItem value={opcao} id={`receber-forma-${opcao}`} className="sr-only" />
            <Icone className="size-4" aria-hidden="true" />
            {rotulo}
          </Label>
        ))}
      </RadioGroup>
      {forma === "cartao-na-entrega" && (
        <RadioGroup
          aria-label="Crédito ou débito"
          value={cartao ?? ""}
          onValueChange={(escolhido) => setCartao(escolhido as CartaoPagamento)}
          className="grid grid-cols-2 gap-0.5 rounded-xl bg-foreground/[0.05] p-0.5"
        >
          {CARTOES.map(({ valor: opcao, rotulo }) => (
            <Label key={opcao} htmlFor={`receber-cartao-${opcao}`} className={SEGMENTO}>
              <RadioGroupItem value={opcao} id={`receber-cartao-${opcao}`} className="sr-only" />
              {rotulo}
            </Label>
          ))}
        </RadioGroup>
      )}
      <CampoDinheiro
        id="receber-valor"
        rotulo="Valor"
        valor={valor}
        aoMudar={setValor}
        desabilitado={porItem}
      />
      {dinheiro && valor !== undefined && (
        <div className="flex flex-col gap-2">
          <CampoDinheiro
            id="receber-recebido"
            rotulo="Valor recebido"
            valor={recebido}
            aoMudar={setRecebido}
          />
          <fieldset aria-label="Notas" className="flex flex-wrap gap-2">
            {sugestoesDeTroco(valor).map((nota) => (
              <Button
                key={nota}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRecebido(nota)}
              >
                {emReais(nota)}
              </Button>
            ))}
          </fieldset>
          {troco > 0 && <p className="text-sm font-medium tabular-nums">Troco: {emReais(troco)}</p>}
        </div>
      )}
      <DialogFooter>
        <Button
          type="button"
          className="w-full"
          disabled={!pronto || pagar.isPending}
          onClick={() =>
            forma &&
            pagar.mutate(
              {
                pedidoId: pedido.id,
                forma,
                ...(porItem ? { itens: parte.itens } : { valor }),
                ...(dinheiro && recebido !== undefined ? { recebido } : {}),
                ...(forma === "cartao-na-entrega" && cartao ? { cartao } : {}),
                ...autorDaAcao(por, pedido.mesa?.garcom),
              },
              {
                onSuccess: (paga) => {
                  const fechou = paga.status === "concluido"
                  toast.success(
                    fechou
                      ? `Conta da mesa ${mesa.numero} fechada.`
                      : `${emReais(valor ?? 0)} recebido da mesa ${mesa.numero}.`,
                  )
                  aoReceber(fechou)
                },
                onError: (erro) => toast.error(erro.message),
              },
            )
          }
        >
          Receber {emReais(valor ?? 0)}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Janela "Receber": forma, crédito ou débito, o valor da parte e, no dinheiro, o troco. */
export function ReceberConta({
  mesa,
  pedido,
  parte,
  aoMudar,
  aoReceber,
}: {
  mesa: Mesa
  pedido: Pedido
  /** `null`: a janela está fechada. */
  parte: ParteDaConta | null
  aoMudar: (aberta: boolean) => void
  aoReceber: (fechou: boolean) => void
}) {
  return (
    <Dialog open={parte !== null} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receber da mesa {mesa.numero}</DialogTitle>
          <DialogDescription>
            Saldo de {emReais(resumoDaConta(pedido).saldo)}. Quando o saldo zera, a conta fecha.
          </DialogDescription>
        </DialogHeader>
        {parte && (
          <Formulario
            key={JSON.stringify(parte)}
            mesa={mesa}
            pedido={pedido}
            parte={parte}
            aoReceber={aoReceber}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
