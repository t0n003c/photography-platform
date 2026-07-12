import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_DESIGN,
  normalizeLoginDesign,
  resolveLoginCardMaterial,
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
        backgroundMode: "photo",
        backgroundColor: "#111111",
        gradientFrom: "#ff0000",
        gradientTo: "#0000ff",
        backgroundPhotoId: "photo-bg",
        backgroundPhotoUrl: "https://example.com/background.jpg",
        backgroundPhotoFocalX: 45,
        backgroundPhotoFocalY: 64,
        backgroundPhotoDim: 55,
        backgroundPhotoBlur: 10,
        cardAccent: "#00ff00",
        hoverColor: "#ffaa00",
        hoverGlowSize: 60,
        hoverGlowIntensity: 42,
        cardMaterial: "liquid-glass",
        liquidGlassStrength: 130,
        liquidGlassChroma: 8,
        liquidGlassBlur: 4,
        liquidGlassSaturate: 1.65,
        liquidGlassFallbackBlur: 20,
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
      backgroundMode: "photo",
      gradientFrom: "#ff0000",
      backgroundPhotoId: "photo-bg",
      backgroundPhotoUrl: "https://example.com/background.jpg",
      backgroundPhotoFocalX: 45,
      backgroundPhotoFocalY: 64,
      backgroundPhotoDim: 55,
      backgroundPhotoBlur: 10,
      hoverColor: "#ffaa00",
      hoverGlowSize: 60,
      hoverGlowIntensity: 42,
      cardMaterial: "liquid-glass",
      liquidGlassStrength: 130,
      liquidGlassChroma: 8,
      liquidGlassBlur: 4,
      liquidGlassSaturate: 1.65,
      liquidGlassFallbackBlur: 20,
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
        liquidGlassStrength: 999,
        liquidGlassChroma: -2,
        liquidGlassBlur: 40,
        liquidGlassSaturate: 9,
        liquidGlassFallbackBlur: 3,
        backgroundPhotoFocalX: -20,
        backgroundPhotoFocalY: 150,
        backgroundPhotoDim: 120,
        backgroundPhotoBlur: 80,
        photoFocalX: -50,
        photoFocalY: 180,
        photoWidth: 12,
      }),
    ).toMatchObject({
      hoverGlowSize: 70,
      hoverGlowIntensity: 0,
      liquidGlassStrength: 180,
      liquidGlassChroma: 0,
      liquidGlassBlur: 12,
      liquidGlassSaturate: 2.2,
      liquidGlassFallbackBlur: 8,
      backgroundPhotoFocalX: 0,
      backgroundPhotoFocalY: 100,
      backgroundPhotoDim: 85,
      backgroundPhotoBlur: 24,
      photoFocalX: 0,
      photoFocalY: 100,
      photoWidth: 35,
    });
  });

  it("resolves layout-default material without changing old configs", () => {
    expect(
      resolveLoginCardMaterial({
        layout: "simple",
        cardMaterial: "layout-default",
      }),
    ).toBe("solid");
    expect(
      resolveLoginCardMaterial({
        layout: "gradient-card",
        cardMaterial: "layout-default",
      }),
    ).toBe("soft-glass");
    expect(
      resolveLoginCardMaterial({
        layout: "split-photo",
        cardMaterial: "liquid-glass",
      }),
    ).toBe("liquid-glass");
  });
});
