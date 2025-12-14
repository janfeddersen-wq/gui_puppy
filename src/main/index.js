const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');

let mainWindow = null;
let sidecarProcess = null;
let sidecarPort = null;
const isDev = process.argv.includes('--dev') || !app.isPackaged;

// Find an available port
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// Start the code_puppy sidecar process
async function startSidecar() {
  sidecarPort = await getAvailablePort();
  console.log(`Starting code_puppy sidecar on port ${sidecarPort}`);

  const isWindows = process.platform === 'win32';

  let sidecarExecutable;
  let sidecarArgs;
  let sidecarDir;

  if (app.isPackaged) {
    // In production, use the PyInstaller-built executable
    sidecarDir = path.join(process.resourcesPath, 'sidecar');

    if (isWindows) {
      sidecarExecutable = path.join(sidecarDir, 'gui_sidecar.exe');
    } else {
      sidecarExecutable = path.join(sidecarDir, 'gui_sidecar');
    }
    sidecarArgs = ['--port', sidecarPort.toString()];

    console.log(`Using bundled sidecar: ${sidecarExecutable}`);
  } else {
    // In development, use the Python script with venv
    sidecarDir = path.join(__dirname, '..', '..', 'sidecar');
    const sidecarScript = path.join(sidecarDir, 'gui_sidecar.py');

    const pythonPath = isWindows
      ? path.join(sidecarDir, '.venv', 'Scripts', 'python.exe')
      : path.join(sidecarDir, '.venv', 'bin', 'python');

    sidecarExecutable = pythonPath;
    sidecarArgs = [sidecarScript, '--port', sidecarPort.toString()];

    console.log(`Using Python: ${pythonPath}`);
    console.log(`Sidecar script: ${sidecarScript}`);
  }

  // Verify executable exists
  if (!fs.existsSync(sidecarExecutable)) {
    const error = `Sidecar executable not found: ${sidecarExecutable}`;
    console.error(error);
    mainWindow?.webContents.send('sidecar-error', { error });
    return sidecarPort;
  }

  // Start the sidecar process
  sidecarProcess = spawn(sidecarExecutable, sidecarArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    cwd: sidecarDir
  });

  sidecarProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[sidecar stdout]: ${output}`);

    // Check for ready signal
    if (output.includes('SIDECAR_READY')) {
      mainWindow?.webContents.send('sidecar-ready', { port: sidecarPort });
    }
  });

  sidecarProcess.stderr.on('data', (data) => {
    console.error(`[sidecar stderr]: ${data.toString()}`);
  });

  sidecarProcess.on('error', (err) => {
    console.error('Failed to start sidecar:', err);
    mainWindow?.webContents.send('sidecar-error', { error: err.message });
  });

  sidecarProcess.on('close', (code) => {
    console.log(`Sidecar process exited with code ${code}`);
    sidecarProcess = null;
    mainWindow?.webContents.send('sidecar-closed', { code });
  });

  return sidecarPort;
}

function stopSidecar() {
  if (sidecarProcess) {
    console.log('Stopping sidecar process...');
    sidecarProcess.kill('SIGTERM');
    sidecarProcess = null;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files from app resources
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-sidecar-port', () => sidecarPort);

ipcMain.handle('restart-sidecar', async () => {
  stopSidecar();
  return await startSidecar();
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Working Directory'
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// App lifecycle
app.whenReady().then(async () => {
  // Remove the default menu bar
  Menu.setApplicationMenu(null);

  await startSidecar();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopSidecar();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopSidecar();
});
