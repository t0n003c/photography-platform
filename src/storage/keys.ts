// Opaque, sharded storage keys (MEDIA-ARCHITECTURE.md; SECURITY.md §7.4).
// ULID photo ids are non-sequential, so keys are not guessable; they are still
// only served through authorized app routes, never a public path.

function shard(id: string): [string, string] {
  const s = id.toLowerCase();
  return [s.slice(0, 2) || "00", s.slice(2, 4) || "00"];
}

export function originalKey(photoId: string, ext: string): string {
  const [a, b] = shard(photoId);
  return `originals/${a}/${b}/${photoId}.${ext}`;
}

export function variantKey(
  photoId: string,
  bucket: string,
  format: string,
): string {
  const [a, b] = shard(photoId);
  return `variants/${a}/${b}/${photoId}/${bucket}.${format}`;
}

export function stagingChunkKey(uploadId: string, index: number): string {
  return `staging/${uploadId}/${index}`;
}
