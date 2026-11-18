import { useId, useState, type ReactNode } from 'react';
import { Select } from '../controls';
import { DialogType, Modal } from './Modal';

type Preset = { name: string; w: number; h: number; res: number };

const SCREEN_PRESETS: readonly Preset[] = [
  { name: 'Default (1920 × 1080)', w: 1920, h: 1080, res: 72 },
  { name: 'Web Large (2560 × 1440)', w: 2560, h: 1440, res: 72 },
  { name: '4K UHD (3840 × 2160)', w: 3840, h: 2160, res: 72 },
  { name: '8K UHD (7680 × 4320)', w: 7680, h: 4320, res: 72 },
  { name: 'Square Social (1080 × 1080)', w: 1080, h: 1080, res: 72 },
  { name: 'Story (1080 × 1920)', w: 1080, h: 1920, res: 72 },
];
const NEW_DOCUMENT_PRESETS: readonly Preset[] = [
  ...SCREEN_PRESETS,
  { name: 'A4 @ 300 ppi', w: 2480, h: 3508, res: 300 },
  { name: 'US Letter @ 300 ppi', w: 2550, h: 3300, res: 300 },
  { name: 'Postcard 6×4 in @ 300', w: 1800, h: 1200, res: 300 },
  { name: 'Large Print 16K (16384 × 16384)', w: 16384, h: 16384, res: 300 },
];

export const DEFAULT_NEW_DOCUMENT_PRESET = NEW_DOCUMENT_PRESETS[0];

export function NewDocumentSizeFields({ onPreset, widthField, heightField }: {
  onPreset: (preset: Preset) => void;
  widthField: ReactNode;
  heightField: ReactNode;
}) {
  return <>
    <span className="lbl">Preset</span>
    <Select ariaLabel="Preset" value="" onChange={value => {
      const preset = NEW_DOCUMENT_PRESETS[Number(value)];
      if (preset) onPreset(preset);
    }} options={[{ value: '', label: 'Choose a preset…' }, ...NEW_DOCUMENT_PRESETS.map((preset, i) => ({
      value: String(i),
      label: preset.name,
    }))]} />
    <span className="lbl">Width</span>
    {widthField}
    <span className="lbl">Height</span>
    {heightField}
  </>;
}

export type NewDocumentSize = { width: number; height: number };

function pixelValue(text: string, max: number): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;
}

/** Hosted creation validates a pixel size and hands it back to the document owner. */
export function NewDocumentSizeDialog({ limits, locale = 'en', confirm, cancel }: {
  limits: NewDocumentSize;
  locale?: 'en' | 'zh-CN';
  confirm: (size: NewDocumentSize) => void;
  cancel: () => void;
}) {
  const [widthText, setWidthText] = useState(String(Math.min(DEFAULT_NEW_DOCUMENT_PRESET.w, limits.width)));
  const [heightText, setHeightText] = useState(String(Math.min(DEFAULT_NEW_DOCUMENT_PRESET.h, limits.height)));
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(DEFAULT_NEW_DOCUMENT_PRESET);
  const hintId = useId();
  const zh = locale === 'zh-CN';
  const labels = zh ? { width: '宽度', height: '高度' } : { width: 'Width', height: 'Height' };
  const width = pixelValue(widthText, limits.width);
  const height = pixelValue(heightText, limits.height);
  const presets = SCREEN_PRESETS.filter(preset =>
    preset.w <= limits.width && preset.h <= limits.height,
  );
  const sizeInput = (label: string, text: string, valid: boolean, change: (text: string) => void, initialFocus?: true) => <input
    className="num" style={{ width: 90 }} inputMode="numeric" aria-label={label}
    aria-invalid={!valid} aria-describedby={hintId} data-modal-autofocus={initialFocus} value={text}
    onChange={event => { change(event.target.value); setSelectedPreset(null); }}
  />;
  return <DialogType.Provider value="newDocument">
    <Modal title={zh ? '新建画板' : 'New Document'} width={420} onClose={cancel}
      onOk={() => { if (width !== null && height !== null) confirm({ width, height }); }}
      okLabel={zh ? '创建' : 'Create'} cancelLabel={zh ? '取消' : 'Cancel'} closeLabel={zh ? '关闭' : 'Close'}
      okDisabled={width === null || height === null}>
      {presets.length > 0 && <div className="document-size-presets" role="group" aria-label={zh ? '尺寸预设' : 'Size presets'}>
        {presets.map(preset => <button key={preset.name} type="button" className="document-size-preset"
          aria-pressed={selectedPreset === preset && width === preset.w && height === preset.h}
          onClick={() => {
            setWidthText(String(preset.w));
            setHeightText(String(preset.h));
            setSelectedPreset(preset);
          }}>
          <span className="document-size-preset-icon" aria-hidden="true">
            <span style={{ width: 40 * preset.w / Math.max(preset.w, preset.h), aspectRatio: `${preset.w} / ${preset.h}` }} />
          </span>
          <span>{preset.w} × {preset.h}</span>
        </button>)}
      </div>}
      <div className="grid2">
        <span className="lbl">{labels.width}</span>
        <div className="row">{sizeInput(labels.width, widthText, width !== null, setWidthText, true)} <span className="faint">px</span></div>
        <span className="lbl">{labels.height}</span>
        <div className="row">
          {sizeInput(labels.height, heightText, height !== null, setHeightText)} <span className="faint">px</span>
          <button type="button" className="btn small" onClick={() => {
            if (widthText === heightText) return;
            setWidthText(heightText);
            setHeightText(widthText);
            setSelectedPreset(null);
          }}>
            {zh ? '⇄ 交换' : '⇄ Swap'}
          </button>
        </div>
      </div>
      <p className="faint" id={hintId}>
        {zh ? `宽度 1–${limits.width}，高度 1–${limits.height}，单位为像素 · RGB 8 位`
          : `Width 1–${limits.width}, height 1–${limits.height} pixels · RGB 8-bit`}
      </p>
    </Modal>
  </DialogType.Provider>;
}
