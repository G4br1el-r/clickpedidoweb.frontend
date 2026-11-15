"use client"

import NumberFlow from "@number-flow/react"
import {
  CheckIcon,
  CreditCardIcon,
  LockIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dica } from "@/components/dica"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { CURVA_SAIDA } from "./barra-acoes"
import { CLASSE_OPCAO, SeloPro } from "./campos"
import { Traco } from "./traco"

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
    <FieldLabel htmlFor={id} className={CLASSE_OPCAO}>
      <Field orientation="horizontal" className="items-center gap-3 p-3!">
        <FieldContent>
          <FieldTitle className="flex flex-wrap items-center gap-2">
            {titulo}
            {destaque && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Traco tom="pronto" className="h-3" />
                {destaque}
              </span>
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
  const reduzir = useReducedMotion()

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
        <SheetHeader className="border-b border-border/70">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <ShoppingBagIcon className="size-4" aria-hidden="true" />
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
              initial={reduzir ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: CURVA_SAIDA } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <motion.span
                className="grid size-14 place-items-center rounded-full bg-(--tom-pronto)/12 text-(--tom-pronto)"
                initial={reduzir ? false : { scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              >
                <CheckIcon className="size-7" strokeWidth={2.5} aria-hidden="true" />
              </motion.span>
              <div>
                <p className="text-xl font-semibold tracking-[-0.01em]">Tudo certo!</p>
                <p className="mt-1 text-sm text-muted-foreground">
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
                    <LockIcon />
                    <AlertTitle>Falta contratar para aplicar no site</AlertTitle>
                    <AlertDescription>
                      Estes recursos são Pro. Contrate agora ou aplique sem eles.
                    </AlertDescription>
                  </Alert>
                )}

                <ul
                  className="flex flex-col border-t border-border/60"
                  aria-label="Recursos na sacola"
                >
                  <AnimatePresence initial={false}>
                    {itens.map((item) => (
                      <motion.li
                        key={item.chave}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                          transition: { duration: 0.2, ease: CURVA_SAIDA },
                        }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                        className="overflow-hidden border-b border-border/60"
                      >
                        <div className="flex min-h-12 items-center gap-3 py-2">
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate text-sm font-medium">{item.nome}</span>
                            <SeloPro liberada={false} />
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-sm text-muted-foreground tabular-nums transition-colors duration-150",
                              plano === "completo" && "text-muted-foreground/60 line-through",
                            )}
                          >
                            {porMes(item.preco)}
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
                      <FieldLabel key={valor} htmlFor={`pagar-${valor}`} className={CLASSE_OPCAO}>
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

              <SheetFooter className="gap-2 border-t border-border/70">
                <div
                  role="status"
                  aria-label="Total"
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold tracking-[-0.01em] tabular-nums">
                    <span className="sr-only">{porMes(total)}</span>
                    <span aria-hidden="true">
                      <NumberFlow
                        value={total}
                        locales="pt-BR"
                        format={{ style: "currency", currency: "BRL" }}
                      />
                      <span className="text-sm font-medium text-muted-foreground">/mês</span>
                    </span>
                  </span>
                </div>
                <Button
                  type="button"
                  size="lg"
                  onClick={pagar}
                  disabled={etapa === "pagando"}
                  data-testid="contratar"
                  className="h-11 active:scale-[0.97]"
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
