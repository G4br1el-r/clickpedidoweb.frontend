"use client"

import { CheckIcon, CopyIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { NumericFormat } from "react-number-format"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  useAlternarProduto,
  useCopiarProduto,
  useDefinirPreco,
  useExcluirProduto,
} from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import { percentualOferta } from "@/lib/admin/regras/cardapio"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { SeloLista, SeloTarja } from "../farmacia/selos"
import { Traco } from "../traco"

const TIPO_MEDICAMENTO = { referencia: "Referência", generico: "Genérico", similar: "Similar" }

/** Quanto tempo o "Salvo" fica ao lado do preço depois de gravar. */
const TEMPO_SALVO = 1800

/**
 * Preço editado na própria linha: Enter (ou sair do campo) salva, Esc desfaz.
 * Ao gravar, um "Salvo" aparece ao lado e some sozinho; o campo não muda de tamanho.
 */
function PrecoNaLinha({ produto }: { produto: Produto }) {
  const definirPreco = useDefinirPreco()
  const semMovimento = useReducedMotion()
  const [valor, setValor] = useState<number | undefined>(produto.preco)
  const [salvo, setSalvo] = useState(false)
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => setValor(produto.preco), [produto.preco])
  useEffect(() => () => clearTimeout(relogio.current), [])

  const salvar = () => {
    if (valor === undefined || valor === produto.preco) return setValor(produto.preco)
    definirPreco.mutate(
      { id: produto.id, preco: valor },
      {
        onSuccess: (gravado) => {
          toast.success(`${gravado.nome}: ${emReais(gravado.preco)}`)
          setSalvo(true)
          clearTimeout(relogio.current)
          relogio.current = setTimeout(() => setSalvo(false), TEMPO_SALVO)
        },
        onError: (erro) => {
          toast.error(erro.message)
          setValor(produto.preco)
        },
      },
    )
  }

  const alterado = valor !== produto.preco
  return (
    <div className="flex items-center gap-2">
      {/* O aviso existe sempre (vazio) para o leitor de tela anunciar quando muda. */}
      <span
        role="status"
        className="flex w-14 justify-end text-xs font-medium text-(--tom-pronto) @max-3xl:order-last @max-3xl:justify-start"
      >
        <AnimatePresence initial={false}>
          {salvo && (
            <motion.span
              key="salvo"
              className="inline-flex items-center gap-1"
              initial={semMovimento ? { opacity: 0 } : { opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              <CheckIcon className="size-3.5" aria-hidden="true" />
              Salvo
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <NumericFormat
        customInput={Input}
        aria-label="Preço"
        inputMode="decimal"
        prefix="R$ "
        decimalSeparator=","
        thousandSeparator="."
        decimalScale={2}
        fixedDecimalScale
        value={valor ?? ""}
        onValueChange={({ floatValue }) => setValor(floatValue)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") {
            evento.preventDefault()
            salvar()
          } else if (evento.key === "Escape") {
            setValor(produto.preco)
          }
        }}
        onBlur={salvar}
        className={cn(
          // Parece texto até a pessoa passar o mouse ou focar: a lista continua escaneável.
          "h-9 w-28 border-transparent bg-foreground/[0.035] text-right font-medium tabular-nums shadow-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-border md:h-8",
          "focus-visible:bg-background",
          alterado && "border-(--grafico) bg-background ring-1 ring-(--grafico)",
        )}
      />
    </div>
  )
}

function Foto({ produto }: { produto: Produto }) {
  if (!produto.imagem) {
    return (
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] text-sm font-semibold text-muted-foreground"
      >
        {produto.nome.charAt(0)}
      </span>
    )
  }
  return (
    <Image
      src={produto.imagem}
      alt=""
      width={40}
      height={40}
      unoptimized={produto.imagem.startsWith("data:")}
      className="size-10 shrink-0 rounded-md object-cover"
    />
  )
}

/** Chave com o rótulo ao lado; o rótulo inteiro é clicável (alvo grande no celular). */
function Chave({
  id,
  rotulo,
  ligada,
  aoMudar,
}: {
  id: string
  rotulo: string
  ligada: boolean
  aoMudar: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={ligada} onCheckedChange={aoMudar} />
      <Label
        htmlFor={id}
        className={cn(
          "min-h-11 cursor-pointer text-[13px] font-normal md:min-h-8",
          !ligada && "text-muted-foreground",
        )}
      >
        {rotulo}
      </Label>
    </div>
  )
}

/** Uma linha do cardápio: foto, nome e situação, preço na linha, chaves e ações. */
export function LinhaProduto({
  produto,
  mostrarBalcao,
  aoEditar,
}: {
  produto: Produto
  mostrarBalcao: boolean
  aoEditar: () => void
}) {
  const alternar = useAlternarProduto()
  const copiar = useCopiarProduto()
  const excluir = useExcluirProduto()
  const [confirmando, setConfirmando] = useState(false)
  const desconto = percentualOferta(produto)
  const opcoes = produto.grupos.length
  const detalhe =
    [
      opcoes > 0 ? plural(opcoes, "grupo de opções", "grupos de opções") : null,
      produto.descricao || null,
    ]
      .filter(Boolean)
      .join(" · ") || "Sem descrição"

  return (
    <li
      aria-label={produto.nome}
      className="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5 transition-colors duration-150 hover:bg-foreground/[0.02] @3xl:-mx-2 @3xl:flex-nowrap @3xl:px-2"
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 basis-full items-center gap-3 transition-opacity duration-200 @3xl:basis-auto",
          !produto.ativo && "opacity-55",
        )}
      >
        <Foto produto={produto} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="truncate text-sm font-medium">{produto.nome}</span>
            {produto.unidade === "kg" && (
              <span className="text-xs text-muted-foreground">por kg</span>
            )}
            {!produto.disponivel && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Traco tom="cancelado" />
                Esgotado
              </span>
            )}
            {!produto.ativo && <span className="text-xs text-muted-foreground">Oculto</span>}
            {produto.destaque && <span className="text-xs text-muted-foreground">Destaque</span>}
            {desconto !== null && (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                −{desconto}%
              </span>
            )}
          </div>
          {produto.medicamento && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <SeloTarja tarja={produto.medicamento.tarja} />
              <span className="text-xs text-muted-foreground">
                {TIPO_MEDICAMENTO[produto.medicamento.tipo]}
              </span>
              {produto.medicamento.lista && <SeloLista lista={produto.medicamento.lista} />}
            </div>
          )}
          <span className="line-clamp-1 text-xs text-muted-foreground">{detalhe}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 @max-3xl:items-start @max-3xl:pl-[52px]">
        <PrecoNaLinha produto={produto} />
        {mostrarBalcao && produto.precoBalcao ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            Balcão {emReais(produto.precoBalcao)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Chave
          id={`${produto.id}-disponivel`}
          rotulo="Disponível"
          ligada={produto.disponivel}
          aoMudar={() => alternar.mutate({ id: produto.id, campo: "disponivel" })}
        />
        <Chave
          id={`${produto.id}-ativo`}
          rotulo="Visível"
          ligada={produto.ativo}
          aoMudar={() => alternar.mutate({ id: produto.id, campo: "ativo" })}
        />
      </div>

      <div className="ml-auto flex items-center @3xl:ml-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="max-md:h-11 active:scale-[0.97]"
          onClick={aoEditar}
        >
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Mais ações"
              className="max-md:size-11"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() =>
                  copiar.mutate(produto.id, { onSuccess: () => toast.success("Cópia criada.") })
                }
              >
                <CopyIcon />
                Copiar
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmando(true)}>
                <Trash2Icon />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {produto.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai do cardápio. Os pedidos antigos continuam com o nome do item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                // A linha some na hora (otimista) e desmonta: o aviso vem da promessa,
                // porque os callbacks do mutate não rodam depois que o componente sai da tela.
                excluir
                  .mutateAsync(produto.id)
                  .then(() => toast.success("Produto excluído."))
                  .catch((erro: Error) => toast.error(erro.message))
              }
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
