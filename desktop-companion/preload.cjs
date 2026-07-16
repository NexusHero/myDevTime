'use strict'

// Narrow, context-isolated bridge (ADR-0059). The renderer can only start/stop tracking
// and subscribe to breakdown updates — no direct Node/OS access.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('devtime', {
  start: () => ipcRenderer.invoke('tracking:start'),
  stop: () => ipcRenderer.invoke('tracking:stop'),
  onUpdate: callback => {
    const handler = (_event, breakdown) => callback(breakdown)
    ipcRenderer.on('tracking:update', handler)
    return () => ipcRenderer.removeListener('tracking:update', handler)
  },
})
