export const MAX_IMAGE_BYTES = 2000 * 1024

function fail(msg: string): never {
  throw new Error(msg)
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression impossible."))), "image/jpeg", quality),
  )
}

/** Verifie, redimensionne (1600 px max) et compresse une image avant envoi. */
export async function prepareImage(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) fail("Le fichier choisi n'est pas une image.")

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    if (file.size > MAX_IMAGE_BYTES) fail("Cette image dépasse 2 Mo. Choisis un fichier plus léger.")
    return file
  }

  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return fail("Image illisible. Essaie un autre fichier (JPEG, PNG ou WebP).")
  }

  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size <= 800 * 1024) {
    bmp.close()
    return file
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) { bmp.close(); return fail("Compression impossible dans ce navigateur.") }
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()

  let blob = await toBlob(canvas, 0.85)
  for (const q of [0.7, 0.55]) {
    if (blob.size <= MAX_IMAGE_BYTES) break
    blob = await toBlob(canvas, q)
  }
  if (blob.size > MAX_IMAGE_BYTES) fail("Cette image reste trop lourde (plus de 2 Mo) même compressée.")
  if (file.size <= MAX_IMAGE_BYTES && blob.size >= file.size) return file

  const base = file.name.replace(/\.[^.]+$/, "") || "image"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
}