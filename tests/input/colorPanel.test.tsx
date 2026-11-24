// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { editor } from '../../src/app/editor';
import { ui, useApp } from '../../src/app/store';
import { ColorPanel } from '../../src/ui/panels/ColorPanels';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  ui.set({ fg: { r: 0, g: 0, b: 0 }, bg: { r: 1, g: 1, b: 1 }, recentColors: [] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ColorPanel />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function control<T extends HTMLElement>(name: string) {
  return container.querySelector<T>(`[aria-label="${name}"]`)!;
}

function select(name: string, value: string) {
  const el = control<HTMLSelectElement>(name);
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function surface(name: string) {
  const el = control<HTMLDivElement>(name);
  let capture: number | undefined;
  el.setPointerCapture = (id) => { capture = id; };
  el.hasPointerCapture = (id) => capture === id;
  el.releasePointerCapture = () => { capture = undefined; };
  el.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 100, width: 120, height: 100, toJSON() {},
  });
  return el;
}

function pointer(el: HTMLElement, type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  el.dispatchEvent(event);
}

function pick(el: HTMLElement, x: number, y: number) {
  pointer(el, 'pointerdown', x, y);
  pointer(el, 'pointerup', x, y);
}

function hex() {
  return control<HTMLInputElement>('Hex color').value;
}

it('uses the RGB spectrum and white/black shortcuts without evicting recent colors', async () => {
  const old = [{ r: 0.1, g: 0.2, b: 0.3 }, { r: 0.4, g: 0.5, b: 0.6 }];
  await act(async () => ui.set({ recentColors: old }));
  const field = surface('RGB Spectrum');
  await act(async () => pointer(field, 'pointerdown', 40, 0));
  expect(hex()).toBe('FFFFFF');
  await act(async () => {
    for (let x = 0; x < 40; x++) pointer(field, 'pointermove', x, 50);
    pointer(field, 'pointermove', 40, 50);
  });
  expect(hex()).toBe('00FF00');
  await act(async () => pointer(field, 'pointermove', 150, 120));
  expect(hex()).toBe('000000');
  await act(async () => pointer(field, 'pointerup', 150, 120));
  expect(field.hasPointerCapture(1)).toBe(false);
  expect(useApp.getState().recentColors).toBe(old);
  await act(async () => control<HTMLButtonElement>('Pick white').click());
  expect(hex()).toBe('FFFFFF');
  await act(async () => control<HTMLButtonElement>('Pick black').click());
  expect(hex()).toBe('000000');
  expect(useApp.getState().recentColors).toBe(old);
});

it('preserves independent hue and saturation through gray and black in both cubes', async () => {
  await act(async () => {
    ui.set({ fg: { r: 0, g: 1, b: 0 }, bg: { r: 0, g: 0, b: 1 } });
    select('Color picker mode', 'hue');
  });
  expect(hex()).toBe('00FF00');
  const hueCube = surface('Hue Cube');
  await act(async () => pick(hueCube, 0, 50));
  expect(hex()).toBe('808080');
  await act(async () => pick(hueCube, 120, 100));
  expect(hex()).toBe('000000');
  expect(control<HTMLInputElement>('S').value).toBe('100');

  await act(async () => control<HTMLButtonElement>('Background color').click());
  await act(async () => pick(hueCube, 120, 0));
  expect(hex()).toBe('0000FF');
  await act(async () => control<HTMLButtonElement>('Foreground color').click());
  await act(async () => pick(hueCube, 120, 0));
  expect(hex()).toBe('00FF00');

  await act(async () => pick(surface('Hue strip'), 4, 50));
  expect(hex()).toBe('00FFFF');
  await act(async () => select('Color picker mode', 'brightness'));
  expect(hex()).toBe('00FFFF');
  await act(async () => pick(surface('Brightness Cube'), 80, 0));
  expect(hex()).toBe('0000FF');
  const brightness = surface('Brightness strip');
  await act(async () => pick(brightness, 5, 100));
  expect(hex()).toBe('000000');
  await act(async () => pick(brightness, 5, 50));
  expect(hex()).toBe('000080');
});

it('external color changes and mode changes invalidate captured pointers', async () => {
  const field = surface('RGB Spectrum');
  await act(async () => pointer(field, 'pointerdown', 40, 50));
  expect(hex()).toBe('00FF00');
  await act(async () => editor.setForeground({ r: 1, g: 0, b: 1 }));
  expect(field.hasPointerCapture(1)).toBe(false);
  await act(async () => pointer(field, 'pointermove', 0, 50));
  expect(hex()).toBe('FF00FF');
  expect(useApp.getState().recentColors).toEqual([{ r: 1, g: 0, b: 1 }]);

  await act(async () => pointer(field, 'pointerdown', 40, 50, 2));
  await act(async () => select('Color picker mode', 'hue'));
  expect(field.hasPointerCapture(2)).toBe(false);
  await act(async () => pointer(field, 'pointermove', 0, 50, 2));
  expect(hex()).toBe('00FF00');
  await act(async () => select('Color value format', 'rgb'));
  expect(control<HTMLInputElement>('G').value).toBe('255');
  expect(hex()).toBe('00FF00');

  const input = control<HTMLInputElement>('Hex color');
  await act(async () => input.focus());
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1562AF');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => input.blur());
  expect(hex()).toBe('1562AF');
  expect(control<HTMLInputElement>('G').value).toBe('98');
  expect(useApp.getState().recentColors).toEqual([{ r: 1, g: 0, b: 1 }]);
});
