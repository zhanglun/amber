import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "./image-optimize.js";

/** 用 sharp 生成一张真实的小 png（1x1 红点）用于测试。 */
async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

/** 生成一张真实的小 gif（用 sharp 从 png 转换，确保字节合法）。 */
async function makeGif(): Promise<Uint8Array> {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .png()
    .toBuffer();
  const gif = await sharp(png).gif().toBuffer();
  return new Uint8Array(gif);
}

describe("optimizeImage", () => {
  it("converts a png to webp", async () => {
    const png = await makePng();
    const result = await optimizeImage(png, "image/png");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/webp");
    // webp 魔数：RIFF....WEBP
    const magic = Buffer.from(result!.data.slice(0, 12)).toString("ascii");
    expect(magic.startsWith("RIFF")).toBe(true);
    expect(magic.includes("WEBP")).toBe(true);
  });

  it("converts a jpeg to webp", async () => {
    const png = await makePng();
    const jpegBuf = await sharp(png).jpeg().toBuffer();
    const result = await optimizeImage(new Uint8Array(jpegBuf), "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/webp");
  });

  it("converts a gif (keeping animation potential)", async () => {
    const gif = await makeGif();
    const result = await optimizeImage(gif, "image/gif");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/webp");
  });

  it("returns null for already-webp (idempotent skip)", async () => {
    const png = await makePng();
    const webpBuf = await sharp(png).webp().toBuffer();
    const result = await optimizeImage(new Uint8Array(webpBuf), "image/webp");
    expect(result).toBeNull();
  });

  it("returns null for svg (vector, do not rasterize)", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const result = await optimizeImage(svg, "image/svg+xml");
    expect(result).toBeNull();
  });

  it("returns null for video content types", async () => {
    expect(await optimizeImage(new Uint8Array(0), "video/mp4")).toBeNull();
    expect(await optimizeImage(new Uint8Array(0), "video/webm")).toBeNull();
  });

  it("returns null for undefined/unknown content type", async () => {
    expect(await optimizeImage(new Uint8Array(0))).toBeNull();
    expect(await optimizeImage(new Uint8Array(0), "application/octet-stream")).toBeNull();
  });

  it("returns null (degrades gracefully) for corrupt image data", async () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = await optimizeImage(garbage, "image/png");
    // 损坏数据：降级返回 null，而不是抛错。
    expect(result).toBeNull();
  });

  it("webp output is smaller than png for a solid-color image", async () => {
    const png = await makePng();
    const webp = await optimizeImage(png, "image/png");
    expect(webp!.data.length).toBeLessThan(png.length);
  });
});
