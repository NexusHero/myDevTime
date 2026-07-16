'use strict'

// Electron main process for the myDevTime desktop companion (ADR-0059, macOS/Windows).
// Opens a small window and streams the local per-app breakdown from `capture.cjs` to
// the renderer. Not built or run in this repo's environment — see README.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { createTracker } = require('./capture.cjs')

let tracker = null

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    title: 'myDevTime — App usage',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile('index.html')

  // Consent-gated: the renderer toggles tracking; nothing runs until it does.
  ipcMain.handle('tracking:start', () => {
    if (tracker) return
    tracker = createTracker()
    tracker.start(breakdown => {
      if (!win.isDestroyed()) win.webContents.send('tracking:update', breakdown)
    })
  })
  ipcMain.handle('tracking:stop', () => {
    if (tracker) tracker.stop()
    tracker = null
  })

  win.on('closed', () => {
    if (tracker) tracker.stop()
    tracker = null
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
