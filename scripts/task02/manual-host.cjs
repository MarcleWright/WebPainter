// Persistent manual window, separate from the timed automatic evaluation host.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setName('WebPainter Task02 Manual');
app.setPath('userData', path.resolve(__dirname, '../../doc/material/local/task02/manual-profile'));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
let win;
let ready = false;
let switching = false;

// Use precisely the same synthetic fixture builder as the paired measurements.
function bootstrap() {
  const evaluation = fs.readFileSync(path.join(__dirname, 'evaluate.js'), 'utf8');
  const marker = 'const out=';
  const at = evaluation.indexOf(marker);
  if (at < 0) throw new Error('Task02 fixture builder marker is missing.');
  const setup = evaluation.slice(0, at);
  return `(async () => {
    globalThis.__webPainterTask02 = true;
    ${setup}
    let currentSessionId = null;
    const cases = {
      medium: { title: 'C0 medium', size: [1536, 1024] },
      large: { title: 'C0 large', size: [3072, 1728] },
      effects: { title: 'C1 effects', size: [1536, 1024], complex: true },
    };
    window.__task02Manual = {
      name: '',
      info() {
        return {
          enabled: globalThis.__webPainterTask02 === true,
          name: this.name,
          renderer: window.__celenneRenderer,
          gpu: !!rendering.gpuCompositor(),
          autosaveMinutes: editor.prefs.general.autosaveMinutes,
          width: editor.active?.doc.width,
          height: editor.active?.doc.height,
          sessions: editor.sessions.length,
        };
      },
      async load(key) {
        editor.cancelTool();
        if (currentSessionId) editor.removeSession(currentSessionId);
        const c = cases[key];
        const { doc, layer } = build(3840, 2160, c.size, !!c.complex);
        doc.name = 'Task02 ' + c.title + ' - synthetic 4K';
        const s = editor.addDocument(doc);
        currentSessionId = s.id;
        s.setActive(layer.id);
        s.fitted = true;
        s.view.zoom = .25;
        await frame(); await frame();
        const host = editor.hostFactory?.();
        const size = host?.viewportSize() ?? { w: 1000, h: 700 };
        s.view.panX = Math.max(0, (size.w - 3840 * .25) / 2);
        s.view.panY = Math.max(0, (size.h - 2160 * .25) / 2);
        this.name = c.title;
        host?.redraw();
        return this.info();
      },
      toggle() {
        editor.cancelTool();
        globalThis.__webPainterTask02 = !globalThis.__webPainterTask02;
        return this.info();
      },
    };
    await window.__task02Manual.load('medium');
    for (let i = 0; i < 200 && !window.__celenneViewport; i++) await pause(50);
    return window.__task02Manual.info();
  })()`;
}

function showStatus(info) {
  const mode = info.enabled ? 'OPTIMIZED ON' : 'ORIGINAL';
  win.setTitle(`Task02 | ${mode} | ${info.name} | ${info.renderer ?? 'initializing'} | F6 toggle / F7 medium / F8 large / F9 effects`);
  console.log('TASK02_MANUAL_STATUS ' + JSON.stringify(info));
}

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1500, height: 1000, show: true,
    webPreferences: { backgroundThrottling: false, nodeIntegration: false, contextIsolation: true },
  });
  win.removeMenu();
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('console-message', event => {
    if (event.message.startsWith('[Task 02]') || event.level === 'error') console.log(event.message);
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    const key = input.key.toUpperCase();
    if (key === 'F12') { event.preventDefault(); win.webContents.toggleDevTools(); return; }
    if (!['F6', 'F7', 'F8', 'F9'].includes(key)) return;
    event.preventDefault();
    if (!ready || switching) return;
    switching = true;
    const script = key === 'F6' ? 'window.__task02Manual.toggle()'
      : `window.__task02Manual.load(${JSON.stringify({ F7: 'medium', F8: 'large', F9: 'effects' }[key])})`;
    win.webContents.executeJavaScript(script).then(showStatus).catch(console.error).finally(() => { switching = false; });
  });
  await win.loadURL(process.env.TASK02_MANUAL_URL);
  const info = await win.webContents.executeJavaScript(bootstrap());
  if (!info.gpu || !String(info.renderer).startsWith('webgpu')) {
    throw new Error('WebGPU compositing is unavailable; this window cannot validate the optimized path.');
  }
  showStatus(info);
  ready = true;
  console.log('TASK02_MANUAL_READY: drag inside the preselected rectangle. Close this window to stop.');
}).catch(error => {
  console.error(error);
  dialog.showErrorBox('Task02 startup failed', String(error.stack ?? error));
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
