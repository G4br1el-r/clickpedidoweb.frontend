"use client"

import { BanknoteIcon, CreditCardIcon, InfoIcon, QrCodeIcon, SmartphoneNfcIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { NumericFormat, PatternFormat } from "react-number-format"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type DadosCheckout,
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  sugestoesDeTroco,
} from "@/lib/checkout"
import { emReais } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { cn } from "@/lib/utils"
import { CabecalhoPasso } from "./cabecalho-passo"
import { Campo, ESTILO_CAMPO } from "./campo"
import { CartaoOpcao } from "./cartao-opcao"

const CURVA = [0.23, 1, 0.32, 1] as const

const ICONES: Record<FormaPagamento, ReactNode> = {
  pix: <QrCodeIcon />,
  "cartao-online": <CreditCardIcon />,
  dinheiro: <BanknoteIcon />,
  maquininha: <SmartphoneNfcIcon />,
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Chip de troco no ToggleGroup do shadcn: contorno em repouso, cor da marca quando escolhido. */
const ESTILO_CHIP =
  "h-11 rounded-full px-4 font-semibold tabular-nums data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"

function BlocoTroco({ total }: { total: number }) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<DadosCheckout>()
  const troco = useWatch({ control, name: "troco" })
  const sugestoes = sugestoesDeTroco(total)
  const [outro, setOutro] = useState(() => troco !== null && !sugestoes.includes(troco))

  function escolher(valor: number | null) {
    setOutro(false)
    setValue("troco", valor, { shouldValidate: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <p id="titulo-troco" className="text-sm font-semibold">
        Precisa de troco?
      </p>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={2}
        aria-labelledby="titulo-troco"
        value={outro ? "outro" : troco === null ? "nenhum" : String(troco)}
        onValueChange={(valor) => {
          if (!valor) return
          vibrar()
          if (valor === "outro") {
            setOutro(true)
            setValue("troco", null)
            return
          }
          escolher(valor === "nenhum" ? null : Number(valor))
        }}
        className="flex-wrap"
      >
        <ToggleGroupItem value="nenhum" className={ESTILO_CHIP}>
          Não preciso
        </ToggleGroupItem>
        {sugestoes.map((valor) => (
          <ToggleGroupItem key={valor} value={String(valor)} className={ESTILO_CHIP}>
            {emReais(valor).replace(",00", "")}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="outro" className={ESTILO_CHIP}>
          Outro valor
        </ToggleGroupItem>
      </ToggleGroup>

      <AnimatePresence initial={false}>
        {outro && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: CURVA }}
            className="-mx-1 overflow-hidden px-1 pt-1"
          >
            <Campo id="troco" rotulo="Troco para quanto?" erro={errors.troco?.message}>
              <Controller
                control={control}
                name="troco"
                render={({ field: { ref, onChange, value, ...campo } }) => (
                  <NumericFormat
                    {...campo}
                    value={value ?? ""}
                    getInputRef={ref}
                    onValueChange={({ floatValue }) => onChange(floatValue ?? null)}
                    customInput={Input}
                    id="troco"
                    inputMode="decimal"
                    prefix="R$ "
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    allowNegative={false}
                    placeholder="R$ 0,00"
                    autoFocus
                    aria-invalid={Boolean(errors.troco)}
                    aria-describedby={errors.troco ? "troco-erro" : undefined}
                    className={cn(ESTILO_CAMPO, "max-w-60")}
                  />
                )}
              />
            </Campo>
          </motion.div>
        )}
      </AnimatePresence>

      {!outro && errors.troco?.message && (
        <p className="text-sm text-destructive">{errors.troco.message}</p>
      )}

      <AnimatePresence initial={false}>
        {troco !== null && troco >= total && (
          <motion.p
            key="troco"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: CURVA }}
            className="text-sm font-medium text-sucesso"
            aria-live="polite"
          >
            Seu troco será de {emReais(troco - total)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Detalhe({
  forma,
  total,
  retirada,
}: {
  forma: FormaPagamento
  total: number
  retirada: boolean
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<DadosCheckout>()

  if (forma === "pix") {
    return (
      <div className="flex flex-col gap-3">
        <Campo
          id="cpf"
          rotulo="CPF"
          erro={errors.cpf?.message}
          dica="O banco pede o CPF para gerar o Pix."
        >
          <Controller
            control={control}
            name="cpf"
            render={({ field: { ref, onChange, ...campo } }) => (
              <PatternFormat
                {...campo}
                getInputRef={ref}
                onValueChange={({ formattedValue }) => onChange(formattedValue)}
                format="###.###.###-##"
                customInput={Input}
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                aria-invalid={Boolean(errors.cpf)}
                aria-describedby={errors.cpf ? "cpf-erro" : undefined}
                className={cn(ESTILO_CAMPO, "max-w-60")}
              />
            )}
          />
        </Campo>
        <Aviso>O QR Code e o código para copiar aparecem assim que você enviar o pedido.</Aviso>
      </div>
    )
  }
  if (forma === "cartao-online") {
    return <Aviso>Você paga com segurança logo depois de enviar o pedido.</Aviso>
  }
  if (forma === "dinheiro") return <BlocoTroco total={total} />
  return (
    <Aviso>
      {retirada
        ? "Pague no balcão, no crédito ou no débito."
        : "O entregador leva a maquininha. Aceitamos crédito e débito."}
    </Aviso>
  )
}

export function PassoPagamento({ total }: { total: number }) {
  const { control } = useFormContext<DadosCheckout>()
  const tipo = useWatch({ control, name: "tipo" })
  const retirada = tipo === "retirada"
  const grupos = [
    { titulo: "Pague agora", formas: ["pix", "cartao-online"] as const },
    {
      titulo: retirada ? "Pague na retirada" : "Pague na entrega",
      formas: ["dinheiro", "maquininha"] as const,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPasso
        titulo="Como você prefere pagar?"
        descricao={
          <>
            Total do pedido:{" "}
            <strong className="text-foreground tabular-nums">{emReais(total)}</strong>
          </>
        }
      />
      <Controller
        control={control}
        name="pagamento"
        render={({ field }) => (
          <RadioGroup
            aria-label="Forma de pagamento"
            value={field.value}
            onValueChange={field.onChange}
            className="flex flex-col gap-5"
          >
            {grupos.map(({ titulo, formas }) => (
              <div key={titulo} className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-muted-foreground">{titulo}</p>
                {formas.map((forma) => (
                  <div key={forma} className="flex flex-col">
                    <CartaoOpcao
                      valor={forma}
                      testId={`pagamento-${forma}`}
                      selecionado={field.value === forma}
                      icone={ICONES[forma]}
                      titulo={FORMAS_PAGAMENTO[forma].titulo}
                      detalhe={FORMAS_PAGAMENTO[forma].detalhe}
                    />
                    <AnimatePresence initial={false}>
                      {field.value === forma && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: CURVA }}
                          className="-mx-1 overflow-hidden px-1"
                        >
                          <div className="pt-3 pb-1 pl-1">
                            <Detalhe forma={forma} total={total} retirada={retirada} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            ))}
          </RadioGroup>
        )}
      />
    </div>
  )
}
