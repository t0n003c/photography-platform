import { z } from "zod";

// Shared Zod schemas (client + server + worker). Expanded in Phase 2/3.
export const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  // Honeypot field — must be empty (anti-spam). Real spam scoring in Phase 3.
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;
