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
  const preset = dialog.querySelector<HTMLSelectElement>('select[aria-label="预设"]')!;
  expect([...preset.options].map(option => option.text)).toContain('竖版 (1080 × 1920)');
  expect([...preset.options].map(option => option.text).join(' ')).not.toMatch(/A4|16K|300 ppi/);
  await act(async () => selectValue(preset, [...preset.options].find(option => option.text.includes('竖版'))!.value));
  expect([width.value, height.value]).toEqual(['1080', '1920']);

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
  const options = container.querySelector('select')!.textContent!;
  expect(options).toContain('4K UHD');
  expect(options).not.toContain('8K UHD');

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
