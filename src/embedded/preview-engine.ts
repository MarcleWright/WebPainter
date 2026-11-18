type BrowserBrand = { brand: string; version: string };

const windowsAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ';
const chrome157 = /^Chrome\/157(?:\.\d+){3} Safari\/537\.36$/;
const electron152 = /^(?:[^\s/]+\/[^\s]+ )?Chrome\/152(?:\.\d+){3} Electron\/\d+(?:\.\d+){2} Safari\/537\.36$/;

/** Canvas tile scaling has pixel parity only for the measured renderer families. */
export function supportsDirectNativePreview(userAgent: string, brands?: readonly BrowserBrand[]): boolean {
  if (!userAgent.startsWith(windowsAgent)) return false;
  const renderer = userAgent.slice(windowsAgent.length);
  if (electron152.test(renderer)) return true;
  return chrome157.test(renderer) && !!brands?.some(({ brand, version }) => brand === 'Google Chrome' && version === '157');
}
