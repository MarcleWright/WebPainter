/** Portable port v2. No React, Window, Electron or ADA business identities. */
export const PORT_VERSION = 2 as const;
export type Operation = { generation: number; operationId: string; binding: string };
export type Resource = { name: string; bytes: Uint8Array; source?: {id:string;hash:string}; recovered?:boolean };
export type Output = Operation & { format: 'psd-test' | 'png' | 'psd' | 'wpnative'; bytes: Uint8Array; checkpoint?: string; preview?: Uint8Array };
export type EditorState = { generation: number; open: boolean; dirty: boolean };
export interface HostPort {
  nativeVersion?: 1;
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
