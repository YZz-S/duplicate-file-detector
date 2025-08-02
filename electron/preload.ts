import { contextBridge, ipcRenderer } from 'electron';

// 定义API接口
interface ElectronAPI {
  // 目录选择
  selectDirectory: () => Promise<string | null>;

  // 文件扫描
  scanDirectory: (dirPath: string, options?: any) => Promise<{
    success: boolean;
    files?: any[];
    errors?: string[];
    totalErrors?: number;
    error?: string;
  }>;

  // 查找重复文件
  findDuplicates: (files: any[]) => Promise<{
    success: boolean;
    duplicates?: any[];
    error?: string;
  }>;

  // 删除文件
  deleteFile: (filePath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // 获取文件统计信息
  getFileStats: (filePath: string) => Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }>;

  // 扫描进度监听
  onScanProgress: (callback: (progress: {
    currentPath: string;
    errors: string[];
    filesScanned: number;
  }) => void) => () => void;

  // 移除扫描进度监听
  removeScanProgressListener: (callback: Function) => void;

  // 平台信息
  platform: string;

  // 版本信息
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 目录选择
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // 文件扫描
  scanDirectory: (dirPath: string, options?: any) =>
    ipcRenderer.invoke('scan-directory', dirPath, options),

  // 查找重复文件
  findDuplicates: (files: any[], scanMode?: string) =>
    ipcRenderer.invoke('find-duplicates', files, scanMode),

  // 删除文件
  deleteFile: (filePath: string) =>
    ipcRenderer.invoke('delete-file', filePath),

  // 获取文件统计信息
  getFileStats: (filePath: string) =>
    ipcRenderer.invoke('get-file-stats', filePath),

  // 打开文件
  openFile: (filePath: string) =>
    ipcRenderer.invoke('open-file', filePath),

  // 在资源管理器中显示文件
  showInExplorer: (filePath: string) =>
    ipcRenderer.invoke('show-in-explorer', filePath),

  // 发送系统通知
  sendNotification: (options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
  }) => ipcRenderer.invoke('send-notification', options),

  // 打开外部链接
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  readFileForPreview: (filePath: string) => ipcRenderer.invoke('read-file-for-preview', filePath),

  // 扫描进度监听
  onScanProgress: (callback: (progress: {
    currentPath: string;
    errors: string[];
    filesScanned: number;
  }) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },

  // 移除扫描进度监听
  removeScanProgressListener: (callback: Function) => {
    ipcRenderer.removeAllListeners('scan-progress');
  },

  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
} as ElectronAPI);

// 类型声明
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}