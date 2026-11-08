"use client"

import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Dica } from "@/components/dica"
import { Entrada } from "@/components/entrada"
import { Button } from "@/components/ui/button"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import type { Produto } from "@/lib/tipos"
import { ProdutoDestaque } from "./produto-itens"

type MaisPedidasProps = {
  produtos: Produto[]
  aoAbrir: (produto: Produto) => void
}

/** Rolagem horizontal: setas e trackpad no computador, arrastar com o dedo no celular. */
export function MaisPedidas({ produtos, aoAbrir }: MaisPedidasProps) {
  const [api, setApi] = useState<CarouselApi>()
  // Arrastar com dois dedos no trackpad do notebook também passa os produtos.
  const [plugins] = useState(() => [WheelGesturesPlugin()])
  const [podeVoltar, setPodeVoltar] = useState(false)
  const [podeAvancar, setPodeAvancar] = useState(false)

  useEffect(() => {
    if (!api) return
    const atualizar = () => {
      setPodeVoltar(api.canScrollPrev())
      setPodeAvancar(api.canScrollNext())
    }
    atualizar()
    api.on("select", atualizar)
    api.on("reInit", atualizar)
    return () => {
      api.off("select", atualizar)
      api.off("reInit", atualizar)
    }
  }, [api])

  const estiloSeta =
    "rounded-full bg-card shadow-sm ring-1 ring-border hover:bg-accent disabled:opacity-35"

  return (
    <section aria-labelledby="mais-pedidas" data-testid="mais-pedidas">
      <Entrada
        atraso={0}
        desfoque
        className="flex items-end justify-between gap-4 px-4 pb-3 md:px-6"
      >
        <h2 id="mais-pedidas" className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Mais pedidas
        </h2>
        <div className="hidden gap-2 md:flex">
          <Dica texto="Anteriores">
            <Button
              type="button"
              variant="secondary"
              size="toque"
              className={estiloSeta}
              aria-label="Ver anteriores"
              disabled={!podeVoltar}
              onClick={() => api?.scrollPrev()}
            >
              <ChevronLeftIcon />
            </Button>
          </Dica>
          <Dica texto="Próximas">
            <Button
              type="button"
              variant="secondary"
              size="toque"
              className={estiloSeta}
              aria-label="Ver próximas"
              disabled={!podeAvancar}
              onClick={() => api?.scrollNext()}
            >
              <ChevronRightIcon />
            </Button>
          </Dica>
        </div>
      </Entrada>

      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: "trimSnaps", dragFree: true }}
        plugins={plugins}
        className="px-4 md:px-6"
      >
        <CarouselContent className="-ml-3 md:-ml-4">
          {produtos.map((produto, indice) => (
            <CarouselItem
              key={produto.id}
              className="basis-[74%] pl-3 sm:basis-[46%] md:basis-[38%] md:pl-4 lg:basis-[31%] xl:basis-[24%] 2xl:basis-[19.5%]"
            >
              <Entrada de="direita" atraso={0.06 + Math.min(indice, 5) * 0.07} duracao={0.8}>
                <ProdutoDestaque produto={produto} aoAbrir={() => aoAbrir(produto)} />
              </Entrada>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
}
