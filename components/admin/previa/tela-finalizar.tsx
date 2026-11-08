"use client"

import {
  BanknoteIcon,
  CheckIcon,
  CreditCardIcon,
  Loader2Icon,
  QrCodeIcon,
  TicketPercentIcon,
  WalletCardsIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { ArteEnvioPizza, MENSAGENS_ENVIO_PIZZA } from "@/components/segmentos/pizzaria/envio-pizza"
import { Input } from "@/components/ui/input"
import type { Config, MetodoPagamento } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import type { ItemSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"
import { Entrada, useConfigAtual } from "./comum"
import { classeBotao } from "./estilos"

const METODOS: Record<
  MetodoPagamento,
  { nome: string; detalhe: string; icone: typeof QrCodeIcon }
> = {
  pix: { nome: "Pix", detalhe: "Aprovação na hora", icone: QrCodeIcon },
  "cartao-online": { nome: "Cartão online", detalhe: "Crédito ou débito", icone: CreditCardIcon },
  dinheiro: { nome: "Dinheiro", detalhe: "Troco na entrega", icone: BanknoteIcon },
  "cartao-entrega": { nome: "Cartão na entrega", detalhe: "Maquininha", icone: WalletCardsIcon },
}

const PASSOS = ["Dados", "Entrega", "Pagamento", "Revisão"]

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-3xl bg-card p-4 ring-1 ring-border">
      <h3 className="font-heading text-base font-bold">{titulo}</h3>
      {children}
    </section>
  )
}

function Pagamento({ config }: { config: Config }) {
  const ativos = (Object.keys(METODOS) as MetodoPagamento[]).filter(
    (metodo) => config.finalizar.pagamentos[metodo],
  )
  if (ativos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento ligada.</p>
  }
  return (
    <ul className="grid gap-2 @3xl/tela:grid-cols-2">
      {ativos.map((metodo, indice) => {
        const { nome, detalhe, icone: Icone } = METODOS[metodo]
        const escolhido = indice === 0
        return (
          <li
            key={metodo}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-3 ring-1",
              escolhido ? "bg-accent ring-primary" : "ring-border",
            )}
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-xl",
                escolhido ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              <Icone className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{nome}</span>
              <span className="block text-xs text-muted-foreground">{detalhe}</span>
            </span>
            <span
              className={cn(
                "size-5 rounded-full ring-2",
                escolhido ? "bg-primary ring-primary ring-offset-2 ring-offset-card" : "ring-input",
              )}
            />
          </li>
        )
      })}
    </ul>
  )
}

function Extras({ config }: { config: Config }) {
  const [gorjeta, setGorjeta] = useState(10)
  return (
    <>
      {config.finalizar.cupom && (
        <Secao titulo="Cupom de desconto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TicketPercentIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Cupom" placeholder="Digite o cupom" className="h-11 pl-9" />
            </div>
            <span className="grid h-11 place-items-center rounded-xl bg-secondary px-4 text-sm font-semibold">
              Aplicar
            </span>
          </div>
        </Secao>
      )}
      {config.finalizar.gorjeta && (
        <Secao titulo="Gorjeta para o entregador">
          <div className="flex gap-2">
            {[0, 5, 10, 15].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setGorjeta(valor)}
                className={cn(
                  "h-10 flex-1 rounded-full text-sm font-semibold ring-1",
                  gorjeta === valor
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "ring-border",
                )}
              >
                {valor === 0 ? "Não" : emReais(valor)}
              </button>
            ))}
          </div>
        </Secao>
      )}
    </>
  )
}

/** Pedido de exemplo para a arte do envio: meio a meio com borda recheada. */
const PEDIDO_EXEMPLO = [
  {
    chave: "exemplo",
    produtoId: "meio-a-meio",
    nome: "Pizza meio a meio",
    resumo: ["Calabresa Especial", "Marguerita Napolitana", "Borda Catupiry"],
    precoUnitario: 68,
    quantidade: 1,
  },
] as unknown as ItemSacola[]

/** Etapas do envio, iguais às do site: quatro partes em 5 segundos. */
const DURACAO_ENVIO_MS = 5000
const ETAPAS_ENVIO = 4

/** Carregamento ao enviar o pedido: simples ou temático (o mesmo forno a lenha do site). */
function Carregamento({ config, aoTerminar }: { config: Config; aoTerminar: () => void }) {
  const [etapa, setEtapa] = useState(0)
  useEffect(() => {
    const passos = Array.from({ length: ETAPAS_ENVIO - 1 }, (_, indice) =>
      setTimeout(() => setEtapa(indice + 1), ((indice + 1) * DURACAO_ENVIO_MS) / ETAPAS_ENVIO),
    )
    const fim = setTimeout(aoTerminar, DURACAO_ENVIO_MS + 600)
    return () => {
      for (const passo of passos) clearTimeout(passo)
      clearTimeout(fim)
    }
  }, [aoTerminar])

  const tematico = config.finalizar.carregamento === "tematico"
  return (
    <motion.div
      className="absolute inset-0 z-40 grid place-items-center bg-background/95 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {tematico ? (
          <ArteEnvioPizza etapa={etapa} itens={PEDIDO_EXEMPLO} />
        ) : (
          <Loader2Icon className="size-10 animate-spin text-primary" />
        )}
        <AnimatePresence mode="wait">
          <motion.p
            key={tematico ? etapa : "fixo"}
            className="font-heading text-xl font-extrabold"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          >
            {tematico ? MENSAGENS_ENVIO_PIZZA[etapa] : "Enviando seu pedido…"}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/** Finalização: por etapas ou tudo em uma página, com o que a loja ligou. */
export function TelaFinalizar() {
  const config = useConfigAtual()
  const [enviando, setEnviando] = useState(false)
  const passos = config.finalizar.fluxo === "passos"

  return (
    <div className="relative flex min-h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 pt-5 pb-8">
        <Entrada indice={0}>
          <h2 className="font-heading text-2xl font-extrabold">Finalizar pedido</h2>
          {passos && (
            <ol className="mt-4 flex items-center gap-1.5">
              {PASSOS.map((passo, indice) => (
                <li key={passo} className="flex flex-1 flex-col gap-1.5">
                  <span
                    className={cn("h-1.5 rounded-full", indice <= 2 ? "bg-primary" : "bg-muted")}
                  />
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-semibold",
                      indice === 2 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {indice < 2 && <CheckIcon className="size-3" />}
                    {passo}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Entrada>

        {!passos && (
          <Entrada indice={1}>
            <Secao titulo="Seus dados">
              <Input aria-label="Nome" defaultValue="Ana Souza" className="h-11" />
              <Input aria-label="Telefone" defaultValue="(12) 99999-0000" className="h-11" />
              {config.finalizar.cpfNaNota && (
                <Input
                  aria-label="CPF na nota"
                  placeholder="CPF na nota (opcional)"
                  className="h-11"
                />
              )}
            </Secao>
          </Entrada>
        )}

        <Entrada indice={2}>
          <Secao titulo="Como você quer pagar?">
            <Pagamento config={config} />
          </Secao>
        </Entrada>

        <Entrada indice={3} className="flex flex-col gap-4">
          <Extras config={config} />
          {config.finalizar.observacao && (
            <Secao titulo="Observação para a loja">
              <Input
                aria-label="Observação"
                placeholder="Ex.: interfone com defeito"
                className="h-11"
              />
            </Secao>
          )}
          {passos && config.finalizar.cpfNaNota && (
            <Secao titulo="CPF na nota">
              <Input aria-label="CPF na nota" placeholder="Opcional" className="h-11" />
            </Secao>
          )}
        </Entrada>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 p-3 pb-6 backdrop-blur @3xl/tela:pb-3">
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          <div className="leading-tight">
            <span className="block text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-bold tabular-nums">{emReais(96)}</span>
          </div>
          <button
            type="button"
            onClick={() => setEnviando(true)}
            className={cn(
              "h-12 flex-1 rounded-full text-sm font-semibold",
              classeBotao(config.cores.botao),
            )}
          >
            {config.finalizar.textoBotao || "Enviar pedido"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {enviando && <Carregamento config={config} aoTerminar={() => setEnviando(false)} />}
      </AnimatePresence>
    </div>
  )
}
