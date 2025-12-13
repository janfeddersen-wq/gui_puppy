const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

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

  // Determine paths
  const sidecarDir = app.isPackaged
    ? path.join(process.resourcesPath, 'sidecar')
    : path.join(__dirname, '..', '..', 'sidecar');

  const sidecarPath = path.join(sidecarDir, 'gui_sidecar.py');

  // Handle Windows vs Unix Python paths
  const isWindows = process.platform === 'win32';
  const pythonPath = isWindows
    ? path.join(sidecarDir, '.venv', 'Scripts', 'python.exe')
    : path.join(sidecarDir, '.venv', 'bin', 'python');

  console.log(`Using Python: ${pythonPath}`);
  console.log(`Sidecar script: ${sidecarPath}`);

  // Start the Python sidecar using the venv python
  sidecarProcess = spawn(pythonPath, [sidecarPath, '--port', sidecarPort.toString()], {
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
