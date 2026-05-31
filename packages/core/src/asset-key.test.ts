import { describe, expect, it } from "vitest";
import { assetKey } from "./asset-key.js";

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
});
