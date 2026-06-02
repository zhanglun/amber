import { describe, expect, it } from "vitest";
import { assetKey, captureAssetPrefix } from "./asset-key.js";

describe("assetKey", () => {
  it("namespaces the key by capture id and asset index", () => {
    expect(assetKey("cap123", 0, "image/png")).toBe("captures/cap123/0.png");
  });

  it("falls back to bin when contentType is unknown", () => {
    expect(assetKey("cap123", 2, undefined)).toBe("captures/cap123/2.bin");
  });

  it("maps jpeg content type to jpg", () => {
    expect(assetKey("cap123", 1, "image/jpeg")).toBe("captures/cap123/1.jpg");
  });

  it("maps video/mp4 to mp4", () => {
    expect(assetKey("cap", 0, "video/mp4")).toBe("captures/cap/0.mp4");
  });

  it("maps video/webm to webm", () => {
    expect(assetKey("cap", 0, "video/webm")).toBe("captures/cap/0.webm");
  });

  it("maps video/quicktime to mov", () => {
    expect(assetKey("cap", 0, "video/quicktime")).toBe("captures/cap/0.mov");
  });
});

describe("captureAssetPrefix", () => {
  it("returns the captures/<id> prefix used for blob directory cleanup", () => {
    expect(captureAssetPrefix("cap123")).toBe("captures/cap123");
  });
});
