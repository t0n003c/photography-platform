import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_DESIGN,
  normalizeLoginDesign,
} from "@/src/lib/login-design";

describe("login design config", () => {
  it("defaults missing values", () => {
    expect(normalizeLoginDesign(null)).toEqual(DEFAULT_LOGIN_DESIGN);
  });

  it("keeps supported visual settings and rejects invalid enums", () => {
    expect(
      normalizeLoginDesign({
        layout: "gradient-card",
        headline: "Studio access",
        subtitle: "Welcome back",
        showBrand: false,
        showIconRow: true,
        backgroundMode: "soft-gradient",
        backgroundColor: "#111111",
        gradientFrom: "#ff0000",
        gradientTo: "#0000ff",
        cardAccent: "#00ff00",
        primaryLabel: "Enter",
        passkeyLabel: "Use passkey",
      }),
    ).toMatchObject({
      layout: "gradient-card",
      headline: "Studio access",
      showBrand: false,
      showIconRow: true,
      backgroundMode: "soft-gradient",
      gradientFrom: "#ff0000",
      passkeyLabel: "Use passkey",
    });

    expect(
      normalizeLoginDesign({
        layout: "fake",
        backgroundMode: "noise",
      }).layout,
    ).toBe(DEFAULT_LOGIN_DESIGN.layout);
  });
});
