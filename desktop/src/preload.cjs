const { contextBridge, ipcRenderer } = require('electron');

let saveDirectory = getSavedDirectory();
function getSavedDirectory() {
	return ipcRenderer.sendSync('current-save-directory');
}
contextBridge.exposeInMainWorld('primo', {
	config: {
		getSavedDirectory,
		selectDirectory: async () => {
			ipcRenderer.send('set-save-directory');
			const { canceled, filePaths } = await new Promise(resolve => {
				ipcRenderer.on('get-save-directory', (event, arg) => {
					resolve(arg);
				});
			});
			return canceled ? null : filePaths[0];
		},
		setHosts: hosts => {
			const success = ipcRenderer.sendSync('set-hosts', hosts);
			return success;
		},
		getHosts: () => {
			const hosts = ipcRenderer.sendSync('get-hosts');
			return hosts;
		},
		setServerConfig: url => {
			const success = ipcRenderer.sendSync('set-server-config', url);
			return success;
		},
		getServerConfig: () => {
			const url = ipcRenderer.sendSync('get-server-config');
			return url;
		},
		getMachineID: () => {
			return ipcRenderer.sendSync('get-machine-id');
		},
		getLanguage: () => {
			return ipcRenderer.sendSync('get-language');
		},
		setLanguage: enabled => {
			ipcRenderer.sendSync('set-language', enabled);
			return true;
		},
	},
	data: {
		setPreview: site => {
			ipcRenderer.sendSync('set-preview', site);
		},
		deleteSite: siteID => {
			ipcRenderer.sendSync('delete-site', siteID);
		},
		load: () => {
			const data = ipcRenderer.sendSync('load-data', saveDirectory);
			return data || [];
		},
		save: async data => {
			const res = await ipcRenderer.invoke('save-data', data);
			return res;
		},
		setDeployment: data => {
			ipcRenderer.sendSync('set-deployment', data);
		},
	},
	processCSS: async raw => {
		const res = await ipcRenderer.invoke('process-css', raw);
		return res;
	},
	processSvelte: async args => {
		const res = await ipcRenderer.invoke('process-svelte', args);
		return res;
	},
	checkForUpdate: () => {
		ipcRenderer.sendSync('check-for-update');
	},
	createPopup: async () => {
		const res = ipcRenderer.sendSync('create-popup');
		return res;
	},
});
