/** Portable port v1. No React, Window, Electron or ADA business identities. */
export const PORT_VERSION = 1 as const;
export type Operation = { generation: number; operationId: string; binding: string };
export type Resource = { name: string; bytes: Uint8Array };
export type Output = Operation & { format: 'psd-test' | 'png'; bytes: Uint8Array };
export type EditorState = { generation: number; open: boolean; dirty: boolean };
export interface HostPort {
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
  exportPng(): Promise<void>;
  command(command: EditorCommand): Promise<void>;
  state(): EditorState;
  requestClose(): Promise<boolean>;
  destroy(): void | Promise<void>;
}
