"use client"

import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { useLoja } from "@/lib/loja-atual"
import { textosDoSegmento } from "@/lib/segmentos"
import type { Produto } from "@/lib/tipos"
import { ProdutoDestaque } from "./produto-itens"

type MaisPedidasProps = {
  produtos: Produto[]
  aoAbrir: (produto: Produto) => void
}

/** Rolagem horizontal: setas e trackpad no computador, arrastar com o dedo no celular. */
export function MaisPedidas({ produtos, aoAbrir }: MaisPedidasProps) {
  const loja = useLoja()
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
    "rounded-full bg-background ring-1 ring-border hover:bg-muted disabled:opacity-35"

  return (
    <section aria-labelledby="mais-pedidas" data-testid="mais-pedidas">
      <div className="flex items-end justify-between gap-4 px-4 pb-4 md:px-6">
        <h2 id="mais-pedidas" className="text-lg font-semibold tracking-[-0.015em] md:text-xl">
          {textosDoSegmento(loja.segmento).destaques}
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
      </div>

      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: "trimSnaps", dragFree: true }}
        plugins={plugins}
        className="px-4 md:px-6"
      >
        <CarouselContent className="-ml-3 md:-ml-4">
          {produtos.map((produto) => (
            <CarouselItem
              key={produto.id}
              className="basis-[62%] pl-3 sm:basis-[40%] md:basis-[30%] md:pl-4 lg:basis-[24%]"
            >
              <ProdutoDestaque produto={produto} aoAbrir={() => aoAbrir(produto)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
}
