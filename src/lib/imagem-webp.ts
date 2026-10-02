/** Maior lado da foto depois da conversão; suficiente para cards e telas retina. */
const LADO_MAXIMO = 1200;
const QUALIDADE = 0.82;
/** Limite do arquivo original, antes da compressão. */
export const TAMANHO_MAXIMO_ORIGINAL = 15 * 1024 * 1024;

/** Usa o código de regra de negócio para `mensagemDeErro` exibir o texto como está. */
export class ErroImagem extends Error {
  readonly code = "P0001";
}

async function decodificar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(arquivo);
    try {
      const imagem = new Image();
      imagem.src = url;
      await imagem.decode();
      return imagem;
    } catch {
      throw new ErroImagem("Não foi possível ler esta imagem. Use JPG, PNG ou WebP.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const paraBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/webp", QUALIDADE));

/**
 * Redimensiona e converte qualquer foto para WebP no navegador.
 * O Safari não codifica WebP pelo canvas (devolve PNG em silêncio), então
 * nesse caso o encoder libwebp em WASM é carregado sob demanda.
 */
export async function converterParaWebp(
  arquivo: File,
  { ladoMaximo = LADO_MAXIMO }: { ladoMaximo?: number } = {},
): Promise<File> {
  if (!arquivo.type.startsWith("image/")) {
    throw new ErroImagem("Selecione um arquivo de imagem.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
    throw new ErroImagem("A imagem é muito grande. Use uma foto de até 15 MB.");
  }

  const origem = await decodificar(arquivo);
  const largura = "naturalWidth" in origem ? origem.naturalWidth : origem.width;
  const altura = "naturalHeight" in origem ? origem.naturalHeight : origem.height;
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new ErroImagem("Não foi possível processar a imagem.");
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(origem, 0, 0, canvas.width, canvas.height);
  if ("close" in origem) origem.close();

  let blob = await paraBlob(canvas);
  if (!blob || blob.type !== "image/webp") {
    const { encode } = await import("@jsquash/webp");
    const pixels = contexto.getImageData(0, 0, canvas.width, canvas.height);
    const buffer = await encode(pixels, { quality: QUALIDADE * 100 });
    blob = new Blob([buffer], { type: "image/webp" });
  }

  const nome = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${nome}.webp`, { type: "image/webp" });
}
