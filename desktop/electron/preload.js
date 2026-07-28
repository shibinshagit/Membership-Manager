// Preload reserved for future desktop bridges (file dialogs, etc.).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('membershipDesktop', {
  isDesktop: true,
});
