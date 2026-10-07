import "server-only";

/** Tamanho máximo aceito no servidor (o navegador já reduz a foto antes de enviar). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Upload = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/**
 * Valida a foto enviada pelo painel:
 *  - só JPEG, PNG ou WebP, identificados pelos BYTES do arquivo (não pelo nome
 *    nem pelo tipo informado pelo navegador, que podem ser falsificados);
 *  - até 5 MB;
 *  - o nome do arquivo é gerado pelo servidor (o nome original é descartado).
 * O bucket do Storage repete essas restrições (tipo e tamanho).
 */
export async function readImageUpload(value: FormDataEntryValue | null): Promise<{ file?: Upload; error?: string }> {
  if (!value || typeof value === "string" || value.size === 0) return {};
  if (value.size > MAX_IMAGE_BYTES) return { error: "A foto é grande demais (máximo 5 MB)." };

  const bytes = new Uint8Array(await value.arrayBuffer());
  const kind = detect(bytes);
  if (!kind) return { error: "Formato não aceito. Envie uma foto JPG, PNG ou WebP." };
  return { file: { bytes, ...kind } };
}

function detect(b: Uint8Array): Omit<Upload, "bytes"> | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length > 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
