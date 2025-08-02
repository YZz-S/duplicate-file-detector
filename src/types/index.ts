// 文件信息类型（支持多种格式）
export type FileType = 'audio' | 'video' | 'image' | 'document' | 'archive' | 'other';
export type EnabledFileType = 'audio' | 'video' | 'image' | 'document' | 'archive';

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  format: string;
  lastModified: Date;
  createdAt?: Date;
  directory: string;
  type: FileType;
  // 音频文件特有属性
  bitrate?: number;
  duration?: number;
  // 图片文件特有属性
  width?: number;
  height?: number;
  // 视频文件特有属性
  resolution?: string;
  frameRate?: number;
}

// 重复文件组类型
export interface DuplicateGroup {
  id: string;
  name: string;
  baseName: string;
  files: FileInfo[];
  totalSize: number;
  count: number;
  fileType: FileType;
  potentialSavings: number;
  scanMode?: 'content' | 'name-different-size' | 'name-same-size';
}

// 文件类型配置
export interface FileTypeConfig {
  audio: string[];
  video: string[];
  image: string[];
  document: string[];
  archive: string[];
}

// 扫描配置类型
export interface ScanConfig {
  maxDepth: number;
  minFileSize: number;
  maxFileSize: number;
  fileTypes: FileTypeConfig;
  enabledTypes: EnabledFileType[];
  excludedDirectories: string[];
  // 删除延时配置
  enableDelayedDelete?: boolean;
  delayBetweenFiles?: number; // 毫秒
}

// 删除历史记录类型
export interface DeleteRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  deletedAt: Date;
  reason: string;
}

// 文件夹结构类型
export interface FolderStructure {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FolderStructure[];
  size?: number;
}

// 扫描状态类型
export interface ScanStatus {
  isScanning: boolean;
  progress: number; // 0-100
  currentPath: string;
  totalFiles: number;
  processedFiles: number;
  scanSpeed: number; // 文件/秒
  phase: 'counting' | 'scanning' | 'completed' | 'error';
  estimatedTimeRemaining: number; // 秒
  errors: string[]; // 扫描过程中的错误信息
  totalErrors: number; // 错误总数
}

// 删除状态类型
export interface DeleteStatus {
  isDeleting: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  current: number;
  total: number;
  currentFile: string;
  progress: number; // 0-100
}

// 应用状态类型
export interface AppState {
  // 扫描相关
  selectedDirectories: string[];
  scanConfig: ScanConfig;
  scanStatus: ScanStatus;
  duplicateGroups: DuplicateGroup[];

  // 删除相关
  deleteStatus: DeleteStatus;

  // 历史记录
  deleteHistory: DeleteRecord[];
  folderStructures: FolderStructure[];

  // UI状态
  currentPage: 'home' | 'details' | 'history' | 'settings';
  selectedGroup: DuplicateGroup | null;

  // 操作方法
  setSelectedDirectories: (paths: string[]) => void;
  addDirectory: (path: string) => void;
  removeDirectory: (path: string) => void;
  updateScanConfig: (config: Partial<ScanConfig>) => void;
  startScan: (fastMode?: boolean, scanMode?: string) => Promise<void>;
  stopScan: () => void;
  deleteFiles: (fileIds: string[], reason: string, options?: any) => Promise<void>;
  pauseDelete: () => void;
  resumeDelete: () => void;
  cancelDelete: () => void;
  exportDeleteList: (fileIds: string[], format?: 'csv' | 'json') => void;
  exportAllDuplicates: (format?: 'csv' | 'json') => void;
  clearHistory: () => void;
  exportHistory: () => void;
  setCurrentPage: (page: AppState['currentPage']) => void;
  setSelectedGroup: (group: DuplicateGroup | null) => void;
}