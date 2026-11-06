// Keep the normal main/preload/file-dialog pipeline, with normal user preferences.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const local = path.resolve(__dirname, '../doc/material/local/current-source');
fs.mkdirSync(path.join(local, 'temp'), { recursive: true });
app.setName('WebPainter Current Source');
app.setPath('userData', path.join(local, 'profile'));
app.setPath('temp', path.join(local, 'temp'));

app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', event => {
    if (event.message.startsWith('[Task 02]')) console.log(event.message);
  });
  win.webContents.on('did-finish-load', () => {
    if (!win.webContents.getURL().startsWith(process.env.CELENNE_DEV_SERVER_URL)) return;
    void win.webContents.executeJavaScript(`(async () => {
      for (let i = 0; i < 300 && !window.__celenneTest; i++) await new Promise(r => setTimeout(r, 100));
      if (!window.__celenneTest) throw new Error('Current source development bridge did not initialize.');
      const { editor } = window.__celenneTest;
      for (let i = 0; i < 100 && !window.__celenneRenderer; i++) await new Promise(r => setTimeout(r, 50));
      return {
        nativeBridge: !!window.celenne,
        autosaveMinutes: editor.prefs.general.autosaveMinutes,
        renderer: window.__celenneRenderer,
        sessions: editor.sessions.length,
      };
    })()`).then(info => {
      if (win.isDestroyed()) return;
      console.log('WEBPAINTER_CURRENT_READY ' + JSON.stringify(info));
    }).catch(error => console.error('Current-source initialization failed:', error));
  });
});

// This bundle is freshly built by start-current.mjs and supplies the real desktop services.
require('../dist-electron/main.cjs');
