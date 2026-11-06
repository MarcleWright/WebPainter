/** UI containment points. Standalone defaults do not depend on the embedded entry. */
let surface: { portals: HTMLElement; keys: HTMLElement } | null = null;
export function portalTarget(): HTMLElement { return surface?.portals ?? document.body; }
export function keyboardTarget(): HTMLElement | Window { return surface?.keys ?? window; }
export function installSurface(value: NonNullable<typeof surface>): () => void {
  if (surface) throw new Error('Only one UI surface may be active');
  surface = value;
  return () => { if (surface === value) surface = null; };
}
