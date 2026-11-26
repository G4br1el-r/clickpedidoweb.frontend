"use client"

import * as React from "react"
import { cn } from "cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const [recipiente, ref] = React.useState<HTMLDivElement | null>(null)
  const [rola, setRola] = React.useState(false)

  // Tabela mais larga que a tela rola de lado; quem usa o teclado só alcança o que rola se o
  // recipiente for focável. Só nesse caso ele vira um grupo com o nome da tabela (não uma região: a seção que envolve a tabela já tem o mesmo nome).
  React.useEffect(() => {
    if (!recipiente) return
    const medir = () => setRola(recipiente.scrollWidth > recipiente.clientWidth)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(recipiente)
    return () => observador.disconnect()
  }, [recipiente])

  return (
    <div
      ref={ref}
      data-slot="table-container"
      className="relative w-full overflow-x-auto focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      {...(rola
        ? {
            tabIndex: 0,
            role: "group",
            "aria-label": props["aria-label"]
              ? `${props["aria-label"]}, rolagem lateral`
              : undefined,
          }
        : {})}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/70 transition-colors duration-150 hover:bg-foreground/[0.025] has-aria-expanded:bg-foreground/[0.04] data-[state=selected]:bg-foreground/[0.05]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle text-[13px] font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
