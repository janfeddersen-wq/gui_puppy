const { contextBridge, ipcRenderer } = require('electron');

// Store listener references to allow cleanup
let sidecarReadyListener = null;
let sidecarErrorListener = null;
let sidecarClosedListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  getSidecarPort: () => ipcRenderer.invoke('get-sidecar-port'),
  restartSidecar: () => ipcRenderer.invoke('restart-sidecar'),
  onSidecarReady: (callback) => {
    // Remove old listener if exists
    if (sidecarReadyListener) {
      ipcRenderer.removeListener('sidecar-ready', sidecarReadyListener);
    }
    sidecarReadyListener = (_event, data) => callback(data);
    ipcRenderer.on('sidecar-ready', sidecarReadyListener);
  },
  onSidecarError: (callback) => {
    if (sidecarErrorListener) {
      ipcRenderer.removeListener('sidecar-error', sidecarErrorListener);
    }
    sidecarErrorListener = (_event, data) => callback(data);
    ipcRenderer.on('sidecar-error', sidecarErrorListener);
  },
  onSidecarClosed: (callback) => {
    if (sidecarClosedListener) {
      ipcRenderer.removeListener('sidecar-closed', sidecarClosedListener);
    }
    sidecarClosedListener = (_event, data) => callback(data);
    ipcRenderer.on('sidecar-closed', sidecarClosedListener);
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectFolder: () => ipcRenderer.invoke('select-folder')
});
