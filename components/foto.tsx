import Image, { type StaticImageData } from "next/image"
import { cn } from "@/lib/utils"

type FotoProps = {
  src: StaticImageData
  alt: string
  sizes: string
  className?: string
  preload?: boolean
}

/** Foto com carregamento progressivo: mostra uma versão desfocada até a final chegar. */
export function Foto({ src, alt, sizes, className, preload = false }: FotoProps) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        placeholder="blur"
        preload={preload}
        className="object-cover"
      />
    </div>
  )
}
