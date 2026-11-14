import { z } from "zod"

/**
 * YouTube (vídeo, youtu.be e Shorts) e Reels do Instagram: o que as lojas aceitavam.
 * Depois do id, só o fim, ou `?`, `&`, `/` e `#` seguidos de parâmetros sem espaço,
 * aspas ou sinais de tag.
 */
const LINK_DE_VIDEO =
  /^https:\/\/((www\.|m\.)?youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|(www\.)?instagram\.com\/reels?\/)[\w-]+([?&/#][^\s"'<>`\\]*)?$/

/** Link de vídeo opcional: vazio é sem vídeo. */
export const esquemaLinkDeVideo = z
  .string()
  .trim()
  .refine((link) => link === "" || LINK_DE_VIDEO.test(link), {
    error: "Use um link do YouTube, Shorts ou Reels.",
  })
