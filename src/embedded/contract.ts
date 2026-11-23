import type {HostShortcutProfile} from '../app/shortcuts';
import type {CapabilityPolicy} from './capabilities';
/** Portable port v4. No React, Window, Electron or ADA business identities. */
export const PORT_VERSION = 4 as const;
/** Optional host keymap support, independent of document and RPC versions. */
export const HOST_SHORTCUT_PROFILE_VERSION = 1 as const;
/** Optional reference output for the composition host. Port and native file versions are independent. */
export const GENERATION_REFERENCE_CAPTURE_VERSION = 1 as const;
export const GENERATION_REFERENCE_MAX_BYTES = 32 * 1024 * 1024;

export function resolveHostShortcutProfile(value: unknown): HostShortcutProfile {
  if (value === undefined) return 'desktop';
  if (value === 'desktop' || value === 'web') return value;
  throw new Error('Invalid host shortcut profile');
}
export type Operation = { generation: number; operationId: string; binding: string };
export type Resource = { name: string; bytes: Uint8Array; source?: {id:string;hash:string}; recovered?:boolean; placement?: 'fitCanvas' };
export type Output = Operation & { format: 'psd-test' | 'png' | 'psd' | 'wpnative'; bytes: Uint8Array; transfer?:true; checkpoint?: string; preview?: Uint8Array };
export type GenerationReference = Operation & {
  format: 'jpeg';
  bytes: Uint8Array;
  checkpoint: string;
  width: number;
  height: number;
};
export type EditorState = { referenceCaptureBusy?:boolean;outputBusy:boolean;checkpointReady:boolean;hasUncommittedChanges:boolean;change?:number;generation: number; open: boolean; dirty: boolean; checkpoint?: string | null };
export interface HostPort {
  nativeVersion?: 1;
  capabilityPolicy?: CapabilityPolicy;
  shortcutProfile?: HostShortcutProfile;
  readResource(op: Operation, token: string): Promise<Resource>;
  save(output: Output): Promise<void>;
  export(output: Output): Promise<void>;
  confirm(message: string, detail: string | undefined, buttons: string[]): Promise<number>;
  dirty(state: EditorState): void;
  error(error: { generation: number; message: string }): void;
}
export type EditorCommand = 'undo' | 'redo' | 'layerViaCopy' | 'transform';
export interface EmbeddedEditor {
  open(binding: string, resourceToken: string): Promise<void>;
  save(): Promise<boolean>;
  saveBackground():Promise<'saved'|'deferred'|'failed'>;
  captureComposite(): Promise<Output>;
  captureGenerationReference?(signal?: AbortSignal): Promise<GenerationReference>;
  captureNative(): Promise<Output>;
  saveAndCapture(): Promise<Output>;
  addResource(resourceToken:string):Promise<void>;
  exportPng(): Promise<void>;
  exportPsd(): Promise<void>;
  command(command: EditorCommand): Promise<void>;
  state(): EditorState;
  requestClose(): Promise<boolean>;
  destroy(): void | Promise<void>;
}

/** Additive composition-page feature. Detached from the port v4 RPC. */
export const NEW_DOCUMENT_PICKER_VERSION = 1 as const;
export type NewDocumentPickerOptions = {
  pickerId: string;
  maxWidth: number;
  maxHeight: number;
  locale?: 'en' | 'zh-CN';
};
export type NewDocumentPickerResult = {
  pickerId: string;
  size: { width: number; height: number } | null;
};
export interface EmbeddedPageEditor extends EmbeddedEditor {
  showNewDocumentPicker(options: NewDocumentPickerOptions, settle: (result: NewDocumentPickerResult) => void): void;
  cancelNewDocumentPicker(pickerId: string): void;
}
