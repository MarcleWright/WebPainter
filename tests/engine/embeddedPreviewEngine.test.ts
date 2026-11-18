import { describe, expect, it } from 'vitest';
import { supportsDirectNativePreview } from '../../src/embedded/preview-engine';

const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ';
const chrome = windows + 'Chrome/157.0.0.0 Safari/537.36';
const electron = windows + 'AutoDesignAgent/44.9.0 Chrome/152.0.7977.167 Electron/44.9.0 Safari/537.36';

describe('native thumbnail renderer policy', () => {
  it('admits the measured Chrome and Electron browser families on Windows', () => {
    expect(supportsDirectNativePreview(chrome, [
      { brand: 'Chromium', version: '157' }, { brand: 'Google Chrome', version: '157' },
    ])).toBe(true);
    expect(supportsDirectNativePreview(electron)).toBe(true);
  });

  it.each([
    chrome.replace('157.', '158.'),
    chrome.replace('157.', '156.'),
    chrome.replace('Windows NT 10.0; Win64; x64', 'X11; Linux x86_64'),
    chrome.replace('Win64; x64', 'Win64; ARM64'),
    chrome.replace('Chrome/', 'HeadlessChrome/'),
    chrome.replace('Chrome/', 'Chromium/'),
    chrome + ' Edg/157.0.0.0',
    chrome + ' OPR/157.0.0.0',
    chrome + ' Vivaldi/157.0.0.0',
    electron.replace('Chrome/152.', 'Chrome/153.'),
    electron.replace('Windows NT 10.0; Win64; x64', 'Macintosh; Intel Mac OS X 10_15_7'),
  ])('uses the original renderer for an unmeasured UA (%s)', agent => {
    expect(supportsDirectNativePreview(agent, [{ brand: 'Google Chrome', version: '157' }])).toBe(false);
  });

  it('honors brand hints when an engine masks its browser name in the UA', () => {
    expect(supportsDirectNativePreview(chrome)).toBe(false);
    expect(supportsDirectNativePreview(chrome, [])).toBe(false);
    expect(supportsDirectNativePreview(chrome, [
      { brand: 'Chromium', version: '157' }, { brand: 'Brave', version: '157' },
    ])).toBe(false);
    expect(supportsDirectNativePreview(chrome, [{ brand: 'Google Chrome', version: '156' }])).toBe(false);
  });
});
