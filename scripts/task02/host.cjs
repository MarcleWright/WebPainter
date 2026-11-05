const {app,BrowserWindow}=require('electron');const fs=require('node:fs');const path=require('node:path');
app.setPath('userData',path.resolve(__dirname,'../../doc/material/local/task02/profile'));app.commandLine.appendSwitch('disable-renderer-backgrounding');app.commandLine.appendSwitch('disable-background-timer-throttling');
fs.mkdirSync(path.resolve(__dirname,'../../doc/material/local/task02'),{recursive:true});
let win;const errors=[];
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:960,show:true,webPreferences:{backgroundThrottling:false,nodeIntegration:false,contextIsolation:true}});
 win.webContents.on('console-message',e=>{if(e.message.startsWith('EVAL '))console.log(e.message);if(e.level==='error'||e.level===3)errors.push(e.message)});
 await win.loadURL('http://127.0.0.1:6041');win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Profiler.enable');await win.webContents.debugger.sendCommand('Profiler.start');
 const result=await win.webContents.executeJavaScript('(async()=>{globalThis.__webPainterTask02='+JSON.stringify(process.env.TASK02_PREVIEW === '1')+';'+fs.readFileSync(path.join(__dirname,'evaluate.js'),'utf8')+'})()');
 const profile=await win.webContents.debugger.sendCommand('Profiler.stop');fs.writeFileSync(path.resolve(__dirname,'../../doc/material/local/task02/run.cpuprofile'),JSON.stringify(profile.profile));
 fs.writeFileSync(path.resolve(__dirname,'../../doc/material/local/task02/results.json'),JSON.stringify({result,errors,gpu:app.getGPUFeatureStatus()},null,2));console.log(JSON.stringify({done:true,errors}));app.exit(0);
}).catch(e=>{fs.writeFileSync(path.resolve(__dirname,'../../doc/material/local/task02/error.txt'),String(e.stack));console.error(e);app.exit(1)});
setTimeout(()=>{console.error('evaluation timeout');app.exit(2)},180000);