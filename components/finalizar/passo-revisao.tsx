"use client"

import { BikeIcon, CreditCardIcon, StoreIcon, UserRoundIcon } from "lucide-react"
import { motion } from "motion/react"
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
import type { PassoId } from "./passos"

const CURVA = [0.23, 1, 0.32, 1] as const

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
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 + indice * 0.06, ease: CURVA }}
      className="flex items-start gap-3 rounded-2xl border bg-background p-3.5"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-marca-texto [&_svg]:size-5"
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-sm font-semibold text-muted-foreground">{titulo}</h3>
        <div className="text-[15px]">{children}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="-my-1 -mr-1 h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-marca-texto hover:bg-accent"
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
    <div className="flex flex-col gap-5">
      <CabecalhoPasso titulo="Confira e envie" descricao="Se algo estiver errado, é só alterar." />

      {!lojaEscolhida.status.aberta && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          A loja está fechada agora. Os pedidos voltam assim que abrirmos.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Bloco
          icone={<UserRoundIcon />}
          titulo="Seus dados"
          indice={0}
          aoAlterar={() => aoIr("dados")}
        >
          <p className="font-semibold">{dados.nome}</p>
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
              <p className="font-semibold">
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
                <p className="font-semibold">{textoDoHorario(dados.agendamento)}</p>
              ) : (
                <p className="font-semibold">Balcão da {lojaEscolhida.nome}</p>
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
          <p className="font-semibold">{forma.titulo}</p>
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
          className="min-h-24 resize-none rounded-xl bg-background text-base md:text-base"
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
