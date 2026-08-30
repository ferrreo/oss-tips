export type PublicPostVisibility = 'full' | 'metadata' | 'hidden';

export function publicPostVisibility(
  gated: boolean,
  showGatedMetadata: boolean,
): PublicPostVisibility {
  if (!gated) return 'full';
  return showGatedMetadata ? 'metadata' : 'hidden';
}

export function publicPostBody(body: string, visibility: PublicPostVisibility): string {
  return visibility === 'full' ? body : '';
}
