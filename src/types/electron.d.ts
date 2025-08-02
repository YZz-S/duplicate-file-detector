// Electron API类型定义

interface ElectronAPI {
  // 目录选择
  selectDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;

  // 文件扫描
  scanDirectory: (dirPath: string, options?: {
    maxDepth?: number;
    excludeDirs?: string[];
    includeExtensions?: string[];
    maxFileSize?: number;
    minFileSize?: number;
  }) => Promise<{
    success: boolean;
    files?: Array<{
      name: string;
      path: string;
      size: number;
      mtime: string;
      ctime: string;
      extension: string;
      directory: string;
    }>;
    error?: string;
    errors?: string[];
    totalErrors?: number;
  }>;

  // 查找重复文件
  findDuplicates: (files: any[], scanMode?: string) => Promise<{
    success: boolean;
    duplicates?: Array<{
      id: string;
      baseName: string;
      files: any[];
      totalSize: number;
      count: number;
      scanMode?: string;
    }>;
    error?: string;
  }>;

  // 删除文件
  deleteFile: (filePath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // 打开文件
  openFile: (path: string) => Promise<void>;

  // 在资源管理器中显示
  showInExplorer: (path: string) => Promise<void>;

  // 扫描进度监听
  onScanProgress: (callback: (progress: any) => void) => () => void;
  removeScanProgressListener: (callback: (progress: any) => void) => void;

  // 获取文件统计信息
  getFileStats: (filePath: string) => Promise<{
    success: boolean;
    stats?: {
      size: number;
      mtime: Date;
      ctime: Date;
      isFile: boolean;
      isDirectory: boolean;
    };
    error?: string;
  }>;

  // 发送系统通知
  sendNotification: (options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // 打开外部链接
  openExternal: (url: string) => Promise<void>;

  // 平台信息
  platform: string;

  // 版本信息
  version: string;

  // 读取文件用于预览
  readFileForPreview: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
}

// 扩展Window接口
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export { };