const ADMIN_ILLUSTRATION_BASE = "/illustrations/admin/xiaohei";
const ADMIN_ILLUSTRATION_SIZE = {
  width: 1672,
  height: 941,
} as const;

function adminIllustration(file: string, alt: string) {
  return {
    webp: `${ADMIN_ILLUSTRATION_BASE}/${file}.webp`,
    png: `${ADMIN_ILLUSTRATION_BASE}/${file}.png`,
    darkWebp: `${ADMIN_ILLUSTRATION_BASE}/${file}-dark.webp`,
    darkPng: `${ADMIN_ILLUSTRATION_BASE}/${file}-dark.png`,
    alt,
    ...ADMIN_ILLUSTRATION_SIZE,
  };
}

export const ADMIN_ILLUSTRATIONS = {
  "empty-galleries": adminIllustration(
    "01-empty-galleries",
    "Xiaohei carries a blank frame toward empty gallery frames waiting to be filled.",
  ),
  "layout-builder": adminIllustration(
    "02-layout-builder",
    "Xiaohei arranges photo cards into a hand-drawn layout frame.",
  ),
  "demo-pages": adminIllustration(
    "03-demo-pages",
    "Xiaohei pulls a wagon of placeholder photo cards toward demo, ready, and publish boards.",
  ),
  "contact-inbox": adminIllustration(
    "04-contact-inbox",
    "Xiaohei waits beside an open mailbox as a paper airplane client message approaches.",
  ),
  "security-spam": adminIllustration(
    "05-security-spam",
    "Xiaohei cranks a sieve that catches spam envelopes while a clean message passes through.",
  ),
  "categories-locations": adminIllustration(
    "06-categories-locations",
    "Xiaohei sorts messy photo cards into category and place drawers.",
  ),
  "lightbox-preload": adminIllustration(
    "07-lightbox-preload",
    "Xiaohei stages previous and next photo cards beside a central lightbox frame.",
  ),
  "upload-queue": adminIllustration(
    "08-upload-queue",
    "Xiaohei turns a crank on a conveyor that processes uploaded photo cards.",
  ),
  "publish-page": adminIllustration(
    "09-publish-page",
    "Xiaohei pushes a draft page through a gate so it becomes live.",
  ),
  referrals: adminIllustration(
    "10-referrals",
    "Xiaohei checks a clipboard while search, social, and direct paths lead into a gallery door.",
  ),
  "admin-setup-path": adminIllustration(
    "11-admin-setup-path",
    "Xiaohei untangles an orange thread connecting gallery, design, and page setup stations.",
  ),
} as const;

export type AdminIllustrationKey = keyof typeof ADMIN_ILLUSTRATIONS;
