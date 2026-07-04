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
        layout: "split-photo",
        headline: "Studio access",
        subtitle: "Welcome back",
        showBrand: false,
        showIconRow: true,
        backgroundMode: "soft-gradient",
        backgroundColor: "#111111",
        gradientFrom: "#ff0000",
        gradientTo: "#0000ff",
        cardAccent: "#00ff00",
        hoverColor: "#ffaa00",
        hoverGlowSize: 60,
        hoverGlowIntensity: 42,
        primaryLabel: "Enter",
        passkeyLabel: "Use passkey",
        photoId: "photo-login",
        photoUrl: "https://example.com/login.jpg",
        photoAlt: "Portrait session",
        photoSide: "right",
        photoFocalX: 35,
        photoFocalY: 72,
        photoWidth: 58,
        showPhotoOnMobile: false,
      }),
    ).toMatchObject({
      layout: "split-photo",
      headline: "Studio access",
      showBrand: false,
      showIconRow: true,
      backgroundMode: "soft-gradient",
      gradientFrom: "#ff0000",
      hoverColor: "#ffaa00",
      hoverGlowSize: 60,
      hoverGlowIntensity: 42,
      passkeyLabel: "Use passkey",
      photoId: "photo-login",
      photoUrl: "https://example.com/login.jpg",
      photoSide: "right",
      photoFocalX: 35,
      photoFocalY: 72,
      photoWidth: 58,
      showPhotoOnMobile: false,
    });

    expect(
      normalizeLoginDesign({
        layout: "fake",
        backgroundMode: "noise",
      }).layout,
    ).toBe(DEFAULT_LOGIN_DESIGN.layout);
  });

  it("clamps numeric polish controls", () => {
    expect(
      normalizeLoginDesign({
        hoverGlowSize: 200,
        hoverGlowIntensity: -20,
        photoFocalX: -50,
        photoFocalY: 180,
        photoWidth: 12,
      }),
    ).toMatchObject({
      hoverGlowSize: 70,
      hoverGlowIntensity: 0,
      photoFocalX: 0,
      photoFocalY: 100,
      photoWidth: 35,
    });
  });
});
