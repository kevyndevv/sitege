"use client";

/**
 * Reduz a foto no próprio aparelho antes de enviar:
 *  - lado maior até 1600 px (fotos de celular costumam ter 4000+ px);
 *  - formato WebP (ou JPEG, se o navegador não suportar);
 *  - remove metadados da câmera (como a localização GPS) ao redesenhar a imagem.
 * Resultado típico: 150–500 KB, rápido de carregar no site.
 */
const DEFAULT_MAX_SIDE = 1600;
// Abaixo do limite de 1 MB por envio das Server Actions do Next.js.
const TARGET_BYTES = 450 * 1024;

export async function compressImage(file: File, maxSide: number = DEFAULT_MAX_SIDE): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("unsupported");
  }

  let side = maxSide;
  let quality = 0.82;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("unsupported");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("unsupported");

    if (blob.size <= TARGET_BYTES || attempt === 5) {
      bitmap.close();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `foto.${ext}`, { type: blob.type });
    }
    quality = Math.max(0.5, quality - 0.1);
    side = Math.round(side * 0.85);
  }
  throw new Error("unsupported");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
