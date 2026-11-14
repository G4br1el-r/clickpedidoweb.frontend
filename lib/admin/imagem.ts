import reduzir from "browser-image-compression"

const LIMITE_BYTES = 10 * 1024 * 1024

/**
 * Prepara a foto do produto para guardar: até 800 px no maior lado, em WebP e por volta
 * de 300 KB. Tudo no navegador, num worker, sem travar a tela.
 */
export async function prepararFoto(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha uma imagem (JPG, PNG ou WebP).")
  if (arquivo.size > LIMITE_BYTES) throw new Error("A imagem passa de 10 MB.")
  const reduzida = await reduzir(arquivo, {
    maxWidthOrHeight: 800,
    maxSizeMB: 0.3,
    fileType: "image/webp",
    useWebWorker: true,
  })
  return reduzir.getDataUrlFromFile(reduzida)
}
