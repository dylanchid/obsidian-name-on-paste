import type { ClipboardImage } from "./types";

const MIME_PRIORITY = ["image/png", "image/webp", "image/jpeg", "image/gif"];
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};
const IMAGE_FILE_EXTENSIONS = new Set(["png", "webp", "jpg", "jpeg", "gif"]);

function sortImageTypes(types: readonly string[]): string[] {
  return [...types]
    .filter((type) => type.startsWith("image/"))
    .sort((left, right) => {
      const leftIndex = MIME_PRIORITY.indexOf(left);
      const rightIndex = MIME_PRIORITY.indexOf(right);
      return (leftIndex < 0 ? MIME_PRIORITY.length : leftIndex) -
        (rightIndex < 0 ? MIME_PRIORITY.length : rightIndex);
    });
}

export function findImageBlob(event: ClipboardEvent): Blob | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  const candidates = Array.from(items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .sort((left, right) => {
      const leftIndex = MIME_PRIORITY.indexOf(left.type);
      const rightIndex = MIME_PRIORITY.indexOf(right.type);
      return (leftIndex < 0 ? MIME_PRIORITY.length : leftIndex) -
        (rightIndex < 0 ? MIME_PRIORITY.length : rightIndex);
    });

  return candidates[0]?.getAsFile() ?? null;
}

export function hasDroppedImage(event: DragEvent): boolean {
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  if (Array.from(transfer.items).some((item) => item.kind === "file" && item.type.startsWith("image/"))) {
    return true;
  }
  return Array.from(transfer.files).some(isSupportedImageFile);
}

export function findDroppedImage(event: DragEvent): File | null {
  const transfer = event.dataTransfer;
  if (!transfer) return null;

  const file = Array.from(transfer.files).find(isSupportedImageFile);
  if (file) return file;

  return Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find((item): item is File => Boolean(item && isSupportedImageFile(item))) ?? null;
}

export function isSupportedImageFile(file: Pick<File, "name" | "type">): boolean {
  if (file.type.startsWith("image/")) return Boolean(EXTENSIONS[file.type]);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return !file.type && IMAGE_FILE_EXTENSIONS.has(extension);
}

export async function readClipboardImage(): Promise<ClipboardImage | null> {
  if (!navigator.clipboard?.read) {
    throw new Error("This system does not provide image clipboard access.");
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = sortImageTypes(item.types)[0];
    if (!type) continue;
    return clipboardImageFromBlob(await item.getType(type));
  }
  return null;
}

export async function clipboardImageFromBlob(blob: Blob): Promise<ClipboardImage> {
  const supportedExtension = EXTENSIONS[blob.type];
  const normalizedBlob = supportedExtension ? blob : await convertToPng(blob);
  const dimensions = await readDimensions(normalizedBlob);
  return {
    bytes: await normalizedBlob.arrayBuffer(),
    mimeType: normalizedBlob.type,
    extension: EXTENSIONS[normalizedBlob.type] ?? "png",
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function convertToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this clipboard image.");
    context.drawImage(bitmap, 0, 0);
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!result) throw new Error("Could not convert this clipboard image to PNG.");
    return result;
  } finally {
    bitmap.close();
  }
}
