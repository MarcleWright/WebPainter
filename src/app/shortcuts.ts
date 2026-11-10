/** Effective bindings shared by menus, settings, conflict queries and input dispatch. */
import {access} from './access';
import {allActions} from './actions';
import {TOOLS, type ToolId} from '../tools/toolTypes';
import {loadJSON, saveJSON} from './settings';

const KEY = 'celenne.shortcuts.v1';
export type Overrides = Record<string, string[]>;
export type BindingKind = 'command' | 'exactTool' | 'toolGroup' | 'cycle' | 'held' | 'digits';
export interface Binding {chord: string; ids: string[]; kind: BindingKind; source: 'user' | 'default' | 'derived'; index: number}
export const INPUT_BINDINGS = [
  {id: 'input.pan', label: 'Hold to pan', keys: ['Space'], kind: 'held' as const},
  {id: 'input.opacity', label: 'Opacity digits', keys: Array.from({length: 10}, (_, i) => String(i)), kind: 'digits' as const},
  {id: 'input.flow', label: 'Flow / fill opacity digits', keys: Array.from({length: 10}, (_, i) => `Shift+${i}`), kind: 'digits' as const},
];
export const RESERVED_CHORDS = ['Alt+F4', 'Alt+Tab', 'Ctrl+Alt+Delete', 'Ctrl+Escape', 'Ctrl+Shift+Escape'];
const names = ['Space', 'Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
export function chordFromEvent(e: KeyboardEvent): string {
  if (e.ctrlKey && e.metaKey) return '';
  const parts = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : ''].filter(Boolean);
  let k = e.key === ' ' ? 'Space' : e.key === '+' ? '=' : e.key;
  const symbols: Record<string, string> = {BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '='};
  k = symbols[e.code] ?? (e.shiftKey && /^Digit\d$/.test(e.code) ? e.code.slice(5) : k);
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(k)) return '';
  return [...parts, k.length === 1 ? k.toUpperCase() : k].join('+');
}
export function normalizeChord(c: string): string {
  if (typeof c !== 'string') throw new Error('Shortcut must be a string');
  const parts = c.split('+').map(p => p.trim());
  let key = parts.pop() ?? '';
  const mods: string[] = parts.map(p => /^(cmd|meta|command|ctrl)$/i.test(p) ? 'Ctrl' : /^alt$/i.test(p) ? 'Alt' : /^shift$/i.test(p) ? 'Shift' : '');
  if (mods.some(m => !m) || new Set(mods).size !== mods.length) throw new Error(`Invalid modifiers: ${c}`);
  key = key.length === 1 ? key.toUpperCase() : names.find(n => n.toLowerCase() === key.toLowerCase()) ?? key.toUpperCase();
  if (!/^[A-Z0-9\[\]\\;',.\/`=\-]$/.test(key) && !/^F([1-9]|1\d|2[0-4])$/.test(key) && !names.includes(key)) throw new Error(`Invalid shortcut: ${c}`);
  return [...['Ctrl', 'Alt', 'Shift'].filter(m => mods.includes(m)), key].join('+');
}

export class Keymap {
  private overrides: Overrides;
  private map = new Map<string, Binding>();
  private listeners = new Set<() => void>();
  constructor(initial: Overrides = loadJSON<Overrides>(KEY, {})) {
    try { this.overrides = this.validate(initial); this.map = this.resolve(this.overrides); }
    catch { this.overrides = {}; this.map = this.resolve({}); }
  }
  on(l: () => void): () => void {this.listeners.add(l); return () => {this.listeners.delete(l);};}
  private definitions() {
    return [
      ...allActions().map(a => ({id: a.id, keys: a.shortcuts ?? (a.shortcut ? [a.shortcut] : []), kind: 'command' as BindingKind})),
      ...TOOLS.map(t => ({id: `tool:${t.id}`, keys: t.shortcut ? [t.shortcut] : [], kind: 'toolGroup' as BindingKind})),
      ...INPUT_BINDINGS,
    ];
  }
  private validate(value: unknown): Overrides {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid shortcut file');
    const ids = new Set(this.definitions().map(d => d.id));
    const out: Overrides = {};
    for (const [id, keys] of Object.entries(value)) {
      if (!ids.has(id) || !Array.isArray(keys) || keys.some(k => typeof k !== 'string')) throw new Error(`Invalid shortcut entry: ${id}`);
      out[id] = [...new Set(keys.map(normalizeChord))];
      if (out[id].some(k => RESERVED_CHORDS.includes(k))) throw new Error(`Reserved Windows shortcut: ${id}`);
    }
    return out;
  }
  private resolve(overrides: Overrides): Map<string, Binding> {
    const candidates = new Map<string, Binding[]>();
    for (const d of this.definitions()) {
      const user = Object.hasOwn(overrides, d.id);
      (user ? overrides[d.id] : d.keys).forEach((key, index) => {
        const chord = normalizeChord(key);
        const b: Binding = {chord, ids: [d.id], kind: d.kind === 'toolGroup' && user ? 'exactTool' : d.kind, source: user ? 'user' : 'default', index};
        candidates.set(chord, [...candidates.get(chord) ?? [], b]);
      });
    }
    const map = new Map<string, Binding>();
    for (const [chord, entries] of candidates) {
      const users = entries.filter(e => e.source === 'user');
      const bestIndex = Math.min(...entries.map(e => e.index));
      const best = users.length ? users : entries.filter(e => e.index === bestIndex);
      const grouped = best.every(e => e.kind === 'toolGroup') && new Set(best.map(e => TOOLS.find(t => `tool:${t.id}` === e.ids[0])?.group)).size === 1;
      if (best.length > 1 && !grouped) throw new Error(`Shortcut conflict ${chord}: ${best.flatMap(e => e.ids).join(', ')}`);
      map.set(chord, {...best[0], ids: best.flatMap(e => e.ids)});
    }
    for (const b of [...map.values()]) {
      if (b.kind !== 'toolGroup' || b.chord.includes('+')) continue;
      const chord = `Shift+${b.chord}`;
      if (!map.has(chord)) map.set(chord, {...b, chord, kind: 'cycle', source: 'derived'});
    }
    return map;
  }
  binding(chord: string): Binding | undefined {try {return this.map.get(normalizeChord(chord));} catch {return undefined;}}
  lookup(chord: string): string | undefined {return this.binding(chord)?.ids[0];}
  bindingsFor(id: string): string[] {return [...this.map.values()].filter(b => b.kind !== 'cycle' && b.ids.includes(id)).sort((a,b) => a.index-b.index).map(b => b.chord);}
  conflicts(chord: string, exceptId = ''): string[] {return this.binding(chord)?.ids.filter(id => id !== exceptId) ?? [];}
  conflict(chord: string, exceptId: string): string | undefined {return this.conflicts(chord, exceptId)[0];}
  private commit(value: unknown) {
    const next = this.validate(value), map = this.resolve(next);
    saveJSON(KEY, next);
    this.overrides = next; this.map = map;
    for (const l of this.listeners) l();
  }
  rebuild(): void {this.map = this.resolve(this.overrides); for (const l of this.listeners) l();}
  set(id: string, chords: string[]): void {this.commit({...this.overrides, [id]: chords});}
  reassign(id: string, chord: string): void {
    const next = structuredClone(this.overrides), n = normalizeChord(chord);
    for (const other of this.conflicts(n, id)) {
      // A derived cycle is released by removing its base key from every default member.
      const b = this.binding(n)!;
      const remove = b.kind === 'cycle' ? n.replace(/^Shift\+/, '') : n;
      next[other] = this.bindingsFor(other).filter(c => c !== remove);
    }
    next[id] = [...this.bindingsFor(id).filter(c => c !== n), n];
    this.commit(next);
  }
  reset(id?: string): void {
    const next = {...this.overrides};
    if (id) {
      const defaults = this.definitions().find(d => d.id === id)?.keys ?? [];
      for (const key of defaults) {
        const b = this.binding(key);
        if (b?.source === 'user' && b.ids.some(other => other !== id)) throw new Error(`Reset conflict: ${key}`);
      }
      delete next[id];
    }
    this.commit(id ? next : {});
  }
  exportJSON(): string {return JSON.stringify(this.overrides, null, 2);}
  importJSON(json: string): void {this.commit(JSON.parse(json));}
  toolFor(binding: Binding, current: ToolId, remembered: Record<string, string>): ToolId | null {
    const allowed = binding.ids.map(id => TOOLS.find(t => `tool:${t.id}` === id)).filter(t => t && !t.comingSoon && access(`tool:${t.id}`).enabled);
    if (!allowed.length) return null;
    if (binding.kind === 'exactTool') return allowed[0]!.id;
    if (binding.kind === 'cycle') return allowed[(allowed.findIndex(t => t!.id === current) + 1) % allowed.length]!.id;
    return allowed.find(t => t!.id === remembered[allowed[0]!.group])?.id ?? allowed[0]!.id;
  }
}
export const keymap = new Keymap();
export function cycleTool(current: ToolId, key: string): ToolId | null {
  const b = keymap.binding(`Shift+${key}`);
  return b?.kind === 'cycle' ? keymap.toolFor(b, current, {}) : null;
}
