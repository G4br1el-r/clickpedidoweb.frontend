"use client"

import { CopyIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
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

const TIPO_MEDICAMENTO = { referencia: "Referência", generico: "Genérico", similar: "Similar" }

/** Preço editado na própria linha: Enter (ou sair do campo) salva, Esc desfaz. */
function PrecoNaLinha({ produto }: { produto: Produto }) {
  const definirPreco = useDefinirPreco()
  const [valor, setValor] = useState<number | undefined>(produto.preco)
  useEffect(() => setValor(produto.preco), [produto.preco])

  const salvar = () => {
    if (valor === undefined || valor === produto.preco) return setValor(produto.preco)
    definirPreco.mutate(
      { id: produto.id, preco: valor },
      {
        onSuccess: (salvo) => toast.success(`${salvo.nome}: ${emReais(salvo.preco)}`),
        onError: (erro) => {
          toast.error(erro.message)
          setValor(produto.preco)
        },
      },
    )
  }

  return (
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
        "h-8 w-28 text-right tabular-nums",
        valor !== produto.preco && "border-[var(--grafico)] ring-1 ring-[var(--grafico)]",
      )}
    />
  )
}

function Foto({ produto }: { produto: Produto }) {
  if (!produto.imagem) {
    return (
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground"
      >
        {produto.nome.charAt(0)}
      </span>
    )
  }
  return (
    <Image
      src={produto.imagem}
      alt=""
      width={48}
      height={48}
      unoptimized={produto.imagem.startsWith("data:")}
      className="size-12 shrink-0 rounded-lg object-cover"
    />
  )
}

/** Uma linha do cardápio: foto, nome e selos, preço na linha, chaves e ações. */
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

  return (
    <li
      aria-label={produto.nome}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap",
        !produto.ativo && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
        <Foto produto={produto} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{produto.nome}</span>
            {produto.unidade === "kg" && <Badge variant="outline">/kg</Badge>}
            {!produto.disponivel && <Badge variant="destructive">Esgotado</Badge>}
            {!produto.ativo && <Badge variant="outline">Oculto</Badge>}
            {produto.destaque && <Badge variant="secondary">Destaque</Badge>}
            {desconto !== null && <Badge variant="secondary">−{desconto}%</Badge>}
          </div>
          {produto.medicamento && (
            <div className="flex flex-wrap items-center gap-1.5">
              <SeloTarja tarja={produto.medicamento.tarja} />
              <Badge variant="outline">{TIPO_MEDICAMENTO[produto.medicamento.tipo]}</Badge>
              {produto.medicamento.lista && <SeloLista lista={produto.medicamento.lista} />}
            </div>
          )}
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {[
              opcoes > 0 ? plural(opcoes, "grupo de opções", "grupos de opções") : null,
              produto.descricao || null,
            ]
              .filter(Boolean)
              .join(" · ") || "Sem descrição"}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <PrecoNaLinha produto={produto} />
        {mostrarBalcao && produto.precoBalcao ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            Balcão: {emReais(produto.precoBalcao)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Switch
            id={`${produto.id}-disponivel`}
            checked={produto.disponivel}
            onCheckedChange={() => alternar.mutate({ id: produto.id, campo: "disponivel" })}
          />
          <Label
            htmlFor={`${produto.id}-disponivel`}
            className="cursor-pointer text-xs font-normal"
          >
            Disponível
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id={`${produto.id}-ativo`}
            checked={produto.ativo}
            onCheckedChange={() => alternar.mutate({ id: produto.id, campo: "ativo" })}
          />
          <Label htmlFor={`${produto.id}-ativo`} className="cursor-pointer text-xs font-normal">
            Visível
          </Label>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <Button type="button" variant="ghost" size="sm" onClick={aoEditar}>
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mais ações">
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
