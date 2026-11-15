"use client"

import { BikeIcon, CreditCardIcon, StoreIcon, UserRoundIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { textoDoHorario } from "@/lib/agendar"
import { type DadosCheckout, FORMAS_PAGAMENTO, LIMITE_OBSERVACAO_PEDIDO } from "@/lib/checkout"
import { useLoja } from "@/lib/loja-atual"
import { descricaoDoTroco } from "@/lib/pedido"
import { cn } from "@/lib/utils"
import { CabecalhoPasso } from "./cabecalho-passo"
import { Campo } from "./campo"
import { CURVA_SAIDA } from "./movimento"
import type { PassoId } from "./passos"

/** Atrasos curtos e não uniformes: os blocos chegam juntos, um tiquinho depois do outro. */
const ATRASOS = [0.04, 0.09, 0.13]

function Bloco({
  icone,
  titulo,
  indice,
  aoAlterar,
  children,
}: {
  icone: ReactNode
  titulo: string
  indice: number
  aoAlterar: () => void
  children: ReactNode
}) {
  const reduzido = useReducedMotion()
  return (
    <motion.section
      initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: ATRASOS[indice] ?? 0, ease: CURVA_SAIDA }}
      className="flex items-start gap-3.5 py-4"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex shrink-0 text-muted-foreground [&_svg]:size-5"
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-[13px] font-medium text-muted-foreground">{titulo}</h3>
        <div className="mt-0.5 text-[15px] leading-snug">{children}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="-my-2.5 -mr-3 h-11 shrink-0 rounded-full px-3 text-sm font-medium text-marca-texto hover:bg-muted"
        onClick={aoAlterar}
        aria-label={`Alterar ${titulo.toLowerCase()}`}
      >
        Alterar
      </Button>
    </motion.section>
  )
}

export function PassoRevisao({ total, aoIr }: { total: number; aoIr: (passo: PassoId) => void }) {
  const lojaEscolhida = useLoja()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DadosCheckout>()
  const dados = useWatch({ control }) as DadosCheckout
  const observacao = dados.observacao ?? ""
  const restantes = LIMITE_OBSERVACAO_PEDIDO - observacao.length
  const forma = FORMAS_PAGAMENTO[dados.pagamento]
  const entrega = dados.tipo === "entrega"

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPasso titulo="Confira e envie" descricao="Se algo estiver errado, é só alterar." />

      {!lojaEscolhida.status.aberta && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          A loja está fechada agora. Os pedidos voltam assim que abrirmos.
        </p>
      )}

      <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
        <Bloco
          icone={<UserRoundIcon />}
          titulo="Seus dados"
          indice={0}
          aoAlterar={() => aoIr("dados")}
        >
          <p className="font-medium">{dados.nome}</p>
          <p className="text-muted-foreground tabular-nums">{dados.whatsapp}</p>
        </Bloco>
        <Bloco
          icone={entrega ? <BikeIcon /> : <StoreIcon />}
          titulo={dados.agendamento ? "Horário" : entrega ? "Entrega" : "Retirada"}
          indice={1}
          aoAlterar={() => aoIr("entrega")}
        >
          {entrega ? (
            <>
              <p className="font-medium">
                {dados.rua}, {dados.numero}
                {dados.complemento ? `, ${dados.complemento}` : ""}
              </p>
              <p className="text-muted-foreground">
                {dados.bairro}
                {dados.cidade ? ` · ${dados.cidade}` : ""}
                {dados.uf ? `/${dados.uf.toUpperCase()}` : ""}
              </p>
              {dados.referencia && <p className="text-muted-foreground">{dados.referencia}</p>}
              <p className="text-muted-foreground">Chega em {lojaEscolhida.entrega.tempo}</p>
            </>
          ) : (
            <>
              {dados.agendamento ? (
                <p className="font-medium">{textoDoHorario(dados.agendamento)}</p>
              ) : (
                <p className="font-medium">Balcão da {lojaEscolhida.nome}</p>
              )}
              <p className="text-muted-foreground">{lojaEscolhida.endereco}</p>
              {!dados.agendamento && (
                <p className="text-muted-foreground">
                  Fica pronto em {lojaEscolhida.retirada.tempo}
                </p>
              )}
            </>
          )}
        </Bloco>
        <Bloco
          icone={<CreditCardIcon />}
          titulo="Pagamento"
          indice={2}
          aoAlterar={() => aoIr("pagamento")}
        >
          <p className="font-medium">{forma.titulo}</p>
          <p className="text-muted-foreground">
            {dados.pagamento === "dinheiro"
              ? descricaoDoTroco(dados.troco, total)
              : forma.agora
                ? "Pago logo depois de enviar"
                : entrega
                  ? "Pago na entrega"
                  : "Pago na retirada"}
          </p>
        </Bloco>
      </div>

      <Campo
        id="observacao"
        rotulo="Observação do pedido"
        opcional
        erro={errors.observacao?.message}
      >
        <Textarea
          id="observacao"
          maxLength={LIMITE_OBSERVACAO_PEDIDO}
          placeholder="Ex.: mandar guardanapo extra, tocar o interfone 2"
          aria-describedby="observacao-restante"
          className="min-h-24 resize-none rounded-xl bg-background px-3.5 py-3 text-base md:text-base"
          {...register("observacao")}
        />
        <p
          id="observacao-restante"
          className={cn(
            "text-right text-xs tabular-nums",
            restantes <= 30 ? "font-semibold text-marca-acento-texto" : "text-muted-foreground",
          )}
        >
          {restantes} {restantes === 1 ? "caractere restante" : "caracteres restantes"}
        </p>
      </Campo>
    </div>
  )
}
