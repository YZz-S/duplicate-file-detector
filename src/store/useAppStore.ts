import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, ScanConfig, DuplicateGroup, DeleteRecord, FolderStructure, FileInfo, DeleteStatus } from '../types';
import { scanDirectories, findDuplicates, DEFAULT_FILE_TYPES } from '../utils/fileScanner';
import { 
  isElectronEnvironment, 
  scanDirectory as electronScanDirectory, 
  findDuplicates as electronFindDuplicates,
  deleteFile as electronDeleteFile,
  type ScanMode 
} from '../utils/electronFileScanner';
import { toast } from 'sonner';

// 默认扫描配置
const defaultScanConfig: ScanConfig = {
  maxDepth: 10,
  minFileSize: 1024, // 1KB
  maxFileSize: 1024 * 1024 * 1024, // 1GB
  fileTypes: DEFAULT_FILE_TYPES,
  enabledTypes: ['audio', 'video', 'image', 'document', 'archive'],
  excludedDirectories: ['node_modules', '.git', 'System Volume Information', '$RECYCLE.BIN'],
  // 删除延时配置
  enableDelayedDelete: false,
  delayBetweenFiles: 1000 // 默认1秒
};

const defaultDeleteStatus: DeleteStatus = {
  isDeleting: false,
  isPaused: false,
  isCancelled: false,
  current: 0,
  total: 0,
  currentFile: '',
  progress: 0
};

// 生成唯一ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};



// 检测是否为开发环境
const isDevelopment = import.meta.env.DEV;

export const useAppStore = create<AppState>()(persist(
  (set, get) => ({
    // 初始状态
    selectedDirectories: [],
    scanConfig: defaultScanConfig,
    scanStatus: {
      isScanning: false,
      progress: 0,
      currentPath: '',
      totalFiles: 0,
      processedFiles: 0,
      scanSpeed: 0,
      phase: 'completed',
      estimatedTimeRemaining: 0,
      errors: [],
      totalErrors: 0
    },
    deleteStatus: defaultDeleteStatus,
    duplicateGroups: [],
    deleteHistory: [],
    folderStructures: [],
    currentPage: 'home',
    selectedGroup: null,

    // 操作方法
    setSelectedDirectories: (paths: string[]) => {
      set({ selectedDirectories: paths });
    },

    addDirectory: (path: string) => {
      set(state => {
        if (!state.selectedDirectories.includes(path)) {
          return { selectedDirectories: [...state.selectedDirectories, path] };
        }
        return state;
      });
    },

    removeDirectory: (path: string) => {
      set(state => ({
        selectedDirectories: state.selectedDirectories.filter(dir => dir !== path)
      }));
    },

    updateScanConfig: (config: Partial<ScanConfig>) => {
      set(state => ({
        scanConfig: { 
          ...state.scanConfig, 
          ...config,
          enabledTypes: config.enabledTypes || state.scanConfig.enabledTypes || defaultScanConfig.enabledTypes,
          fileTypes: config.fileTypes || state.scanConfig.fileTypes || defaultScanConfig.fileTypes
        }
      }));
    },

    startScan: async (fastMode = false, scanMode: ScanMode = 'content') => {
      const { selectedDirectories, scanConfig } = get();
      const scanStartTime = Date.now();
      
      if (selectedDirectories.length === 0) {
        toast.error('请先选择要扫描的目录');
        return;
      }

      // 立即显示扫描状态和加载提示
      set(state => ({
        scanStatus: {
          ...state.scanStatus,
          isScanning: true,
          progress: 0,
          currentPath: fastMode ? '快速扫描模式启动...' : '正在初始化扫描...',
          totalFiles: 0,
          processedFiles: 0,
          scanSpeed: 0,
          phase: fastMode ? 'scanning' : 'counting',
          estimatedTimeRemaining: 0
        },
        duplicateGroups: []
      }));

      // 显示开始扫描的提示
      const modeText = fastMode ? '（快速模式）' : '';
      const envText = isElectronEnvironment() ? '（桌面应用）' : '（Web演示）';
      toast.info(`开始扫描文件${modeText}${envText}，请稍候...`);

      try {
        // 添加小延迟确保UI更新
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let allFiles: FileInfo[] = [];
        let folderStructures: FolderStructure[] = [];
        
        if (isElectronEnvironment()) {
          // Electron环境：使用真实文件扫描
          console.log('🖥️ 使用Electron文件扫描');
          
          for (let i = 0; i < selectedDirectories.length; i++) {
            const directory = selectedDirectories[i];
            
            set(state => ({
              scanStatus: {
                ...state.scanStatus,
                progress: (i / selectedDirectories.length) * 80,
                currentPath: `正在扫描: ${directory}`,
                phase: 'scanning'
              }
            }));
            
            const scanOptions = {
              maxDepth: scanConfig.maxDepth,
              excludeDirs: scanConfig.excludedDirectories,
              includeExtensions: scanConfig.enabledTypes?.flatMap(type => 
                scanConfig.fileTypes?.[type]?.map(ext => ext.toLowerCase()) || []
              ),
              maxFileSize: scanConfig.maxFileSize,
              minFileSize: scanConfig.minFileSize
            };
            
            const files = await electronScanDirectory(
              directory,
              scanOptions,
              (progress) => {
                set(state => ({
                  scanStatus: {
                    ...state.scanStatus,
                    currentPath: progress.currentPath,
                    processedFiles: progress.filesScanned,
                    totalFiles: progress.totalFiles || 0,
                    errors: progress.errors || [],
                    totalErrors: progress.totalErrors || 0
                  }
                }));
              }
            );
            
            allFiles.push(...files);
          }
          
          // 第三阶段：重复文件检测
          set(state => ({
            scanStatus: {
              ...state.scanStatus,
              progress: 85,
              currentPath: '正在分析重复文件...',
              phase: 'scanning'
            }
          }));
          
          const duplicateGroups = await electronFindDuplicates(allFiles, scanMode);
          
          console.log('🔍 Electron重复文件检测结果:', duplicateGroups.length, '个重复文件组');
          
          // 计算重复文件统计信息
          const totalDuplicateFiles = duplicateGroups.reduce((sum, group) => sum + group.files.length, 0);
          const wastedSpace = duplicateGroups.reduce((sum, group) => {
            const sortedFiles = [...group.files].sort((a, b) => b.size - a.size);
            return sum + sortedFiles.slice(1).reduce((groupSum, file) => groupSum + file.size, 0);
          }, 0);
          
          set(state => ({
            duplicateGroups,
            scanStatus: {
              ...state.scanStatus,
              isScanning: false,
              progress: 100,
              phase: 'completed'
            }
          }));
          
          // 如果有错误，显示错误统计
          const currentState = get();
          if (currentState.scanStatus.totalErrors > 0) {
            toast.warning(`扫描过程中遇到 ${currentState.scanStatus.totalErrors} 个错误，请查看详细信息`);
          }
          
          toast.success(`扫描完成${modeText}${envText}！找到 ${duplicateGroups.length} 组重复文件，共 ${totalDuplicateFiles} 个重复文件，浪费空间 ${formatFileSize(wastedSpace)}`);
          
          // 发送系统通知
          import('../utils/notifications').then(({ scanNotifications }) => {
            scanNotifications.scanCompleted(
              duplicateGroups.length,
              totalDuplicateFiles,
              formatFileSize(wastedSpace),
              (Date.now() - scanStartTime) / 1000
            );
          });
          
        } else {
          // Web环境：使用模拟数据
          console.log('🌐 使用Web模拟扫描');
          
          const result = await scanDirectories(
            selectedDirectories,
            scanConfig,
            (progressInfo) => {
              set(state => ({
                scanStatus: {
                  ...state.scanStatus,
                  progress: progressInfo.progress,
                  currentPath: progressInfo.currentPath || '扫描中...',
                  processedFiles: progressInfo.processedFiles || 0,
                  totalFiles: progressInfo.totalFiles || 0,
                  scanSpeed: progressInfo.scanSpeed || 0,
                  phase: progressInfo.phase || 'scanning',
                  estimatedTimeRemaining: progressInfo.estimatedTimeRemaining || 0
                }
              }));
            },
            {
              skipCounting: fastMode,
              fastMode: fastMode
            }
          );

          // 第三阶段：重复文件检测
          set(state => ({
            scanStatus: {
              ...state.scanStatus,
              progress: 85,
              currentPath: '正在分析重复文件...',
              phase: 'scanning'
            }
          }));
          
          const duplicateGroups = await electronFindDuplicates(allFiles, scanMode);
          
          console.log('🔍 Web重复文件检测结果:', duplicateGroups.length, '个重复文件组');
          
          // 计算重复文件统计信息
          const totalDuplicateFiles = duplicateGroups.reduce((sum, group) => sum + group.files.length, 0);
          const wastedSpace = duplicateGroups.reduce((sum, group) => {
            const sortedFiles = [...group.files].sort((a, b) => b.size - a.size);
            return sum + sortedFiles.slice(1).reduce((groupSum, file) => groupSum + file.size, 0);
          }, 0);
          
          set(state => ({
            duplicateGroups,
            folderStructures: [...result.folderStructures, ...state.folderStructures.slice(0, 9)],
            scanStatus: {
              ...state.scanStatus,
              isScanning: false,
              progress: 100,
              phase: 'completed'
            }
          }));

          const fileTypeStats = duplicateGroups.reduce((acc, group) => {
            acc[group.fileType] = (acc[group.fileType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const statsText = Object.entries(fileTypeStats)
            .map(([type, count]) => `${type}: ${count}组`)
            .join(', ');

          toast.success(`扫描完成${modeText}${envText}！找到 ${duplicateGroups.length} 组重复文件，共 ${totalDuplicateFiles} 个重复文件，浪费空间 ${formatFileSize(wastedSpace)} (${statsText})`);
          
          // 发送系统通知
          import('../utils/notifications').then(({ scanNotifications }) => {
            scanNotifications.scanCompleted(
              duplicateGroups.length,
              totalDuplicateFiles,
              formatFileSize(wastedSpace),
              (Date.now() - scanStartTime) / 1000
            );
          });
        }
      } catch (error) {
        set(state => ({
          scanStatus: {
            ...state.scanStatus,
            isScanning: false,
            phase: 'error'
          }
        }));
        toast.error('扫描失败：' + (error as Error).message);
      }
    },

    stopScan: () => {
      set(state => ({
        scanStatus: {
          ...state.scanStatus,
          isScanning: false
        }
      }));
      toast.info('扫描已停止');
    },

    pauseDelete: () => {
      set(state => ({
        deleteStatus: {
          ...state.deleteStatus,
          isPaused: true
        }
      }));
      toast.info('删除操作已暂停');
    },

    resumeDelete: () => {
      set(state => ({
        deleteStatus: {
          ...state.deleteStatus,
          isPaused: false
        }
      }));
      toast.info('删除操作已恢复');
    },

    cancelDelete: () => {
      set(state => ({
        deleteStatus: {
          ...state.deleteStatus,
          isCancelled: true,
          isPaused: false
        }
      }));
      toast.info('删除操作已取消');
    },

    deleteFiles: async (fileIds: string[], reason: string, options?: {
      delayBetweenFiles?: number;
      enableProgressCallback?: boolean;
      onProgress?: (progress: { current: number; total: number; currentFile: string }) => void;
    }) => {
      const { duplicateGroups } = get();
      const filesToDelete: FileInfo[] = [];
      
      // 收集要删除的文件
      duplicateGroups.forEach(group => {
        group.files.forEach(file => {
          if (fileIds.includes(file.id)) {
            filesToDelete.push(file);
          }
        });
      });

      if (filesToDelete.length === 0) {
        toast.error('没有找到要删除的文件');
        return;
      }

      // 初始化删除状态
      set(state => ({
        deleteStatus: {
          ...state.deleteStatus,
          isDeleting: true,
          isPaused: false,
          isCancelled: false,
          current: 0,
          total: filesToDelete.length,
          currentFile: '',
          progress: 0
        }
      }));

      const delayBetweenFiles = options?.delayBetweenFiles || 0;
      const enableProgressCallback = options?.enableProgressCallback || false;
      const onProgress = options?.onProgress;

      try {
        if (isElectronEnvironment()) {
          // Electron环境：真实删除文件（支持暂停/取消）
          console.log('🗑️ 使用Electron删除文件:', filesToDelete.map(f => f.path));
          console.log(`⏱️ 删除延时设置: ${delayBetweenFiles}ms`);
          
          for (let i = 0; i < filesToDelete.length; i++) {
            const file = filesToDelete[i];
            
            // 检查是否被取消
            const currentState = get();
            if (currentState.deleteStatus.isCancelled) {
              console.log('🛑 删除操作被取消');
              break;
            }
            
            // 检查是否暂停
            while (get().deleteStatus.isPaused && !get().deleteStatus.isCancelled) {
              console.log('⏸️ 删除操作已暂停，等待恢复...');
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // 再次检查是否被取消（暂停期间可能被取消）
            if (get().deleteStatus.isCancelled) {
              console.log('🛑 删除操作被取消');
              break;
            }
            
            // 更新当前删除状态
            set(state => ({
              deleteStatus: {
                ...state.deleteStatus,
                current: i + 1,
                currentFile: file.name,
                progress: ((i + 1) / filesToDelete.length) * 100
              }
            }));
            
            // 更新进度回调
            if (enableProgressCallback && onProgress) {
              onProgress({
                current: i + 1,
                total: filesToDelete.length,
                currentFile: file.name
              });
            }
            
            try {
              const deleteResult = await electronDeleteFile(file.path);
              
              if (deleteResult.success) {
                const method = deleteResult.method === 'trash' ? '回收站' : '直接删除';
                console.log(`✅ 删除成功 (${method}): ${file.name}`);
                
                if (enableProgressCallback && onProgress) {
                  onProgress({
                    current: i + 1,
                    total: filesToDelete.length,
                    currentFile: `✅ ${file.name} (${method})`
                  });
                }
              } else {
                console.error(`❌ 删除失败: ${file.name}`, deleteResult.error);
                if (enableProgressCallback && onProgress) {
                  onProgress({
                    current: i + 1,
                    total: filesToDelete.length,
                    currentFile: `❌ ${file.name} (${deleteResult.error || '删除失败'})`
                  });
                }
              }
              
              // 如果不是最后一个文件且设置了延时，则等待
              if (i < filesToDelete.length - 1 && delayBetweenFiles > 0) {
                console.log(`⏱️ 等待 ${delayBetweenFiles}ms 后继续删除下一个文件...`);
                
                // 分段等待，以便响应暂停/取消操作
                const waitTime = delayBetweenFiles;
                const checkInterval = 100; // 每100ms检查一次状态
                let waited = 0;
                
                while (waited < waitTime) {
                  // 检查是否被取消
                  if (get().deleteStatus.isCancelled) {
                    break;
                  }
                  
                  // 检查是否暂停
                  while (get().deleteStatus.isPaused && !get().deleteStatus.isCancelled) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                  
                  // 如果被取消，跳出等待
                  if (get().deleteStatus.isCancelled) {
                    break;
                  }
                  
                  // 等待一小段时间
                  const sleepTime = Math.min(checkInterval, waitTime - waited);
                  await new Promise(resolve => setTimeout(resolve, sleepTime));
                  waited += sleepTime;
                }
              }
            } catch (error) {
              console.error(`❌ 删除异常: ${file.name}`, error);
              if (enableProgressCallback && onProgress) {
                onProgress({
                  current: i + 1,
                  total: filesToDelete.length,
                  currentFile: `❌ ${file.name} (删除异常: ${(error as Error).message})`
                });
              }
              // 即使删除失败也要等待延时，避免过快操作
              if (i < filesToDelete.length - 1 && delayBetweenFiles > 0) {
                const waitTime = delayBetweenFiles;
                const checkInterval = 100;
                let waited = 0;
                
                while (waited < waitTime && !get().deleteStatus.isCancelled) {
                  while (get().deleteStatus.isPaused && !get().deleteStatus.isCancelled) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                  
                  if (get().deleteStatus.isCancelled) {
                    break;
                  }
                  
                  const sleepTime = Math.min(checkInterval, waitTime - waited);
                  await new Promise(resolve => setTimeout(resolve, sleepTime));
                  waited += sleepTime;
                }
              }
            }
          }
          
          const finalState = get();
          if (finalState.deleteStatus.isCancelled) {
            toast.warning(`删除操作已取消，已处理 ${finalState.deleteStatus.current} / ${filesToDelete.length} 个文件`);
          } else {
            toast.success(`成功删除 ${filesToDelete.length} 个文件`);
          }
        } else {
          // Web环境：模拟删除操作（支持暂停/取消）
          console.log('🌐 模拟删除文件:', filesToDelete.map(f => f.path));
          console.log(`⏱️ 模拟删除延时设置: ${delayBetweenFiles}ms`);
          
          for (let i = 0; i < filesToDelete.length; i++) {
            const file = filesToDelete[i];
            
            // 检查是否被取消
            const currentState = get();
            if (currentState.deleteStatus.isCancelled) {
              console.log('🛑 模拟删除操作被取消');
              break;
            }
            
            // 检查是否暂停
            while (get().deleteStatus.isPaused && !get().deleteStatus.isCancelled) {
              console.log('⏸️ 模拟删除操作已暂停，等待恢复...');
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // 再次检查是否被取消
            if (get().deleteStatus.isCancelled) {
              console.log('🛑 模拟删除操作被取消');
              break;
            }
            
            // 更新当前删除状态
            set(state => ({
              deleteStatus: {
                ...state.deleteStatus,
                current: i + 1,
                currentFile: file.name,
                progress: ((i + 1) / filesToDelete.length) * 100
              }
            }));
            
            // 更新进度回调
            if (enableProgressCallback && onProgress) {
              onProgress({
                current: i + 1,
                total: filesToDelete.length,
                currentFile: file.name
              });
            }
            
            // 模拟删除延迟
            const baseDelay = 500; // 基础模拟延迟
            const totalDelay = baseDelay + delayBetweenFiles;
            
            // 分段等待，以便响应暂停/取消操作
            const checkInterval = 100;
            let waited = 0;
            
            while (waited < totalDelay) {
              // 检查是否被取消
              if (get().deleteStatus.isCancelled) {
                break;
              }
              
              // 检查是否暂停
              while (get().deleteStatus.isPaused && !get().deleteStatus.isCancelled) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // 如果被取消，跳出等待
              if (get().deleteStatus.isCancelled) {
                break;
              }
              
              // 等待一小段时间
              const sleepTime = Math.min(checkInterval, totalDelay - waited);
              await new Promise(resolve => setTimeout(resolve, sleepTime));
              waited += sleepTime;
            }
          }
          
          const finalState = get();
          if (finalState.deleteStatus.isCancelled) {
            toast.warning(`模拟删除操作已取消，已处理 ${finalState.deleteStatus.current} / ${filesToDelete.length} 个文件`);
          } else {
            toast.success(`模拟删除 ${filesToDelete.length} 个文件`);
          }
        }
        
        // 只有在未取消的情况下才创建删除记录和更新状态
        const finalState = get();
        if (!finalState.deleteStatus.isCancelled) {
          // 创建删除记录
          const deleteRecords: DeleteRecord[] = filesToDelete.map(file => ({
            id: generateId(),
            fileName: file.name,
            filePath: file.path,
            fileSize: file.size,
            deletedAt: new Date(),
            reason
          }));

          // 更新状态
          set(state => {
            const updatedGroups = state.duplicateGroups
              .map(group => ({
                ...group,
                files: group.files.filter(file => !fileIds.includes(file.id)),
                totalSize: group.files
                  .filter(file => !fileIds.includes(file.id))
                  .reduce((sum, file) => sum + file.size, 0),
                count: group.files.filter(file => !fileIds.includes(file.id)).length
              }))
              .filter(group => group.files.length > 1); // 移除只剩一个文件的组

            return {
              duplicateGroups: updatedGroups,
              deleteHistory: [...deleteRecords, ...state.deleteHistory]
            };
          });
        }

      } catch (error) {
        toast.error('删除失败：' + (error as Error).message);
      } finally {
        // 重置删除状态
        set(state => ({
          deleteStatus: {
            ...defaultDeleteStatus
          }
        }));
      }
    },

    clearHistory: () => {
      set({ deleteHistory: [] });
      toast.success('历史记录已清空');
    },

    exportHistory: () => {
      const { deleteHistory } = get();
      const dataStr = JSON.stringify(deleteHistory, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `delete-history-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('历史记录已导出');
    },

    setCurrentPage: (page: AppState['currentPage']) => {
      set({ currentPage: page });
    },

    setSelectedGroup: (group: DuplicateGroup | null) => {
      set({ selectedGroup: group });
    },

    exportDeleteList: (fileIds: string[], format: 'csv' | 'json' = 'json') => {
      const { duplicateGroups } = get();
      const filesToExport: FileInfo[] = [];
      
      // 收集要导出的文件
      duplicateGroups.forEach(group => {
        group.files.forEach(file => {
          if (fileIds.includes(file.id)) {
            filesToExport.push(file);
          }
        });
      });

      if (filesToExport.length === 0) {
        toast.error('没有找到要导出的文件');
        return;
      }

      let dataStr: string;
      let fileName: string;
      let mimeType: string;

      if (format === 'csv') {
        const headers = ['文件名', '路径', '大小', '类型', '最后修改时间'];
        const rows = filesToExport.map(file => [
          file.name,
          file.path,
          formatFileSize(file.size),
          file.type,
          file.lastModified.toLocaleString()
        ]);
        dataStr = [headers, ...rows].map(row => row.join(',')).join('\n');
        fileName = `delete-list-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        dataStr = JSON.stringify(filesToExport, null, 2);
        fileName = `delete-list-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const dataBlob = new Blob([dataStr], { type: mimeType });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`删除列表已导出为 ${format.toUpperCase()} 格式`);
    },

    exportAllDuplicates: (format: 'csv' | 'json' = 'json') => {
      const { duplicateGroups } = get();
      
      if (duplicateGroups.length === 0) {
        toast.error('没有重复文件可导出');
        return;
      }

      let dataStr: string;
      let fileName: string;
      let mimeType: string;

      if (format === 'csv') {
        const headers = ['组ID', '组名', '文件名', '路径', '大小', '类型', '最后修改时间'];
        const rows: string[][] = [];
        
        duplicateGroups.forEach(group => {
          group.files.forEach(file => {
            rows.push([
              group.id,
              group.name,
              file.name,
              file.path,
              formatFileSize(file.size),
              file.type,
              file.lastModified.toLocaleString()
            ]);
          });
        });
        
        dataStr = [headers, ...rows].map(row => row.join(',')).join('\n');
        fileName = `all-duplicates-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        dataStr = JSON.stringify(duplicateGroups, null, 2);
        fileName = `all-duplicates-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const dataBlob = new Blob([dataStr], { type: mimeType });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`所有重复文件已导出为 ${format.toUpperCase()} 格式`);
    }
  }),
  {
    name: 'music-duplicate-detector-storage',
    partialize: (state) => ({
      scanConfig: state.scanConfig,
      deleteHistory: state.deleteHistory,
      folderStructures: state.folderStructures
    }),
    onRehydrateStorage: () => (state) => {
      // 如果是开发环境，清空历史记录
      if (isDevelopment && state) {
        state.deleteHistory = [];
        console.log('🧹 开发环境：已清空历史记录');
      }
    }
  }
));

// 导出格式化工具函数
export { formatFileSize };