// Electron环境下的真实文件扫描器

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  format: string;
  lastModified: Date;
  createdAt?: Date;
  directory: string;
  type: 'audio' | 'video' | 'image' | 'document' | 'archive' | 'other';
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

export interface DuplicateGroup {
  id: string;
  name: string;
  baseName: string;
  files: FileInfo[];
  totalSize: number;
  count: number;
  fileType: 'audio' | 'video' | 'image' | 'document' | 'archive' | 'other';
  potentialSavings: number;
  scanMode?: 'content' | 'name-different-size' | 'name-same-size';
}

export type ScanMode = 'content' | 'name-different-size' | 'name-same-size';

export interface ScanModeOption {
  value: ScanMode;
  label: string;
  description: string;
}

export interface ScanOptions {
  maxDepth?: number;
  excludeDirs?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
  minFileSize?: number;
}

export interface ScanProgress {
  currentPath: string;
  filesScanned: number;
  totalFiles?: number;
  isComplete: boolean;
  errors?: string[];
  totalErrors?: number;
}

// 检查是否在Electron环境中
export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

// 文件类型映射
const FILE_TYPE_MAP: Record<string, 'audio' | 'video' | 'image' | 'document' | 'archive' | 'other'> = {
  // 音频文件
  '.mp3': 'audio',
  '.wav': 'audio',
  '.flac': 'audio',
  '.aac': 'audio',
  '.ogg': 'audio',
  '.wma': 'audio',
  '.m4a': 'audio',

  // 视频文件
  '.mp4': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.mov': 'video',
  '.wmv': 'video',
  '.flv': 'video',
  '.webm': 'video',
  '.m4v': 'video',

  // 图片文件
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.bmp': 'image',
  '.tiff': 'image',
  '.webp': 'image',
  '.svg': 'image',

  // 文档文件
  '.pdf': 'document',
  '.doc': 'document',
  '.docx': 'document',
  '.xls': 'document',
  '.xlsx': 'document',
  '.ppt': 'document',
  '.pptx': 'document',
  '.txt': 'document',
  '.rtf': 'document',

  // 压缩文件
  '.zip': 'archive',
  '.rar': 'archive',
  '.7z': 'archive',
  '.tar': 'archive',
  '.gz': 'archive',
  '.bz2': 'archive',
};

function getFileType(extension: string): 'audio' | 'video' | 'image' | 'document' | 'archive' | 'other' {
  // 安全检查：确保extension是有效的字符串
  if (!extension || typeof extension !== 'string') {
    return 'other';
  }
  return FILE_TYPE_MAP[extension.toLowerCase()] || 'other';
}

// 选择目录
export async function selectDirectory(): Promise<string | null> {
  if (!isElectronEnvironment()) {
    throw new Error('此功能仅在桌面应用中可用');
  }

  const result = await window.electronAPI.selectDirectory();
  return result.success ? result.path || null : null;
}

// 扫描目录
export async function scanDirectory(
  dirPath: string,
  options: ScanOptions = {},
  onProgress?: (progress: ScanProgress) => void
): Promise<FileInfo[]> {
  if (!isElectronEnvironment()) {
    throw new Error('此功能仅在桌面应用中可用');
  }

  const defaultOptions: ScanOptions = {
    maxDepth: 10,
    excludeDirs: ['node_modules', '.git', '.vscode', 'dist', 'build', 'target'],
    includeExtensions: [],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    minFileSize: 0,
  };

  const scanOptions = { ...defaultOptions, ...options };

  try {
    onProgress?.({
      currentPath: dirPath,
      filesScanned: 0,
      isComplete: false,
      errors: [],
      totalErrors: 0
    });

    // 设置扫描进度监听
    const progressCallback = (progress: any) => {
      onProgress?.({
        currentPath: progress.currentPath,
        filesScanned: progress.filesScanned,
        isComplete: false,
        errors: progress.errors,
        totalErrors: progress.errors.length
      });
    };
    
    window.electronAPI.onScanProgress(progressCallback);

    const result = await window.electronAPI.scanDirectory(dirPath, scanOptions);

    // 移除进度监听
    window.electronAPI.removeScanProgressListener(progressCallback);

    if (!result.success) {
      throw new Error(result.error || '扫描失败');
    }

    const files: FileInfo[] = result.files!.map((file: any, index: number) => {
      // 添加调试信息
      if (!file.name || !file.extension) {
        console.warn(`⚠️ 文件信息不完整:`, file);
      }

      return {
        id: `file_${index}_${Date.now()}`,
        name: file.name || '',
        path: file.path || '',
        size: file.size || 0,
        format: file.extension || '',
        lastModified: new Date(file.mtime),
        createdAt: new Date(file.ctime),
        directory: file.directory || '',
        type: getFileType(file.extension || ''),
      };
    });

    onProgress?.({
      currentPath: dirPath,
      filesScanned: files.length,
      totalFiles: files.length,
      isComplete: true,
      errors: result.errors || [],
      totalErrors: (result.errors || []).length
    });

    return files;
  } catch (error) {
    throw new Error(`扫描目录失败: ${(error as Error).message}`);
  }
}

// 查找重复文件
export async function findDuplicates(files: FileInfo[], scanMode: ScanMode = 'content'): Promise<DuplicateGroup[]> {
  if (!isElectronEnvironment()) {
    throw new Error('此功能仅在桌面应用中可用');
  }

  try {
    console.log(`🔍 开始查找重复文件，模式：${scanMode}，文件数量：${files.length}`);

    // 转换前端 FileInfo 格式为后端期望的格式
    const backendFiles = files.map((file, index) => {
      // 验证必要字段
      if (!file.name || !file.path) {
        console.warn(`⚠️ 文件 ${index} 缺少必要信息:`, file);
      }

      return {
        name: file.name || '',
        path: file.path || '',
        size: file.size || 0,
        mtime: file.lastModified,
        ctime: file.createdAt || file.lastModified,
        extension: file.format || '',
        directory: file.directory || ''
      };
    });

    const result = await window.electronAPI.findDuplicates(backendFiles, scanMode);

    if (!result.success) {
      console.error('❌ 重复文件检测失败:', result.error);
      throw new Error(result.error || '查找重复文件失败');
    }

    console.log(`✅ 重复文件检测完成，找到 ${result.duplicates?.length || 0} 个重复组`);

    return result.duplicates!.map((group: any) => {
      const firstFile = group.files[0];
      const fileType = getFileType(firstFile.format);

      return {
        id: group.id,
        name: group.baseName,
        baseName: group.baseName,
        files: group.files.map((file: any, index: number) => ({
          id: `${group.id}_file_${index}`,
          name: file.name,
          path: file.path,
          size: file.size,
          format: file.extension,
          lastModified: new Date(file.mtime),
          createdAt: new Date(file.ctime),
          directory: file.directory,
          type: getFileType(file.extension),
        })),
        totalSize: group.totalSize,
        count: group.count,
        fileType: fileType,
        potentialSavings: group.totalSize - Math.min(...group.files.map((f: any) => f.size)),
        scanMode: group.scanMode || scanMode,
      };
    });
  } catch (error) {
    throw new Error(`查找重复文件失败: ${(error as Error).message}`);
  }
}

// 获取扫描模式选项
export function getScanModeOptions(): ScanModeOption[] {
  return [
    {
      value: 'content',
      label: '内容相同',
      description: '基于文件内容哈希值检测，最准确但速度较慢'
    },
    {
      value: 'name-same-size',
      label: '文件名和大小相同',
      description: '检测文件名和大小都相同的文件，速度快'
    },
    {
      value: 'name-different-size',
      label: '文件名相同但大小不同',
      description: '检测文件名相同但大小不同的文件，可能是不同版本'
    }
  ];
}

// 删除文件
export async function deleteFile(filePath: string, retryCount: number = 2): Promise<{ success: boolean; method?: string; error?: string }> {
  if (!isElectronEnvironment()) {
    throw new Error('此功能仅在桌面应用中可用');
  }

  let lastError: Error | null = null;
  const isNetworkDrive = filePath.match(/^[A-Z]:\\/) && !filePath.match(/^[C-F]:\\/);
  
  if (isNetworkDrive) {
    console.log(`🌐 检测到网络驱动器文件，将使用增强的删除策略: ${filePath}`);
  }

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      console.log(`🗑️ 尝试删除文件 (第${attempt + 1}次): ${filePath}`);

      const result = await window.electronAPI.deleteFile(filePath);

      if (result.success) {
        const method = (result as any).method || 'unknown';
        if (attempt > 0) {
          console.log(`✅ 文件删除成功 (重试${attempt}次后，方式: ${method}): ${filePath}`);
        } else {
          console.log(`✅ 文件删除成功 (方式: ${method}): ${filePath}`);
        }
        return { success: true, method };
      } else {
        const error = new Error(result.error || '删除文件失败');
        lastError = error;

        if (attempt < retryCount) {
          console.warn(`⚠️ 删除失败，准备重试: ${filePath}`, error.message);
          // 网络驱动器需要更长的延迟
          const delay = isNetworkDrive ? 1000 * (attempt + 1) : 500 * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ 删除最终失败: ${filePath}`, error.message);
          return { success: false, error: error.message };
        }
      }
    } catch (error) {
      lastError = error as Error;

      if (attempt < retryCount) {
        console.warn(`⚠️ 删除出错，准备重试: ${filePath}`, (error as Error).message);
        // 网络驱动器需要更长的延迟
        const delay = isNetworkDrive ? 1000 * (attempt + 1) : 500 * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ 删除最终出错: ${filePath}`, lastError.message);
        return { success: false, error: `删除文件失败 (重试${retryCount}次后): ${lastError.message}` };
      }
    }
  }

  return { success: false, error: `删除文件失败: ${lastError?.message || '未知错误'}` };
}

// 获取文件统计信息
export async function getFileStats(filePath: string): Promise<any> {
  if (!isElectronEnvironment()) {
    throw new Error('此功能仅在桌面应用中可用');
  }

  try {
    const result = await window.electronAPI.getFileStats(filePath);

    if (!result.success) {
      throw new Error(result.error || '获取文件信息失败');
    }

    return result.stats;
  } catch (error) {
    throw new Error(`获取文件信息失败: ${(error as Error).message}`);
  }
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取平台信息
export function getPlatformInfo(): { platform: string; version: string } | null {
  if (!isElectronEnvironment()) {
    return null;
  }

  return {
    platform: window.electronAPI.platform,
    version: window.electronAPI.version,
  };
}