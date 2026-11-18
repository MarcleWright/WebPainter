// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { editor } from '../../src/app/editor';
import { NewDocumentDialog } from '../../src/ui/dialogs/DocumentDialogs';
import { NewDocumentSizeDialog } from '../../src/ui/dialogs/NewDocumentSizeFields';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  for (const session of [...editor.sessions]) editor.removeSession(session.id);
  container.remove();
});

function inputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function selectValue(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

it('offers WP screen presets and confirms an exact hosted size without opening a local document', async () => {
  const confirm = vi.fn();
  const cancel = vi.fn();
  await act(async () => root.render(<NewDocumentSizeDialog limits={{ width: 8192, height: 8192 }}
    locale="zh-CN" confirm={confirm} cancel={cancel} />));
  const dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute('aria-label')).toBe('新建画板');
  const width = dialog.querySelector<HTMLInputElement>('input[aria-label="宽度"]')!;
  const height = dialog.querySelector<HTMLInputElement>('input[aria-label="高度"]')!;
  expect(document.activeElement).toBe(width);
  expect([width.value, height.value]).toEqual(['1920', '1080']);
  const group = dialog.querySelector('[role="group"][aria-label="尺寸预设"]')!;
  const presets = [...group.querySelectorAll<HTMLButtonElement>('button')];
  const [landscape, , , , square, portrait] = presets;
  const selected = () => presets.filter(button => button.getAttribute('aria-pressed') === 'true');
  expect(dialog.querySelector('select')).toBeNull();
  expect(presets.map(button => button.textContent)).toEqual([
    '1920 × 1080', '2560 × 1440', '3840 × 2160', '7680 × 4320', '1080 × 1080', '1080 × 1920',
  ]);
  expect(landscape.querySelector('span[style]')?.getAttribute('style')).toContain('aspect-ratio: 1920 / 1080');
  expect(square.querySelector('span[style]')?.getAttribute('style')).toContain('aspect-ratio: 1080 / 1080');
  expect(portrait.querySelector('span[style]')?.getAttribute('style')).toContain('aspect-ratio: 1080 / 1920');
  expect(selected()).toEqual([landscape]);

  await act(async () => portrait.click());
  expect([width.value, height.value]).toEqual(['1080', '1920']);
  expect(selected()).toEqual([portrait]);
  expect(confirm).not.toHaveBeenCalled();

  await act(async () => inputValue(width, '1023'));
  expect(selected()).toEqual([]);
  await act(async () => inputValue(width, '1080'));
  expect(selected()).toEqual([]);
  await act(async () => portrait.click());
  expect(selected()).toEqual([portrait]);
  await act(async () => inputValue(height, '1080'));
  expect(selected()).toEqual([]);
  await act(async () => {
    inputValue(width, '1023');
    inputValue(height, '2050');
  });
  await act(async () => {
    height.focus();
    height.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(confirm).toHaveBeenCalledExactlyOnceWith({ width: 1023, height: 2050 });
  expect(cancel).not.toHaveBeenCalled();
  expect(editor.sessions).toHaveLength(0);
});

it('keeps invalid dimensions visible and cancels the hosted dialog with Escape', async () => {
  const confirm = vi.fn();
  const cancel = vi.fn();
  await act(async () => root.render(<NewDocumentSizeDialog limits={{ width: 4096, height: 4096 }}
    confirm={confirm} cancel={cancel} />));
  const input = container.querySelector<HTMLInputElement>('input')!;
  const create = container.querySelector<HTMLButtonElement>('button.primary')!;
  const options = container.querySelector('[role="group"]')!.textContent!;
  expect(options).toContain('3840 × 2160');
  expect(options).not.toContain('7680 × 4320');

  for (const invalid of ['', '20.5', '0', '4097']) {
    await act(async () => inputValue(input, invalid));
    expect(input.value).toBe(invalid);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(create.disabled).toBe(true);
    await act(async () => create.click());
  }
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
  expect(editor.sessions).toHaveLength(0);
});

it('preserves standalone print presets and standalone local document ownership', async () => {
  const close = vi.fn();
  await act(async () => root.render(<NewDocumentDialog close={close} />));
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Preset"]')!;
  const a4 = [...select.options].find(option => option.text === 'A4 @ 300 ppi')!;
  const background = [...container.querySelectorAll<HTMLSelectElement>('select')].find(field =>
    [...field.options].some(option => option.value === 'transparent'),
  )!;
  await act(async () => {
    selectValue(select, a4.value);
    selectValue(background, 'transparent');
  });
  await act(async () => container.querySelector<HTMLButtonElement>('button.primary')!.click());
  expect(close).toHaveBeenCalledTimes(1);
  expect(editor.active?.doc.canvas).toMatchObject({ width: 2480, height: 3508, resolution: 300, colorMode: 'rgb', bitDepth: 8 });
});
