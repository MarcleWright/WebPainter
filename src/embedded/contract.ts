import type {CapabilityPolicy} from './capabilities';
/** Portable port v4. No React, Window, Electron or ADA business identities. */
export const PORT_VERSION = 4 as const;
export type Operation = { generation: number; operationId: string; binding: string };
export type Resource = { name: string; bytes: Uint8Array; source?: {id:string;hash:string}; recovered?:boolean };
export type Output = Operation & { format: 'psd-test' | 'png' | 'psd' | 'wpnative'; bytes: Uint8Array; transfer?:true; checkpoint?: string; preview?: Uint8Array };
export type EditorState = { outputBusy:boolean;checkpointReady:boolean;hasUncommittedChanges:boolean;change?:number;generation: number; open: boolean; dirty: boolean; checkpoint?: string | null };
export interface HostPort {
  nativeVersion?: 1;
  capabilityPolicy?: CapabilityPolicy;
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
