import { FileInfo, DuplicateGroup, ScanConfig, FolderStructure, FileTypeConfig, EnabledFileType } from '../types';

// 默认文件类型配置
export const DEFAULT_FILE_TYPES: FileTypeConfig = {
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
  video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']
};

// 获取文件类型
export const getFileType = (extension: string): FileInfo['type'] => {
  const ext = extension.toLowerCase();
  if (DEFAULT_FILE_TYPES.audio.includes(ext)) return 'audio';
  if (DEFAULT_FILE_TYPES.video.includes(ext)) return 'video';
  if (DEFAULT_FILE_TYPES.image.includes(ext)) return 'image';
  if (DEFAULT_FILE_TYPES.document.includes(ext)) return 'document';
  if (DEFAULT_FILE_TYPES.archive.includes(ext)) return 'archive';
  return 'other';
};

// 进度信息接口
export interface ProgressInfo {
  progress: number;
  currentPath: string;
  processedFiles: number;
  totalFiles: number;
  scanSpeed: number;
  phase: 'counting' | 'scanning' | 'completed' | 'error';
  estimatedTimeRemaining: number;
}

// 扫描选项接口
export interface ScanOptions {
  skipCounting?: boolean; // 跳过文件计数阶段，直接开始扫描
  fastMode?: boolean; // 快速模式，减少文件详细信息获取
}

// 优化的文件系统扫描API（支持多目录，准确进度，高性能）
export const scanDirectories = async (
  directoryPaths: string[],
  config: ScanConfig,
  onProgress?: (progressInfo: ProgressInfo) => void,
  options: ScanOptions = {}
): Promise<{ files: FileInfo[]; folderStructures: FolderStructure[] }> => {
  console.log('🔍 开始扫描目录:', directoryPaths);
  console.log('📋 扫描配置:', config);

  const startTime = Date.now();
  const allFiles: FileInfo[] = [];
  const folderStructures: FolderStructure[] = [];

  let totalFileCount = 0;

  if (!options.skipCounting) {
    // 第一阶段：快速统计总文件数（用于准确进度计算）
    console.log('📊 第一阶段：统计文件总数...');
    onProgress?.({
      progress: 5,
      currentPath: '正在统计文件总数...',
      processedFiles: 0,
      totalFiles: 0,
      scanSpeed: 0,
      phase: 'counting',
      estimatedTimeRemaining: 0
    });

    totalFileCount = await countTotalFiles(directoryPaths, config, (currentDir, foundFiles) => {
      onProgress?.({
        progress: 5 + (foundFiles / Math.max(foundFiles + 100, 1000)) * 10, // 5-15%用于计数阶段
        currentPath: `正在统计: ${currentDir}`,
        processedFiles: foundFiles,
        totalFiles: foundFiles,
        scanSpeed: 0,
        phase: 'counting',
        estimatedTimeRemaining: 0
      });
    });
    console.log(`📈 统计完成，预计需要处理 ${totalFileCount} 个文件`);

    if (totalFileCount === 0) {
      console.log('⚠️ 未发现任何文件');
      return { files: [], folderStructures: [] };
    }
  } else {
    console.log('⚡ 快速模式：跳过文件计数，直接开始扫描');
    totalFileCount = 1000; // 预估值，用于进度计算
  }

  // 第二阶段：并行扫描文件
  console.log('🚀 第二阶段：开始并行扫描文件...');
  let processedCount = 0;
  const BATCH_SIZE = 50; // 批量处理大小
  let lastProgressTime = Date.now(); // 用于控制进度更新频率

  // 并行扫描所有目录
  const scanPromises = directoryPaths.map(async (dirPath, index) => {
    console.log(`🎯 开始扫描目录 ${index + 1}/${directoryPaths.length}: ${dirPath}`);

    try {
      const { files: dirFiles, structure } = await scanDirectoryOptimized(
        dirPath,
        config,
        (processed, currentFile) => {
          processedCount += processed;

          // 计算扫描速度（文件/秒）- 添加防除零检查
          const elapsed = Math.max((Date.now() - startTime) / 1000, 0.1); // 至少0.1秒防止除零
          const speed = Math.max(processedCount / elapsed, 0); // 确保速度不为负数

          // 计算进度
          let progress: number;
          if (options.skipCounting) {
            // 快速模式：0-85%用于文件扫描
            progress = Math.min(85, (processedCount / Math.max(totalFileCount, processedCount)) * 85);
          } else {
            // 正常模式：15-85%用于文件扫描
            progress = Math.min(85, 15 + (processedCount / Math.max(totalFileCount, 1)) * 70);
          }

          // 计算预估剩余时间 - 改进计算逻辑
          const remainingFiles = Math.max(0, totalFileCount - processedCount);
          const estimatedTimeRemaining = speed > 0.1 ? Math.ceil(remainingFiles / speed) : 0;

          // 动态更新总文件数（快速模式下）
          if (options.skipCounting && processedCount > totalFileCount * 0.8) {
            totalFileCount = Math.max(totalFileCount, Math.ceil(processedCount * 1.2));
          }

          // 提高进度更新频率 - 每5个文件或每200ms更新一次
          const now = Date.now();
          if (processedCount % 5 === 0 || processedCount === totalFileCount || now - lastProgressTime > 200) {
            lastProgressTime = now;
            onProgress?.({
              progress: Math.max(0, Math.min(85, progress)),
              currentPath: currentFile,
              processedFiles: processedCount,
              totalFiles: options.skipCounting ? Math.max(totalFileCount, processedCount) : totalFileCount,
              scanSpeed: Math.round(Math.max(speed, 0)),
              phase: 'scanning',
              estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining)
            });
          }
        }
      );

      allFiles.push(...dirFiles);
      folderStructures.push(structure);

      console.log(`✅ 目录 ${dirPath} 扫描完成，发现 ${dirFiles.length} 个有效文件`);
      return dirFiles.length;
    } catch (error) {
      console.error(`❌ 扫描目录失败: ${dirPath}`, error);
      return 0;
    }
  });

  // 等待所有目录扫描完成
  const results = await Promise.all(scanPromises);
  const totalScannedFiles = results.reduce((sum, count) => sum + count, 0);

  const scanTime = (Date.now() - startTime) / 1000;
  console.log(`🎉 扫描完成！总共发现 ${allFiles.length} 个有效文件，耗时 ${scanTime.toFixed(2)} 秒`);
  console.log('📊 文件类型统计:', getFileTypeStats(allFiles));
  console.log(`⚡ 平均扫描速度: ${Math.round(totalScannedFiles / scanTime)} 文件/秒`);

  // 文件扫描完成，更新进度到90%（为重复文件分析预留空间）
  onProgress?.({
    progress: 90,
    currentPath: '文件扫描完成，准备分析重复文件...',
    processedFiles: totalFileCount,
    totalFiles: totalFileCount,
    scanSpeed: Math.round(totalScannedFiles / scanTime),
    phase: 'scanning',
    estimatedTimeRemaining: 0
  });

  return {
    files: allFiles,
    folderStructures
  };
};

// 快速统计总文件数（优化版本，提供实时进度）
const countTotalFiles = async (
  directoryPaths: string[],
  config: ScanConfig,
  onProgress?: (currentDir: string, foundFiles: number) => void
): Promise<number> => {
  let totalCount = 0;
  let lastProgressUpdate = Date.now();
  const PROGRESS_UPDATE_INTERVAL = 100; // 降低到100ms更新一次

  const countInDirectory = async (dirPath: string, maxDepth: number, currentDepth = 0): Promise<number> => {
    if (currentDepth >= maxDepth) return 0;

    // 检查目录是否被排除
    const isExcluded = config.excludedDirectories.some(excludedDir =>
      dirPath.toLowerCase().includes(excludedDir.toLowerCase())
    );
    if (isExcluded) return 0;

    try {
      // 增加进度更新频率
      const now = Date.now();
      if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
        onProgress?.(dirPath, totalCount);
        lastProgressUpdate = now;
      }

      const entries = await getDirectoryEntriesOptimized(dirPath);
      let count = 0;

      // 先统计当前目录的文件
      const fileEntries = entries.filter(e => !e.isDirectory);
      for (const entry of fileEntries) {
        if (shouldCountFile(entry.name, config)) {
          count++;
          totalCount++; // 实时更新总数

          // 每100个文件更新一次进度
          if (count % 100 === 0) {
            onProgress?.(dirPath, totalCount);
          }
        }
      }

      // 并行递归统计子目录（限制并发数量避免过多资源占用）
      const dirEntries = entries.filter(e => e.isDirectory);
      const BATCH_SIZE = 5; // 同时处理5个子目录

      for (let i = 0; i < dirEntries.length; i += BATCH_SIZE) {
        const batch = dirEntries.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(dirEntry =>
          countInDirectory(dirEntry.path, maxDepth, currentDepth + 1)
        );

        const batchResults = await Promise.all(batchPromises);
        const batchTotal = batchResults.reduce((sum, result) => sum + result, 0);
        count += batchTotal;

        // 更新进度
        onProgress?.(dirPath, totalCount);
      }

      return count;
    } catch (error) {
      console.error(`❌ 统计目录失败: ${dirPath}`, error);
      return 0;
    }
  };

  // 并行统计多个根目录
  const rootPromises = directoryPaths.map(async (dirPath) => {
    try {
      const count = await countInDirectory(dirPath, config.maxDepth);
      console.log(`📊 目录 ${dirPath} 统计完成，发现 ${count} 个文件`);
      return count;
    } catch (error) {
      console.error(`❌ 统计根目录失败: ${dirPath}`, error);
      return 0;
    }
  });

  const results = await Promise.all(rootPromises);
  const finalTotal = results.reduce((sum, count) => sum + count, 0);

  return finalTotal;
};

// 快速检查文件是否应该被计入总数
const shouldCountFile = (fileName: string, config: ScanConfig): boolean => {
  const extension = '.' + fileName.split('.').pop()?.toLowerCase() || '';
  const fileType = getFileType(extension);

  // 检查文件类型是否启用
  if (fileType === 'other' || !config.enabledTypes.includes(fileType as EnabledFileType)) {
    return false;
  }

  // 检查文件格式
  const supportedFormats = config.enabledTypes.flatMap(type => config.fileTypes[type]);
  return supportedFormats.includes(extension);
};

// 优化的目录扫描函数
const scanDirectoryOptimized = async (
  dirPath: string,
  config: ScanConfig,
  onProgress?: (processed: number, currentFile: string) => void
): Promise<{ files: FileInfo[]; structure: FolderStructure }> => {
  const files: FileInfo[] = [];
  let processedInThisDir = 0;

  const scanRecursive = async (currentPath: string, maxDepth: number, currentDepth = 0): Promise<FileInfo[]> => {
    if (currentDepth >= maxDepth) return [];

    // 检查目录是否被排除
    const isExcluded = config.excludedDirectories.some(excludedDir =>
      currentPath.toLowerCase().includes(excludedDir.toLowerCase())
    );
    if (isExcluded) return [];

    try {
      const entries = await getDirectoryEntriesOptimized(currentPath);
      const dirFiles: FileInfo[] = [];

      // 分离文件和目录
      const fileEntries = entries.filter(e => !e.isDirectory);
      const dirEntries = entries.filter(e => e.isDirectory);

      // 并行处理文件（批量处理以提高性能）
      const BATCH_SIZE = 20;
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        const batch = fileEntries.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (entry) => {
          try {
            const fileInfo = await processFileOptimized(entry);
            if (fileInfo && shouldIncludeFile(fileInfo, config)) {
              return fileInfo;
            }
          } catch (error) {
            console.error(`❌ 处理文件失败: ${entry.path}`, error);
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        const validFiles = batchResults.filter(f => f !== null) as FileInfo[];
        dirFiles.push(...validFiles);

        // 更新进度
        processedInThisDir += batch.length;
        onProgress?.(batch.length, batch[batch.length - 1]?.path || '');
      }

      // 递归处理子目录
      for (const dirEntry of dirEntries) {
        const subFiles = await scanRecursive(dirEntry.path, maxDepth, currentDepth + 1);
        dirFiles.push(...subFiles);
      }

      return dirFiles;
    } catch (error) {
      console.error(`❌ 扫描目录失败: ${currentPath}`, error);
      return [];
    }
  };

  const scannedFiles = await scanRecursive(dirPath, config.maxDepth);

  return {
    files: scannedFiles,
    structure: await generateFolderStructure(dirPath, 0)
  };
};

// 优化的目录条目获取（生成更真实的重复文件数据）
const getDirectoryEntriesOptimized = async (dirPath: string): Promise<Array<{ path: string, name: string, isDirectory: boolean }>> => {
  try {
    console.log(`📂 正在扫描目录: ${dirPath}`);
    const entries: Array<{ path: string, name: string, isDirectory: boolean }> = [];

    // 根据目录路径生成更真实的文件结构
    const dirName = dirPath.split(/[/\\]/).pop()?.toLowerCase() || '';
    const pathDepth = dirPath.split(/[/\\]/).length;

    // 生成重复文件的基础名称
    const baseNames = [
      'Document', 'Photo', 'Music', 'Video', 'File', 'Data', 'Backup', 'Report',
      'Image', 'Audio', 'Movie', 'Song', 'Picture', 'Text', 'Archive'
    ];

    // 根据目录类型确定文件扩展名
    let extensions: string[] = [];
    if (dirName.includes('music') || dirName.includes('audio')) {
      extensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac'];
    } else if (dirName.includes('video') || dirName.includes('movie')) {
      extensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv'];
    } else if (dirName.includes('photo') || dirName.includes('picture') || dirName.includes('image')) {
      extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    } else if (dirName.includes('document') || dirName.includes('doc')) {
      extensions = ['.pdf', '.docx', '.xlsx', '.txt', '.pptx'];
    } else {
      // 混合类型
      extensions = ['.mp3', '.jpg', '.pdf', '.mp4', '.docx', '.png', '.txt'];
    }

    // 生成文件（确保有重复文件）
    const numFiles = Math.min(15 + Math.floor(Math.random() * 10), 25); // 15-25个文件
    const generatedFiles = new Set<string>();

    for (let i = 0; i < numFiles; i++) {
      const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
      const extension = extensions[Math.floor(Math.random() * extensions.length)];
      const fileName = `${baseName}${i + 1}${extension}`;

      // 添加原始文件
      if (!generatedFiles.has(fileName)) {
        entries.push({
          path: `${dirPath}/${fileName}`,
          name: fileName,
          isDirectory: false
        });
        generatedFiles.add(fileName);

        // 30%概率生成重复文件
        if (Math.random() < 0.3) {
          const duplicateVariants = [
            `${baseName}${i + 1}_copy${extension}`,
            `${baseName}${i + 1}_backup${extension}`,
            `${baseName}${i + 1} (2)${extension}`,
            `Copy of ${baseName}${i + 1}${extension}`
          ];

          const duplicateName = duplicateVariants[Math.floor(Math.random() * duplicateVariants.length)];
          if (!generatedFiles.has(duplicateName)) {
            entries.push({
              path: `${dirPath}/${duplicateName}`,
              name: duplicateName,
              isDirectory: false
            });
            generatedFiles.add(duplicateName);
          }
        }

        // 15%概率生成同名但不同扩展名的文件
        if (Math.random() < 0.15 && extensions.length > 1) {
          const altExtension = extensions.find(ext => ext !== extension);
          if (altExtension) {
            const altFileName = `${baseName}${i + 1}${altExtension}`;
            if (!generatedFiles.has(altFileName)) {
              entries.push({
                path: `${dirPath}/${altFileName}`,
                name: altFileName,
                isDirectory: false
              });
              generatedFiles.add(altFileName);
            }
          }
        }
      }
    }

    // 添加子目录（深度限制）
    if (pathDepth < 4) {
      const subDirNames = ['Backup', 'Archive', 'New', 'Old', '2023', '2024', 'Temp'];
      const numSubDirs = Math.floor(Math.random() * 3) + 1; // 1-3个子目录

      for (let i = 0; i < numSubDirs; i++) {
        const subDirName = subDirNames[Math.floor(Math.random() * subDirNames.length)];
        const uniqueSubDirName = `${subDirName}_${i + 1}`;
        entries.push({
          path: `${dirPath}/${uniqueSubDirName}`,
          name: uniqueSubDirName,
          isDirectory: true
        });
      }
    }

    console.log(`✅ 目录 ${dirPath} 包含 ${entries.filter(e => !e.isDirectory).length} 个文件，${entries.filter(e => e.isDirectory).length} 个子目录`);
    return entries;
  } catch (error) {
    console.error(`❌ 读取目录失败: ${dirPath}`, error);
    return [];
  }
};

// 根据目录类型获取文件模板
const getFileTemplatesForDirectory = (dirName: string): Array<{ baseName: string, extension: string }> => {
  if (dirName.includes('music') || dirName.includes('audio')) {
    return [
      { baseName: 'song', extension: '.mp3' },
      { baseName: 'track', extension: '.flac' },
      { baseName: 'audio', extension: '.wav' },
      { baseName: 'music', extension: '.m4a' }
    ];
  }

  if (dirName.includes('video') || dirName.includes('movie')) {
    return [
      { baseName: 'movie', extension: '.mp4' },
      { baseName: 'video', extension: '.avi' },
      { baseName: 'film', extension: '.mkv' },
      { baseName: 'clip', extension: '.mov' }
    ];
  }

  if (dirName.includes('picture') || dirName.includes('photo') || dirName.includes('image')) {
    return [
      { baseName: 'photo', extension: '.jpg' },
      { baseName: 'image', extension: '.png' },
      { baseName: 'picture', extension: '.jpeg' },
      { baseName: 'pic', extension: '.gif' }
    ];
  }

  if (dirName.includes('document') || dirName.includes('doc')) {
    return [
      { baseName: 'document', extension: '.pdf' },
      { baseName: 'file', extension: '.docx' },
      { baseName: 'report', extension: '.xlsx' },
      { baseName: 'text', extension: '.txt' }
    ];
  }

  // 默认混合文件类型
  return [
    { baseName: 'file', extension: '.mp3' },
    { baseName: 'data', extension: '.jpg' },
    { baseName: 'backup', extension: '.pdf' },
    { baseName: 'item', extension: '.mp4' }
  ];
};

// 优化的文件处理函数
const processFileOptimized = async (entry: { path: string, name: string, isDirectory: boolean }): Promise<FileInfo | null> => {
  try {
    const fileName = entry.name;
    const filePath = entry.path;
    const extension = '.' + fileName.split('.').pop()?.toLowerCase() || '';
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    const fileType = getFileType(extension);

    // 优化的文件统计信息获取（减少延迟）
    const stats = await getFileStatsOptimized(filePath, extension);

    const fileInfo: FileInfo = {
      id: generateId(),
      name: nameWithoutExt,
      path: filePath,
      size: stats.size,
      format: extension,
      type: fileType,
      lastModified: stats.lastModified,
      directory: filePath.substring(0, filePath.lastIndexOf('/')),
      createdAt: stats.createdAt
    };

    // 根据文件类型添加特定属性（优化性能）
    if (fileType === 'audio') {
      fileInfo.bitrate = getRandomBitrate(extension);
      fileInfo.duration = getRandomDuration();
    } else if (fileType === 'video') {
      fileInfo.resolution = getRandomResolution();
      fileInfo.frameRate = getRandomFrameRate();
      fileInfo.duration = getRandomDuration();
    } else if (fileType === 'image') {
      const resolution = getRandomImageResolution();
      fileInfo.width = resolution.width;
      fileInfo.height = resolution.height;
    }

    return fileInfo;
  } catch (error) {
    console.error(`❌ 处理文件失败: ${entry.path}`, error);
    return null;
  }
};

// 快速的文件统计信息获取（无延迟，高性能）
const getFileStatsOptimized = async (filePath: string, extension: string): Promise<{ size: number, lastModified: Date, createdAt: Date }> => {
  // 移除所有延迟，直接返回结果

  // 根据文件扩展名生成合理的文件大小
  let size = 1024; // 默认1KB

  switch (extension) {
    case '.mp3':
      size = Math.random() * 10 * 1024 * 1024; // 0-10MB
      break;
    case '.flac':
      size = Math.random() * 50 * 1024 * 1024; // 0-50MB
      break;
    case '.wav':
      size = Math.random() * 100 * 1024 * 1024; // 0-100MB
      break;
    case '.mp4':
    case '.avi':
    case '.mkv':
      size = Math.random() * 2 * 1024 * 1024 * 1024; // 0-2GB
      break;
    case '.jpg':
    case '.png':
    case '.jpeg':
      size = Math.random() * 20 * 1024 * 1024; // 0-20MB
      break;
    case '.pdf':
      size = Math.random() * 50 * 1024 * 1024; // 0-50MB
      break;
    case '.docx':
      size = Math.random() * 10 * 1024 * 1024; // 0-10MB
      break;
    default:
      size = Math.random() * 1024 * 1024; // 0-1MB
  }

  const now = new Date();
  const lastModified = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000); // 过去一年内
  const createdAt = new Date(lastModified.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // 创建时间早于修改时间

  return {
    size: Math.floor(size),
    lastModified,
    createdAt
  };
};

// 检查是否应该包含文件
const shouldIncludeFile = (file: FileInfo, config: ScanConfig): boolean => {
  // 检查文件类型是否启用
  if (file.type === 'other' || !config.enabledTypes.includes(file.type as EnabledFileType)) {
    return false;
  }

  // 检查文件格式
  const supportedFormats = config.enabledTypes.flatMap(type => config.fileTypes[type]);
  if (!supportedFormats.includes(file.format)) {
    return false;
  }

  // 检查文件大小
  if (file.size < config.minFileSize || file.size > config.maxFileSize) {
    return false;
  }

  return true;
};

// 生成文件夹结构
const generateFolderStructure = async (directoryPath: string, index: number): Promise<FolderStructure> => {
  return {
    id: `root-${index}`,
    name: directoryPath.split('/').pop() || directoryPath,
    path: directoryPath,
    type: 'directory',
    children: [] // 简化实现，实际应该递归生成完整结构
  };
};

// 获取文件类型统计
const getFileTypeStats = (files: FileInfo[]): Record<string, number> => {
  const stats: Record<string, number> = {};
  files.forEach(file => {
    stats[file.type] = (stats[file.type] || 0) + 1;
  });
  return stats;
};

// 辅助函数：生成随机音频属性
const getRandomBitrate = (extension: string): number => {
  switch (extension) {
    case '.flac': return 1411;
    case '.wav': return 1411;
    case '.mp3': return Math.random() > 0.5 ? 320 : 192;
    default: return 128;
  }
};

const getRandomDuration = (): number => {
  return Math.floor(Math.random() * 300) + 60; // 1-6分钟
};

const getRandomResolution = (): string => {
  const resolutions = ['1920x1080', '1280x720', '3840x2160', '1366x768'];
  return resolutions[Math.floor(Math.random() * resolutions.length)];
};

const getRandomFrameRate = (): number => {
  const frameRates = [24, 30, 60];
  return frameRates[Math.floor(Math.random() * frameRates.length)];
};

const getRandomImageResolution = (): { width: number, height: number } => {
  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 3840, height: 2160 },
    { width: 1366, height: 768 }
  ];
  return resolutions[Math.floor(Math.random() * resolutions.length)];
};

// 优化的重复文件查找（支持多种匹配策略）
export const findDuplicates = async (files: FileInfo[], onProgress?: (progress: number) => void): Promise<DuplicateGroup[]> => {
  console.log('🔍 开始查找重复文件，总文件数:', files.length);
  const startTime = Date.now();

  onProgress?.(90);

  // 添加初始延迟，模拟真实的分析过程
  await new Promise(resolve => setTimeout(resolve, 200));

  // 使用 Map 提高性能
  const duplicateMap = new Map<string, FileInfo[]>();
  const nameVariationMap = new Map<string, Set<string>>(); // 用于检测名称变体

  // 第一遍：按精确文件名分组
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const key = file.name.toLowerCase().trim();
    if (!duplicateMap.has(key)) {
      duplicateMap.set(key, []);
    }
    duplicateMap.get(key)!.push(file);

    // 更新进度 - 90-93%，添加适当延迟
    if (index % 100 === 0) {
      const progress = 90 + (index / files.length) * 3;
      onProgress?.(Math.min(93, progress));
      // 每处理100个文件暂停1ms，模拟真实处理时间
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  console.log('📊 精确文件名分组完成，共', duplicateMap.size, '个不同的文件名');
  onProgress?.(93);
  await new Promise(resolve => setTimeout(resolve, 100));

  // 第二遍：检测相似文件名（去除常见后缀如 _copy, _backup, (1), (2) 等）
  const similarNameMap = new Map<string, FileInfo[]>();

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const normalizedName = normalizeName(file.name);
    if (!similarNameMap.has(normalizedName)) {
      similarNameMap.set(normalizedName, []);
    }
    similarNameMap.get(normalizedName)!.push(file);

    // 更新进度 - 93-95%，添加适当延迟
    if (index % 100 === 0) {
      const progress = 93 + (index / files.length) * 2;
      onProgress?.(Math.min(95, progress));
      // 每处理100个文件暂停1ms
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  console.log('📊 相似文件名分组完成，共', similarNameMap.size, '个标准化文件名');
  onProgress?.(95);
  await new Promise(resolve => setTimeout(resolve, 150));

  // 合并结果，优先使用相似名称分组（更全面）
  const finalMap = new Map<string, FileInfo[]>();

  // 先添加相似名称分组
  similarNameMap.forEach((files, normalizedName) => {
    if (files.length > 1) {
      finalMap.set(normalizedName, files);
    }
  });

  // 再添加精确名称分组中未被包含的项
  duplicateMap.forEach((files, exactName) => {
    if (files.length > 1) {
      const normalizedName = normalizeName(exactName);
      if (!finalMap.has(normalizedName)) {
        finalMap.set(exactName, files);
      }
    }
  });

  // 生成重复文件组
  const duplicateGroups: DuplicateGroup[] = [];
  let groupIndex = 1;
  let processedGroups = 0;
  const totalGroups = Array.from(finalMap.values()).filter(files => files.length > 1).length;

  for (const [name, groupFiles] of finalMap) {
    if (groupFiles.length > 1) {
      console.log(`🔄 发现重复文件组: "${name}" (${groupFiles.length} 个文件)`);

      // 多重排序：先按质量，再按大小，最后按修改时间
      const sortedFiles = groupFiles.sort((a, b) => {
        // 1. 按文件质量排序（高质量优先）
        const qualityA = getFileQuality(a);
        const qualityB = getFileQuality(b);
        const qualityOrder = { 'high': 3, 'medium': 2, 'low': 1 };

        if (qualityOrder[qualityA] !== qualityOrder[qualityB]) {
          return qualityOrder[qualityB] - qualityOrder[qualityA];
        }

        // 2. 按文件大小排序（大文件优先）
        if (Math.abs(a.size - b.size) > 1024) { // 大小差异超过1KB才考虑
          return b.size - a.size;
        }

        // 3. 按修改时间排序（新文件优先）
        return b.lastModified.getTime() - a.lastModified.getTime();
      });

      duplicateGroups.push({
        id: `group-${groupIndex++}`,
        name: name,
        baseName: name,
        files: sortedFiles,
        totalSize: sortedFiles.reduce((sum, file) => sum + file.size, 0),
        count: sortedFiles.length,
        fileType: sortedFiles[0].type,
        potentialSavings: 0 // 临时设为0，将在下面计算
      });

      processedGroups++;
      // 更新进度 - 95-99%，添加适当延迟
      if (processedGroups % 5 === 0 || processedGroups === totalGroups) {
        const progress = 95 + (processedGroups / Math.max(totalGroups, 1)) * 4;
        onProgress?.(Math.min(99, progress));
        // 每处理5个重复组暂停2ms
        await new Promise(resolve => setTimeout(resolve, 2));
      }
    }
  }

  // 按重复文件数量和总大小排序
  duplicateGroups.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count; // 重复数量多的优先
    }
    return b.totalSize - a.totalSize; // 总大小大的优先
  });

  const processingTime = (Date.now() - startTime) / 1000;
  console.log(`✅ 重复文件检测完成！发现 ${duplicateGroups.length} 个重复文件组，耗时 ${processingTime.toFixed(2)} 秒`);

  // 统计信息
  const totalDuplicateFiles = duplicateGroups.reduce((sum, group) => sum + group.count, 0);
  const totalWastedSpace = duplicateGroups.reduce((sum, group) => {
    // 计算浪费的空间（保留最大的文件，其他都是浪费）
    const sortedBySize = [...group.files].sort((a, b) => b.size - a.size);
    return sum + sortedBySize.slice(1).reduce((waste, file) => waste + file.size, 0);
  }, 0);

  console.log(`📊 重复文件统计:`);
  console.log(`   - 重复文件组数: ${duplicateGroups.length}`);
  console.log(`   - 重复文件总数: ${totalDuplicateFiles}`);
  console.log(`   - 浪费空间: ${formatFileSize(totalWastedSpace)}`);

  duplicateGroups.forEach(group => {
    console.log(`   - "${group.name}": ${group.count} 个文件，总大小 ${formatFileSize(group.totalSize)}`);
  });

  // 显示99%进度并添加最终延迟，让用户能看到接近完成的状态
  onProgress?.(99);
  await new Promise(resolve => setTimeout(resolve, 300));

  // 完成！
  onProgress?.(100);

  return duplicateGroups;
};

// 标准化文件名（去除常见的重复标识符）
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    // 去除常见的重复后缀
    .replace(/[_\s-]*(copy|backup|duplicate|副本|备份|拷贝)\d*$/i, '')
    // 去除括号中的数字 (1), (2), etc.
    .replace(/\s*\(\d+\)$/, '')
    // 去除下划线和数字后缀 _1, _2, etc.
    .replace(/[_\s-]+\d+$/, '')
    // 去除 - Copy 等
    .replace(/[_\s-]+(copy|副本)$/i, '')
    // 标准化空白字符
    .replace(/\s+/g, ' ')
    .trim();
};

// 获取文件质量评分
export const getFileQuality = (file: FileInfo): 'high' | 'medium' | 'low' => {
  if (file.format === '.flac' || file.format === '.wav') {
    return 'high';
  }

  if (file.bitrate && file.bitrate >= 320) {
    return 'high';
  }

  if (file.bitrate && file.bitrate >= 192) {
    return 'medium';
  }

  return 'low';
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化持续时间
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// 生成唯一ID
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// 模拟文件删除
export const deleteFile = async (filePath: string): Promise<boolean> => {
  console.log('🗑️ 删除文件:', filePath);
  // 模拟删除延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟删除成功率（95%）
  const success = Math.random() > 0.05;
  console.log(success ? '✅ 删除成功' : '❌ 删除失败:', filePath);
  return success;
};

// 批量删除文件
export const deleteFiles = async (
  filePaths: string[],
  onProgress?: (completed: number, total: number, currentFile: string) => void
): Promise<{ success: string[]; failed: string[] }> => {
  console.log('🗑️ 开始批量删除文件，总数:', filePaths.length);

  const success: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    onProgress?.(i, filePaths.length, filePath);

    const result = await deleteFile(filePath);
    if (result) {
      success.push(filePath);
    } else {
      failed.push(filePath);
    }
  }

  onProgress?.(filePaths.length, filePaths.length, '');

  console.log(`✅ 批量删除完成！成功: ${success.length}, 失败: ${failed.length}`);

  return { success, failed };
};