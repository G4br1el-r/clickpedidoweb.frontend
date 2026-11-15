"use client"

import { SparklesIcon } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { PatternFormat } from "react-number-format"
import { Input } from "@/components/ui/input"
import type { DadosCheckout } from "@/lib/checkout"
import { CabecalhoPasso } from "./cabecalho-passo"
import { Campo, ESTILO_CAMPO } from "./campo"

export function PassoDados({ lembrado }: { lembrado: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DadosCheckout>()

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPasso
        titulo="Para quem é o pedido?"
        descricao="Usamos seu WhatsApp só para avisar o andamento do pedido."
      />
      {lembrado && (
        <p className="-mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <SparklesIcon className="size-4 shrink-0" aria-hidden="true" />
          Preenchemos com os dados do seu último pedido.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nome" rotulo="Nome" erro={errors.nome?.message}>
          <Input
            id="nome"
            autoComplete="name"
            maxLength={80}
            placeholder="Como podemos te chamar?"
            aria-invalid={Boolean(errors.nome)}
            aria-describedby={errors.nome ? "nome-erro" : undefined}
            className={ESTILO_CAMPO}
            {...register("nome")}
          />
        </Campo>
        <Campo id="whatsapp" rotulo="WhatsApp" erro={errors.whatsapp?.message}>
          <Controller
            control={control}
            name="whatsapp"
            render={({ field: { ref, onChange, ...campo } }) => (
              <PatternFormat
                {...campo}
                getInputRef={ref}
                onValueChange={({ formattedValue }) => onChange(formattedValue)}
                format="(##) #####-####"
                mask="_"
                customInput={Input}
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(12) 99999-9999"
                aria-invalid={Boolean(errors.whatsapp)}
                aria-describedby={errors.whatsapp ? "whatsapp-erro" : undefined}
                className={ESTILO_CAMPO}
              />
            )}
          />
        </Campo>
      </div>
    </div>
  )
}
