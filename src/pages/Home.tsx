import React, { useRef, useState, useEffect } from 'react';
import { useAppStore, formatFileSize } from '../store/useAppStore';
import { Folder, Play, Square, Settings, Trash2, FileText, Clock, Plus, X, Music, Video, Image, FileArchive, File, ExternalLink, Eye, Calendar, CalendarClock, HardDrive, Download, Zap, Search, Loader2, FileDown, Timer, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { EnabledFileType, FileInfo } from '../types';
import {
  isElectronEnvironment,
  selectDirectory,
  scanDirectory,
  findDuplicates,
  deleteFile,
  getPlatformInfo,
  getScanModeOptions,
  type ScanMode
} from '../utils/electronFileScanner';
import { previewFile } from '../utils/filePreview';

const Home: React.FC = () => {
  const {
    selectedDirectories,
    scanStatus,
    duplicateGroups,
    scanConfig,
    deleteStatus,
    setSelectedDirectories,
    addDirectory,
    removeDirectory,
    updateScanConfig,
    startScan,
    stopScan,
    setCurrentPage,
    setSelectedGroup,
    deleteFiles,
    exportDeleteList,
    exportAllDuplicates,
    pauseDelete,
    resumeDelete,
    cancelDelete
  } = useAppStore();

  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [deleteProgressInfo, setDeleteProgressInfo] = useState<{
    isDeleting: boolean;
    current: number;
    total: number;
    currentFile: string;
  }>({
    isDeleting: false,
    current: 0,
    total: 0,
    currentFile: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [localDeleteStatus, setLocalDeleteStatus] = useState('');
  const [isElectronApp, setIsElectronApp] = useState(false);
  const [selectedScanMode, setSelectedScanMode] = useState<ScanMode>('content');

  useEffect(() => {
    // 检查是否在Electron环境中
    setIsElectronApp(isElectronEnvironment());

    if (isElectronEnvironment()) {
      const platformInfo = getPlatformInfo();
      if (platformInfo) {
        console.log('运行在Electron环境:', platformInfo);
        toast.success(`桌面应用已启动 - ${platformInfo.platform}`);
      }
    }
  }, []);

  const handleDirectorySelect = async () => {
    if (isElectronApp) {
      // Electron环境：使用真实的目录选择
      try {
        setIsAddingFolder(true);
        const selectedPath = await selectDirectory();

        if (selectedPath) {
          if (!selectedDirectories.includes(selectedPath)) {
            addDirectory(selectedPath);
            toast.success(`目录添加成功: ${selectedPath}`);
          } else {
            toast.info('该目录已经添加过了');
          }
        } else {
          toast.info('未选择任何目录');
        }
      } catch (error) {
        toast.error(`选择目录失败: ${(error as Error).message}`);
      } finally {
        setIsAddingFolder(false);
      }
    } else {
      // Web环境：使用文件夹选择器
      if (fileInputRef.current) {
        setIsAddingFolder(true);
        fileInputRef.current.click();
        toast.info('请选择要扫描的文件夹...');
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      // 显示处理中的提示
      if (files.length > 1000) {
        toast.info(`正在处理包含 ${files.length} 个文件的文件夹，请稍候...`);
      }

      try {
        // 获取完整的目录路径
        const file = files[0];
        let directoryPath = '';

        if (file.webkitRelativePath) {
          // 从相对路径中提取目录路径
          const pathParts = file.webkitRelativePath.split('/');
          directoryPath = pathParts.slice(0, -1).join('/') || pathParts[0];
        } else {
          // 如果没有相对路径，尝试从文件路径获取
          directoryPath = (file as any).path ?
            (file as any).path.replace(/\\/g, '/').split('/').slice(0, -1).join('/') :
            'Selected Directory';
        }

        if (directoryPath && !selectedDirectories.includes(directoryPath)) {
          addDirectory(directoryPath);
          toast.success(`目录添加成功: ${directoryPath} (包含 ${files.length} 个文件)`);
        } else if (selectedDirectories.includes(directoryPath)) {
          toast.info('该目录已经添加过了');
        } else {
          toast.error('无法获取目录路径，请重试');
        }
      } catch (error) {
        console.error('处理文件选择时出错:', error);
        toast.error('添加目录时出错，请重试');
      }
    } else {
      toast.info('未选择任何文件夹');
    }

    // 清除加载状态
    setIsAddingFolder(false);

    // 重置input值，允许重复选择同一目录
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDeleteSingleFile = async (fileId: string, fileName: string) => {
    try {
      setDeleteProgressInfo({
        isDeleting: true,
        current: 0,
        total: 1,
        currentFile: fileName
      });

      const deleteOptions = {
        delayBetweenFiles: 0, // 单个文件删除不需要延时
        enableProgressCallback: true,
        onProgress: (progress: { current: number; total: number; currentFile: string }) => {
          setDeleteProgressInfo({
            isDeleting: true,
            current: progress.current,
            total: progress.total,
            currentFile: progress.currentFile
          });
        }
      };

      await deleteFiles([fileId], `删除单个文件: ${fileName}`, deleteOptions);
      toast.success(`文件删除成功: ${fileName}`);

    } catch (error) {
      toast.error(`删除文件失败: ${fileName}`);
    } finally {
      setDeleteProgressInfo({
        isDeleting: false,
        current: 0,
        total: 0,
        currentFile: ''
      });
    }
  };

  const handleDeleteSmallestFiles = async () => {
    if (duplicateGroups.length === 0) {
      toast.error('没有重复文件可删除');
      return;
    }

    const smallestFileIds: string[] = [];
    duplicateGroups.forEach(group => {
      if (group.files.length > 1) {
        // 获取最小的文件（已按大小降序排列，所以取最后一个）
        const smallestFile = group.files[group.files.length - 1];
        smallestFileIds.push(smallestFile.id);
      }
    });

    if (smallestFileIds.length > 0) {
      try {
        setDeleteProgressInfo({
          isDeleting: true,
          current: 0,
          total: smallestFileIds.length,
          currentFile: '准备删除...'
        });

        const { deleteFiles, scanConfig } = useAppStore.getState();
        const deleteOptions = {
          delayBetweenFiles: scanConfig.enableDelayedDelete ? (scanConfig.delayBetweenFiles || 1000) : 0,
          enableProgressCallback: true,
          onProgress: (progress: { current: number; total: number; currentFile: string }) => {
            setDeleteProgressInfo({
              isDeleting: true,
              current: progress.current,
              total: progress.total,
              currentFile: progress.currentFile
            });
          }
        };

        await deleteFiles(smallestFileIds, '批量删除较小文件', deleteOptions);

      } finally {
        setDeleteProgressInfo({
          isDeleting: false,
          current: 0,
          total: 0,
          currentFile: ''
        });
      }
    }
  };

  // 批量删除功能（更新版本，支持延时删除）
  const handleBatchDelete = async (type: 'older' | 'newer' | 'earlierModified' | 'laterModified' | 'smaller' | 'larger') => {
    if (duplicateGroups.length === 0) {
      toast.error('没有重复文件可删除');
      return;
    }

    setIsDeleting(true);
    setDeleteProgress(0);
    setLocalDeleteStatus('正在分析文件...');

    try {
      const fileIdsToDelete: string[] = [];
      let totalGroups = duplicateGroups.length;
      let processedGroups = 0;

      duplicateGroups.forEach(group => {
        if (group.files.length > 1) {
          let targetFiles: FileInfo[] = [];

          switch (type) {
            case 'older':
              // 删除创建时间较早的文件
              const sortedByCreated = [...group.files].sort((a, b) => {
                const aTime = a.createdAt ? a.createdAt.getTime() : a.lastModified.getTime();
                const bTime = b.createdAt ? b.createdAt.getTime() : b.lastModified.getTime();
                return aTime - bTime;
              });
              targetFiles = sortedByCreated.slice(0, -1); // 保留最新的
              break;

            case 'newer':
              // 删除创建时间较晚的文件
              const sortedByCreatedDesc = [...group.files].sort((a, b) => {
                const aTime = a.createdAt ? a.createdAt.getTime() : a.lastModified.getTime();
                const bTime = b.createdAt ? b.createdAt.getTime() : b.lastModified.getTime();
                return bTime - aTime;
              });
              targetFiles = sortedByCreatedDesc.slice(0, -1); // 保留最旧的
              break;

            case 'earlierModified':
              // 删除修改时间较早的文件
              const sortedByModified = [...group.files].sort((a, b) =>
                a.lastModified.getTime() - b.lastModified.getTime()
              );
              targetFiles = sortedByModified.slice(0, -1); // 保留最新修改的
              break;

            case 'laterModified':
              // 删除修改时间较晚的文件
              const sortedByModifiedDesc = [...group.files].sort((a, b) =>
                b.lastModified.getTime() - a.lastModified.getTime()
              );
              targetFiles = sortedByModifiedDesc.slice(0, -1); // 保留最早修改的
              break;

            case 'smaller':
              // 删除较小的文件（已按大小降序排列，取最后几个）
              targetFiles = group.files.slice(1); // 保留最大的
              break;

            case 'larger':
              // 删除较大的文件
              targetFiles = group.files.slice(0, -1); // 保留最小的
              break;
          }

          fileIdsToDelete.push(...targetFiles.map(f => f.id));
        }

        processedGroups++;
        setDeleteProgress(Math.floor((processedGroups / totalGroups) * 50));
        setLocalDeleteStatus(`已分析 ${processedGroups}/${totalGroups} 组文件`);
      });

      if (fileIdsToDelete.length === 0) {
        toast.info('没有符合条件的文件需要删除');
        setIsDeleting(false);
        return;
      }

      setLocalDeleteStatus(`正在删除 ${fileIdsToDelete.length} 个文件...`);
      setDeleteProgress(50);

      const typeLabels = {
        older: '创建较早',
        newer: '创建较晚',
        earlierModified: '修改较早',
        laterModified: '修改较晚',
        smaller: '较小',
        larger: '较大'
      };

      // 初始化删除进度状态
      setDeleteProgressInfo({
        isDeleting: true,
        current: 0,
        total: fileIdsToDelete.length,
        currentFile: '准备删除...'
      });

      // 使用新的删除选项
      const { scanConfig: currentScanConfig } = useAppStore.getState();
      const deleteOptions = {
        delayBetweenFiles: currentScanConfig.enableDelayedDelete ? (currentScanConfig.delayBetweenFiles || 1000) : 0,
        enableProgressCallback: true, // 总是启用进度回调
        onProgress: (progress: { current: number; total: number; currentFile: string }) => {
          setDeleteProgressInfo({
            isDeleting: true,
            current: progress.current,
            total: progress.total,
            currentFile: progress.currentFile
          });

          const progressPercent = 50 + Math.floor((progress.current / progress.total) * 50);
          setDeleteProgress(progressPercent);
          setLocalDeleteStatus(`正在删除文件 ${progress.current}/${progress.total}: ${progress.currentFile}`);
        }
      };

      await deleteFiles(fileIdsToDelete, `批量删除${typeLabels[type]}文件`, deleteOptions);

    } catch (error) {
      toast.error('批量删除失败：' + (error as Error).message);
    } finally {
      setIsDeleting(false);
      setDeleteProgress(0);
      setLocalDeleteStatus('');
      setDeleteProgressInfo({
        isDeleting: false,
        current: 0,
        total: 0,
        currentFile: ''
      });
    }
  };

  // 预览文件功能
  const handlePreviewFile = async (file: FileInfo) => {
    try {
      await previewFile(file);
    } catch (error) {
      console.error('文件预览失败:', error);
      toast.error('文件预览失败');
    }
  };

  const handleOpenFile = (filePath: string) => {
    try {
      // 在浏览器环境中，我们无法直接打开本地文件
      // 但可以尝试复制路径到剪贴板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(filePath);
        toast.success('文件路径已复制到剪贴板');
      } else {
        toast.info(`文件路径: ${filePath}`);
      }
    } catch (error) {
      toast.error('无法打开文件');
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">重复文件检测工具</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage('history')}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Clock className="h-4 w-4 mr-2" />
                历史记录
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                设置
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 文件类型过滤器 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">文件类型</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries({
              audio: { icon: Music, label: '音频', color: 'blue' },
              video: { icon: Video, label: '视频', color: 'purple' },
              image: { icon: Image, label: '图片', color: 'green' },
              document: { icon: FileText, label: '文档', color: 'orange' },
              archive: { icon: FileArchive, label: '压缩包', color: 'red' }
            }).map(([type, config]) => {
              const Icon = config.icon;
              const isEnabled = scanConfig.enabledTypes?.includes(type as EnabledFileType) || false;
              return (
                <button
                  key={type}
                  onClick={() => {
                    const currentTypes = Array.isArray(scanConfig.enabledTypes) ? scanConfig.enabledTypes : [];
                    const newEnabledTypes = isEnabled
                      ? currentTypes.filter(t => t !== type)
                      : [...currentTypes, type as EnabledFileType];
                    updateScanConfig({ enabledTypes: newEnabledTypes });
                  }}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${isEnabled
                    ? {
                      blue: 'border-blue-500 bg-blue-50 text-blue-700',
                      purple: 'border-purple-500 bg-purple-50 text-purple-700',
                      green: 'border-green-500 bg-green-50 text-green-700',
                      orange: 'border-orange-500 bg-orange-50 text-orange-700',
                      red: 'border-red-500 bg-red-50 text-red-700'
                    }[config.color] || 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 目录选择区域 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">扫描目录</h2>
            <button
              onClick={handleDirectorySelect}
              disabled={isAddingFolder}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isAddingFolder ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  选择中...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  添加文件夹
                </>
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            {...({ webkitdirectory: '' } as any)}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedDirectories.length > 0 ? (
            <div className="space-y-2">
              {selectedDirectories.map((directory, index) => (
                <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 border rounded-md">
                  <div className="flex items-center">
                    <Folder className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">{directory}</span>
                  </div>
                  <button
                    onClick={() => removeDirectory(directory)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Folder className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>请添加要扫描的文件夹</p>
            </div>
          )}
        </div>

        {/* 扫描控制区域 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">扫描控制</h2>
          </div>

          {/* 扫描模式选择 */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">扫描模式</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {getScanModeOptions().map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedScanMode(option.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${selectedScanMode === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <div className="font-medium text-sm mb-1">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center space-x-3">
              {!scanStatus.isScanning ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => startScan(false, selectedScanMode)}
                      disabled={selectedDirectories.length === 0 || (scanConfig.enabledTypes?.length || 0) === 0}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      完整扫描
                    </button>

                    <button
                      onClick={() => startScan(true, selectedScanMode)}
                      disabled={selectedDirectories.length === 0 || (scanConfig.enabledTypes?.length || 0) === 0}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      title="跳过文件计数，直接开始扫描（适合大量文件）"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      快速扫描
                    </button>
                  </div>

                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Play className="h-3 w-3 text-green-600" />
                        <span className="font-medium">完整扫描：</span>
                        <span>先统计文件总数，提供准确进度显示</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-blue-600" />
                        <span className="font-medium">快速扫描：</span>
                        <span>跳过文件计数，立即开始扫描（推荐大量文件时使用）</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    扫描中...
                  </div>
                  <button
                    onClick={stopScan}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    停止扫描
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 简化的扫描进度条 */}
          {scanStatus.isScanning && (
            <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
              {/* 进度信息 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">正在扫描文件</h3>
                  <p className="text-sm text-gray-600 mt-1 truncate max-w-md">
                    {scanStatus.currentPath || '正在初始化...'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(scanStatus.progress)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {scanStatus.processedFiles || 0} / {scanStatus.totalFiles || '?'} 文件
                  </div>
                </div>
              </div>

              {/* 进度条 */}
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ease-out ${scanStatus.progress >= 100
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : scanStatus.progress >= 90
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                    style={{ width: `${Math.max(0, Math.min(100, scanStatus.progress))}%` }}
                  >
                    {/* 动画效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                </div>

                {/* 阶段指示器 */}
                <div className="flex justify-between items-center text-xs">
                  <div className={`flex items-center gap-2 ${scanStatus.progress < 90 && scanStatus.progress >= 5 ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}>
                    {scanStatus.progress >= 90 ? '✓' : scanStatus.progress >= 5 ? '🔍' : '○'} 扫描文件
                  </div>
                  <div className={`flex items-center gap-2 ${scanStatus.progress >= 90 && scanStatus.progress < 100
                      ? 'text-purple-600 font-medium' : 'text-gray-400'
                    }`}>
                    {scanStatus.progress >= 100 ? '✓' : scanStatus.progress >= 90 ? '⚙️' : '○'} 分析重复
                  </div>
                  <div className={`flex items-center gap-2 ${scanStatus.progress >= 100 ? 'text-green-600 font-medium' : 'text-gray-400'
                    }`}>
                    {scanStatus.progress >= 100 ? '🎉' : '○'} 完成
                  </div>
                </div>

                {/* 状态信息 */}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    {scanStatus.scanSpeed > 0 && (
                      <span>速度: {scanStatus.scanSpeed} 文件/秒</span>
                    )}
                    {selectedDirectories.length > 1 && (
                      <span>{selectedDirectories.length} 个目录</span>
                    )}
                  </div>
                  <div>
                    {scanStatus.totalErrors > 0 && (
                      <button
                        onClick={() => setShowErrorDetails(!showErrorDetails)}
                        className="text-orange-600 hover:text-orange-800 underline"
                      >
                        {scanStatus.totalErrors} 个错误
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 错误详情 */}
          {(scanStatus.isScanning || scanStatus.totalErrors > 0) && showErrorDetails && scanStatus.errors && scanStatus.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-h-60 overflow-y-auto mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-900">扫描错误详情</span>
                <button
                  onClick={() => setShowErrorDetails(false)}
                  className="text-orange-600 hover:text-orange-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {scanStatus.errors.map((error, index) => (
                  <div key={index} className="text-xs text-orange-700 break-all bg-orange-100 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 重复文件列表 - 只有扫描完全完成后才显示 */}
        {!scanStatus.isScanning && scanStatus.phase === 'completed' && duplicateGroups.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                重复文件列表 ({duplicateGroups.length} 组)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAllDuplicates('csv')}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  导出CSV
                </button>
                <button
                  onClick={() => exportAllDuplicates('json')}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  导出JSON
                </button>
                <button
                  onClick={handleDeleteSmallestFiles}
                  disabled={isDeleting}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除较小文件
                </button>
              </div>
            </div>

            {/* 删除延时设置 */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">删除延时设置</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="enableDelayedDelete"
                    checked={scanConfig.enableDelayedDelete}
                    onChange={(e) => updateScanConfig({ enableDelayedDelete: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enableDelayedDelete" className="text-sm font-medium text-gray-700">
                    启用删除延时
                  </label>
                </div>
                
                {scanConfig.enableDelayedDelete && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        删除间隔时间
                      </label>
                      <select
                        value={scanConfig.delayBetweenFiles}
                        onChange={(e) => updateScanConfig({ delayBetweenFiles: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={500}>0.5秒</option>
                        <option value={1000}>1秒</option>
                        <option value={2000}>2秒</option>
                        <option value={3000}>3秒</option>
                        <option value={5000}>5秒</option>
                        <option value={10000}>10秒</option>
                        <option value={30000}>30秒</option>
                        <option value={60000}>60秒</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        每删除一个文件后等待的时间，可避免被网络存储设备误认为是恶意操作
                      </p>
                    </div>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-xs text-yellow-700 space-y-1">
                        <p>💡 延时删除可以减少文件系统压力，避免删除大量文件时出现错误</p>
                        <p>• 网络驱动器建议设置10秒以上的延时间隔</p>
                        <p>• 删除操作会进行严格的验证确保文件真正被删除</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 删除控制按钮 */}
              {deleteStatus.isDeleting && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-700">
                      正在删除: {deleteStatus.currentFile}
                    </div>
                    <div className="text-sm text-gray-500">
                      {deleteStatus.current} / {deleteStatus.total}
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${deleteStatus.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {!deleteStatus.isPaused ? (
                      <button
                        onClick={pauseDelete}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>暂停</span>
                      </button>
                    ) : (
                      <button
                        onClick={resumeDelete}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span>恢复</span>
                      </button>
                    )}
                    
                    <button
                      onClick={cancelDelete}
                      className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span>取消</span>
                    </button>
                  </div>
                  
                  {deleteStatus.isPaused && (
                    <div className="mt-2 text-sm text-yellow-600">
                      ⏸️ 删除操作已暂停
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 批量删除按钮组 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">批量删除选项</h3>
                <button
                  onClick={() => {
                    // 导出所有较小文件的列表
                    const smallestFileIds: string[] = [];
                    duplicateGroups.forEach(group => {
                      if (group.files.length > 1) {
                        const smallestFile = group.files[group.files.length - 1];
                        smallestFileIds.push(smallestFile.id);
                      }
                    });
                    if (smallestFileIds.length > 0) {
                      exportDeleteList(smallestFileIds, 'csv');
                    }
                  }}
                  className="flex items-center px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors"
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  导出删除列表
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                  onClick={() => handleBatchDelete('older')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  删除创建较早
                </button>
                <button
                  onClick={() => handleBatchDelete('newer')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  删除创建较晚
                </button>
                <button
                  onClick={() => handleBatchDelete('earlierModified')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <CalendarClock className="h-3 w-3 mr-1" />
                  删除修改较早
                </button>
                <button
                  onClick={() => handleBatchDelete('laterModified')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <CalendarClock className="h-3 w-3 mr-1" />
                  删除修改较晚
                </button>
                <button
                  onClick={() => handleBatchDelete('smaller')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <HardDrive className="h-3 w-3 mr-1" />
                  删除较小文件
                </button>
                <button
                  onClick={() => handleBatchDelete('larger')}
                  disabled={isDeleting}
                  className="flex items-center justify-center px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs"
                >
                  <HardDrive className="h-3 w-3 mr-1" />
                  删除较大文件
                </button>
              </div>
            </div>

            {/* 删除进度显示 */}
            {(isDeleting || deleteProgressInfo.isDeleting) && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-yellow-800">删除进度</span>
                  <div className="flex items-center gap-2">
                    {deleteProgressInfo.isDeleting ? (
                      <span className="text-sm text-yellow-600 font-medium">
                        已删除 {deleteProgressInfo.current} / 共 {deleteProgressInfo.total} 个文件
                      </span>
                    ) : (
                      <span className="text-sm text-yellow-600">{deleteProgress}%</span>
                    )}
                  </div>
                </div>

                {/* 统一进度条 */}
                <div className="w-full bg-yellow-200 rounded-full h-3 mb-3 relative overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all duration-500 relative"
                    style={{ 
                      width: deleteProgressInfo.isDeleting && deleteProgressInfo.total > 0 
                        ? `${(deleteProgressInfo.current / deleteProgressInfo.total) * 100}%`
                        : `${Math.max(0, Math.min(100, deleteProgress))}%`
                    }}
                  >
                    {/* 动画效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse"></div>
                  </div>
                </div>

                {/* 状态信息 */}
                {deleteProgressInfo.isDeleting ? (
                  <div className="space-y-2">
                    {/* 当前文件状态显示 */}
                    <div className="text-xs text-yellow-700 bg-yellow-100 p-3 rounded">
                      <div className="font-medium mb-2">正在处理:</div>
                      <div className="break-all">
                        {deleteProgressInfo.currentFile.includes('❌') ? (
                          <span className="text-red-700">{deleteProgressInfo.currentFile}</span>
                        ) : (
                          deleteProgressInfo.currentFile
                        )}
                      </div>
                      
                      {/* 错误状态检测 */}
                      {deleteProgressInfo.currentFile.includes('❌') && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <div className="flex items-center text-red-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span className="text-xs font-medium">检测到删除错误</span>
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            可能原因：文件权限不足、网络连接问题或文件被占用
                          </div>
                        </div>
                      )}
                      
                      {/* 网络驱动器检测 */}
                      {deleteProgressInfo.currentFile.match(/^[G-Z]:\\/) && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="flex items-center text-blue-700">
                            <HardDrive className="h-3 w-3 mr-1" />
                            <span className="text-xs font-medium">网络驱动器文件</span>
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            正在使用增强删除策略，包含更长重试延时
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 延时信息 */}
                    {scanConfig.enableDelayedDelete && (scanConfig.delayBetweenFiles || 0) > 0 && (
                      <div className="flex items-center gap-2 text-xs text-yellow-600">
                        <Timer className="h-3 w-3" />
                        <span>延时间隔: {(scanConfig.delayBetweenFiles || 1000) / 1000}秒</span>
                      </div>
                    )}

                    {/* 删除速度估算 */}
                    {deleteProgressInfo.current > 1 && deleteProgressInfo.total > deleteProgressInfo.current && (
                      <div className="flex items-center gap-2 text-xs text-yellow-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>预计剩余 {deleteProgressInfo.total - deleteProgressInfo.current} 个文件</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-yellow-700">{String(deleteStatus)}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              {duplicateGroups.map((group) => (
                <div key={group.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{group.name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{group.files.length} 个文件</span>
                      <span>总大小: {formatFileSize(group.totalSize)}</span>
                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setCurrentPage('details');
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {group.files.map((file, index) => {
                      const getFileIcon = (type: string) => {
                        switch (type) {
                          case 'audio': return Music;
                          case 'video': return Video;
                          case 'image': return Image;
                          case 'document': return FileText;
                          case 'archive': return FileArchive;
                          default: return File;
                        }
                      };
                      const FileIcon = getFileIcon(file.type);

                      return (
                        <div key={file.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              <FileIcon className="h-5 w-5 text-gray-500 mr-3 mt-1" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="font-medium text-gray-900">{file.format.toUpperCase()}</div>
                                  {index === group.files.length - 1 && (
                                    <div className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                      最小
                                    </div>
                                  )}
                                </div>
                                <div className="text-gray-600 text-sm mb-2 break-all">{file.path}</div>

                                {/* 文件特有信息 */}
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                                  {file.type === 'video' && file.duration && (
                                    <span>时长: {file.duration}</span>
                                  )}
                                  {file.type === 'image' && file.width && file.height && (
                                    <span>尺寸: {file.width}x{file.height}</span>
                                  )}
                                  {file.type === 'audio' && file.bitrate && (
                                    <span>比特率: {file.bitrate}kbps</span>
                                  )}
                                </div>

                                {/* 时间信息 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
                                  {file.createdAt && (
                                    <div className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      <span>创建: {formatDateTime(file.createdAt)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    <span>修改: {formatDateTime(file.lastModified)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 右侧信息和操作按钮 */}
                            <div className="flex flex-col items-end gap-2 ml-4">
                              <div className="text-right">
                                <div className="font-medium text-gray-900 text-sm">{formatFileSize(file.size)}</div>
                              </div>

                              {/* 操作按钮 */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenFile(file.path)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="复制文件路径"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handlePreviewFile(file)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="预览文件"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSingleFile(file.id, file.name)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="删除文件"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!scanStatus.isScanning && duplicateGroups.length === 0 && selectedDirectories.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">未发现重复文件</h3>
            <p className="text-gray-500">在选择的目录中没有找到重复文件</p>
          </div>
        )}

        {selectedDirectories.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">开始扫描</h3>
            <p className="text-gray-500">请添加要扫描的文件夹并选择文件类型</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;