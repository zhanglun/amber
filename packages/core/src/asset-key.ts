const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
};

export function assetKey(
  captureId: string,
  index: number,
  contentType?: string,
): string {
  const ext = (contentType && EXT_BY_TYPE[contentType]) || "bin";
  return `captures/${captureId}/${index}.${ext}`;
}

export function captureAssetPrefix(captureId: string): string {
  return `captures/${captureId}`;
}
