import { describe, it, expect } from "vitest";
import { contactNotification, galleryInvite } from "@/src/email/templates";

describe("contactNotification", () => {
  it("includes name and message, sets replyTo and subject", () => {
    const msg = contactNotification({
      to: "admin@example.com",
      name: "Jane Doe",
      email: "jane@sender.com",
      subject: "Wedding inquiry",
      message: "Are you available in June?",
    });
    expect(msg.html).toContain("Jane Doe");
    expect(msg.html).toContain("Are you available in June?");
    expect(msg.replyTo).toBe("jane@sender.com");
    expect(msg.subject).toContain("Wedding inquiry");
  });

  it("escapes HTML in the name (raw <script> does not appear)", () => {
    const msg = contactNotification({
      to: "admin@example.com",
      name: "<script>alert(1)</script>",
      email: "x@y.com",
      message: "hi",
    });
    expect(msg.html).not.toContain("<script>");
  });
});

describe("galleryInvite", () => {
  it("includes the shareUrl and gallery title", () => {
    const msg = galleryInvite({
      to: "client@example.com",
      clientName: "Sam",
      galleryTitle: "Summer Shoot",
      shareUrl: "https://example.com/g/abc123",
    });
    expect(msg.html).toContain("Summer Shoot");
    expect(msg.html).toContain("https://example.com/g/abc123");
  });

  it("escapes HTML in the client name (raw <script> does not appear)", () => {
    const msg = galleryInvite({
      to: "client@example.com",
      clientName: "<script>alert(1)</script>",
      galleryTitle: "Gallery",
      shareUrl: "https://example.com/g/abc123",
    });
    expect(msg.html).not.toContain("<script>");
  });
});
