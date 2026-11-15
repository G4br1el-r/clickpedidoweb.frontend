"use client"

import { colord } from "colord"
import { ImageUpIcon, Trash2Icon } from "lucide-react"
import Image from "next/image"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useConfig, useOpcaoPro } from "@/lib/admin/config"
import { textoSobre } from "@/lib/tema"
import { cn } from "@/lib/utils"
import { avisarSacola, SeloPro } from "./campos"
import { Traco } from "./traco"

/** Reduz a imagem antes de guardar: o navegador só aceita alguns megabytes salvos. */
async function reduzirImagem(arquivo: File, ladoMaximo: number): Promise<string> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const formato = arquivo.type === "image/png" ? "image/png" : "image/jpeg"
  return canvas.toDataURL(formato, 0.82)
}

type CampoImagemProps = {
  campo: "logo" | "banner" | "fundo"
  titulo: string
  descricao: string
  /** Imagem mostrada quando a loja ainda não enviou a sua. */
  atual?: string
  ladoMaximo: number
  formato: "quadrado" | "largo"
}

/** Envio de imagem: clicar ou soltar o arquivo, com miniatura e opção de remover. */
export function CampoImagem({
  campo,
  titulo,
  descricao,
  atual,
  ladoMaximo,
  formato,
}: CampoImagemProps) {
  const valor = useConfig((estado) => estado.config.identidade[campo])
  const atualizar = useConfig((estado) => estado.atualizar)
  const { ehPro, bloqueada, naSacola, liberada } = useOpcaoPro(`identidade.${campo}`)
  const entrada = useRef<HTMLInputElement>(null)
  const id = useId()
  const [arrastando, setArrastando] = useState(false)
  const imagem = valor ?? atual

  async function receber(arquivo: File | undefined) {
    if (!arquivo) return
    if (!arquivo.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem", { description: "JPG, PNG ou WebP." })
      return
    }
    try {
      atualizar("identidade", { [campo]: await reduzirImagem(arquivo, ladoMaximo) })
      if (bloqueada) avisarSacola(titulo)
      else toast.success(`${titulo} atualizado`)
    } catch {
      toast.error("Não deu para ler essa imagem", { description: "Tente outro arquivo." })
    }
  }

  return (
    <Field
      data-pro-liberada={liberada || undefined}
      className={cn(liberada && "opcao-pro -m-2 w-auto rounded-xl p-2")}
    >
      <FieldContent>
        <FieldTitle className="flex items-center gap-2">
          {titulo}
          {ehPro && <SeloPro liberada={liberada} naSacola={naSacola} />}
        </FieldTitle>
        <FieldDescription>{descricao}</FieldDescription>
      </FieldContent>
      <div className="flex items-center gap-4">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: área de soltar; o botão ao lado faz o mesmo pelo teclado. */}
        <div
          onDragOver={(evento) => {
            evento.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(evento) => {
            evento.preventDefault()
            setArrastando(false)
            void receber(evento.dataTransfer.files[0])
          }}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden bg-muted ring-1 ring-border transition-[box-shadow] duration-200",
            formato === "quadrado" ? "size-20 rounded-xl" : "h-20 w-36 rounded-xl",
            arrastando && "ring-2 ring-primary",
          )}
        >
          {imagem ? (
            <Image src={imagem} alt="" fill sizes="144px" unoptimized className="object-cover" />
          ) : (
            <ImageUpIcon className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => entrada.current?.click()}
          >
            <ImageUpIcon data-icon="inline-start" />
            {valor ? "Trocar" : "Enviar imagem"}
          </Button>
          {valor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => atualizar("identidade", { [campo]: null })}
            >
              <Trash2Icon data-icon="inline-start" />
              Remover
            </Button>
          )}
        </div>
        <input
          ref={entrada}
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Enviar ${titulo.toLowerCase()}`}
          onChange={(evento) => {
            void receber(evento.target.files?.[0])
            evento.target.value = ""
          }}
        />
      </div>
    </Field>
  )
}

/* ------------------------------------------------------------------ */

type CampoCorProps = {
  campo: "primaria" | "acento" | "fundo" | "tinta"
  titulo: string
  descricao: string
  /** Cor sobre a qual esta será lida, para avisar contraste baixo. */
  contrasteCom?: "fundo" | "texto-do-botao"
}

/** Cor com seletor nativo e campo hexadecimal; avisa quando o contraste fica baixo. */
export function CampoCor({ campo, titulo, descricao, contrasteCom }: CampoCorProps) {
  const cores = useConfig((estado) => estado.config.cores)
  const atualizar = useConfig((estado) => estado.atualizar)
  const valor = cores[campo]
  const [rascunho, setRascunho] = useState<string | null>(null)
  const id = useId()

  let contraste: number | null = null
  if (contrasteCom === "texto-do-botao") {
    contraste = colord(valor).contrast(textoSobre(valor, cores.tinta))
  } else if (contrasteCom === "fundo") {
    contraste = colord(valor).contrast(cores.fundo)
  }

  return (
    <Field orientation="responsive">
      <FieldContent>
        <FieldLabel htmlFor={id}>{titulo}</FieldLabel>
        <FieldDescription>{descricao}</FieldDescription>
      </FieldContent>
      <div className="flex shrink-0 items-center gap-3">
        {contraste !== null && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              contraste >= 4.5 ? "text-muted-foreground" : "text-foreground",
            )}
          >
            <Traco tom={contraste >= 4.5 ? "pronto" : "cancelado"} className="h-3" />
            {contraste >= 4.5 ? "Boa leitura" : "Pouco contraste"}
          </span>
        )}
        <InputGroup className="w-36">
          <InputGroupAddon>
            <label
              className="relative block size-6 overflow-hidden rounded-md ring-1 ring-border"
              style={{ background: valor }}
            >
              <span className="sr-only">Escolher {titulo.toLowerCase()} no seletor</span>
              <input
                type="color"
                value={valor}
                onChange={(evento) =>
                  atualizar("cores", { [campo]: evento.target.value, paleta: "personalizada" })
                }
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            value={rascunho ?? valor.toUpperCase()}
            maxLength={7}
            spellCheck={false}
            className="font-medium tabular-nums uppercase"
            onChange={(evento) => {
              const texto = evento.target.value
              setRascunho(texto)
              if (/^#[0-9a-f]{6}$/i.test(texto)) {
                atualizar("cores", { [campo]: texto.toLowerCase(), paleta: "personalizada" })
              }
            }}
            onBlur={() => setRascunho(null)}
          />
        </InputGroup>
      </div>
    </Field>
  )
}
