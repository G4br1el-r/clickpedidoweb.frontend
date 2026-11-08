"use client"

import {
  CheckIcon,
  CreditCardIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dica } from "@/components/dica"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { OPCOES_PRO, PRECO_PRO_COMPLETO, useConfig, useSacolaAdmin } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

type Plano = "avulso" | "completo"
type Etapa = "sacola" | "pagando" | "pronto"

/** Simulação do pagamento: tempo de "processando" antes de confirmar. */
const TEMPO_PAGAMENTO_MS = 1600

function porMes(valor: number) {
  return `${emReais(valor)}/mês`
}

function CartaoPlano({
  valor,
  titulo,
  detalhe,
  preco,
  destaque,
}: {
  valor: Plano
  titulo: string
  detalhe: string
  preco: number
  destaque?: string
}) {
  const id = `plano-${valor}`
  return (
    <FieldLabel htmlFor={id} className="rounded-2xl">
      <Field orientation="horizontal" className="items-center gap-3 p-3!">
        <FieldContent>
          <FieldTitle className="flex flex-wrap items-center gap-2">
            {titulo}
            {destaque && (
              <Badge className="selo-pro" data-pro-liberada>
                {destaque}
              </Badge>
            )}
          </FieldTitle>
          <FieldDescription>{detalhe}</FieldDescription>
        </FieldContent>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{porMes(preco)}</span>
        <RadioGroupItem value={valor} id={id} aria-label={titulo} />
      </Field>
    </FieldLabel>
  )
}

/**
 * Sacola do painel: os recursos Pro escolhidos sem contratar. Já aparecem na prévia;
 * aqui a loja contrata (simulação) e aplica tudo no site.
 */
export function SacolaAdmin() {
  const aberta = useConfig((estado) => estado.sacolaAberta)
  const paraAplicar = useConfig((estado) => estado.sacolaParaAplicar)
  const abrirSacola = useConfig((estado) => estado.abrirSacola)
  const removerDaSacola = useConfig((estado) => estado.removerDaSacola)
  const contratar = useConfig((estado) => estado.contratar)
  const aplicarNoSite = useConfig((estado) => estado.aplicarNoSite)
  const itens = useSacolaAdmin()
  const subtotal = itens.reduce((soma, item) => soma + item.preco, 0)
  const completoCompensa = subtotal >= PRECO_PRO_COMPLETO * 0.6
  const [plano, setPlano] = useState<Plano>("avulso")
  const [pagamento, setPagamento] = useState("pix")
  const [etapa, setEtapa] = useState<Etapa>("sacola")
  const total = plano === "completo" ? PRECO_PRO_COMPLETO : subtotal

  // Sugere o Pro completo quando a sacola já passa de boa parte do preço dele.
  useEffect(() => {
    if (aberta) setPlano(subtotal >= PRECO_PRO_COMPLETO ? "completo" : "avulso")
  }, [aberta, subtotal])

  // Volta ao começo depois de fechar.
  useEffect(() => {
    if (!aberta && etapa === "pronto") {
      const volta = setTimeout(() => setEtapa("sacola"), 300)
      return () => clearTimeout(volta)
    }
  }, [aberta, etapa])

  function pagar() {
    setEtapa("pagando")
    const chaves = itens.map((item) => item.chave)
    setTimeout(() => {
      contratar(plano === "completo" ? "tudo" : chaves)
      aplicarNoSite()
      setEtapa("pronto")
    }, TEMPO_PAGAMENTO_MS)
  }

  function aplicarSemPro() {
    aplicarNoSite()
    abrirSacola(false)
    toast("Aplicado sem os recursos Pro", {
      description: "Eles continuam na sacola e na prévia, para contratar quando quiser.",
    })
  }

  return (
    <Sheet open={aberta} onOpenChange={(abrir) => etapa !== "pagando" && abrirSacola(abrir)}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]"
        data-testid="sacola-admin"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2 font-heading text-xl">
            <ShoppingBagIcon className="size-5" />
            Sacola do painel
          </SheetTitle>
          <SheetDescription>
            Recursos Pro que você escolheu. Eles já aparecem na prévia.
          </SheetDescription>
        </SheetHeader>

        <AnimatePresence mode="wait" initial={false}>
          {etapa === "pronto" ? (
            <motion.div
              key="pronto"
              className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="grid size-20 place-items-center rounded-full bg-[#F5B700] text-[#2A1700]"
                initial={{ scale: 0.4, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
              >
                <CheckIcon className="size-10" strokeWidth={3} />
              </motion.span>
              <div>
                <p className="font-heading text-2xl font-extrabold">Tudo certo!</p>
                <p className="mt-1 text-muted-foreground">
                  Recursos contratados e configurações aplicadas no site.
                </p>
              </div>
              <Button type="button" onClick={() => abrirSacola(false)}>
                Voltar às configurações
              </Button>
            </motion.div>
          ) : itens.length === 0 ? (
            <motion.div
              key="vazia"
              className="flex flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingBagIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sua sacola está vazia</EmptyTitle>
                  <EmptyDescription>
                    Escolha opções com o selo Pro para testar na prévia. Elas aparecem aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </motion.div>
          ) : (
            <motion.div
              key="sacola"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                {paraAplicar && (
                  <Alert>
                    <SparklesIcon />
                    <AlertTitle>Falta contratar para aplicar no site</AlertTitle>
                    <AlertDescription>
                      Estes recursos são Pro. Contrate agora ou aplique sem eles.
                    </AlertDescription>
                  </Alert>
                )}

                <ul className="flex flex-col" aria-label="Recursos na sacola">
                  <AnimatePresence initial={false}>
                    {itens.map((item) => (
                      <motion.li
                        key={item.chave}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-3 py-2.5">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F5B700]/15 text-[#B07600] dark:text-[#F5C542]">
                            <SparklesIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {item.nome}
                            </span>
                            <span
                              className={cn(
                                "text-xs text-muted-foreground tabular-nums",
                                plano === "completo" && "line-through",
                              )}
                            >
                              {porMes(item.preco)}
                            </span>
                          </span>
                          <Dica texto="Tirar da sacola">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Tirar ${item.nome} da sacola`}
                              onClick={() => removerDaSacola(item.chave)}
                              disabled={etapa === "pagando"}
                            >
                              <Trash2Icon />
                            </Button>
                          </Dica>
                        </div>
                        <Separator />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <section className="flex flex-col gap-2.5" aria-labelledby="titulo-plano">
                  <h3 id="titulo-plano" className="text-sm font-semibold">
                    Como contratar
                  </h3>
                  <RadioGroup
                    value={plano}
                    onValueChange={(valor) => setPlano(valor as Plano)}
                    aria-labelledby="titulo-plano"
                    className="gap-2"
                  >
                    <CartaoPlano
                      valor="avulso"
                      titulo="Só estes recursos"
                      detalhe={`${itens.length} ${itens.length === 1 ? "recurso" : "recursos"} da sacola`}
                      preco={subtotal}
                    />
                    <CartaoPlano
                      valor="completo"
                      titulo="Pro completo"
                      detalhe={`Todos os ${OPCOES_PRO.size} recursos Pro, inclusive os que vierem`}
                      preco={PRECO_PRO_COMPLETO}
                      destaque={completoCompensa ? "Compensa" : undefined}
                    />
                  </RadioGroup>
                </section>

                <section className="flex flex-col gap-2.5" aria-labelledby="titulo-pagamento">
                  <h3 id="titulo-pagamento" className="text-sm font-semibold">
                    Pagamento
                  </h3>
                  <RadioGroup
                    value={pagamento}
                    onValueChange={setPagamento}
                    aria-labelledby="titulo-pagamento"
                    className="grid-cols-2 gap-2"
                  >
                    {[
                      { valor: "pix", rotulo: "Pix", icone: QrCodeIcon },
                      { valor: "cartao", rotulo: "Cartão da conta", icone: CreditCardIcon },
                    ].map(({ valor, rotulo, icone: Icone }) => (
                      <FieldLabel key={valor} htmlFor={`pagar-${valor}`} className="rounded-2xl">
                        <Field orientation="horizontal" className="items-center gap-2 p-3!">
                          <Icone className="size-4 shrink-0" aria-hidden="true" />
                          <FieldTitle className="flex-1">{rotulo}</FieldTitle>
                          <RadioGroupItem value={valor} id={`pagar-${valor}`} aria-label={rotulo} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Protótipo: o pagamento é simulado e nada é cobrado.
                  </p>
                </section>
              </div>

              <SheetFooter className="gap-2 border-t border-border">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold tabular-nums">{porMes(total)}</span>
                </div>
                <Button
                  type="button"
                  size="lg"
                  onClick={pagar}
                  disabled={etapa === "pagando"}
                  data-testid="contratar"
                  className="botao-brilho h-12 bg-linear-to-r from-[#F5B700] to-[#FF8A4C] text-[#2A1700] hover:opacity-95"
                >
                  {etapa === "pagando" ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Processando pagamento
                    </>
                  ) : (
                    "Contratar e aplicar no site"
                  )}
                </Button>
                {paraAplicar && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={aplicarSemPro}
                    disabled={etapa === "pagando"}
                  >
                    Aplicar sem os recursos Pro
                  </Button>
                )}
              </SheetFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
