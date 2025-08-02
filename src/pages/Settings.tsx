import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, Settings as SettingsIcon, Save, RotateCcw, HardDrive, Filter, Folder, Music, Video, Image, FileText, FileArchive, Info, ExternalLink, Github, Heart, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_FILE_TYPES } from '../utils/fileScanner';
import type { EnabledFileType } from '../types';

const Settings: React.FC = () => {
  const {
    scanConfig,
    setCurrentPage,
    updateScanConfig
  } = useAppStore();

  const [localConfig, setLocalConfig] = useState({
    ...scanConfig,
    fileTypes: scanConfig.fileTypes || DEFAULT_FILE_TYPES,
    enabledTypes: scanConfig.enabledTypes || ['audio', 'video', 'image', 'document', 'archive'],
    // 删除延时配置
    enableDelayedDelete: scanConfig.enableDelayedDelete || false,
    delayBetweenFiles: scanConfig.delayBetweenFiles || 1000 // 默认1秒
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleConfigChange = (key: keyof typeof localConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleFormatToggle = (fileType: string, format: string) => {
    const currentFormats = localConfig.fileTypes[fileType] || [];
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter(f => f !== format)
      : [...currentFormats, format];

    handleConfigChange('fileTypes', {
      ...localConfig.fileTypes,
      [fileType]: newFormats
    });
  };

  const handleFileTypeToggle = (fileType: EnabledFileType) => {
    const newEnabledTypes = localConfig.enabledTypes.includes(fileType)
      ? localConfig.enabledTypes.filter(t => t !== fileType)
      : [...localConfig.enabledTypes, fileType];

    handleConfigChange('enabledTypes', newEnabledTypes);
  };

  const handleExcludedDirChange = (value: string) => {
    const dirs = value.split(',').map(dir => dir.trim()).filter(dir => dir.length > 0);
    handleConfigChange('excludedDirectories', dirs);
  };

  const handleSave = () => {
    updateScanConfig(localConfig);
    setHasChanges(false);
    toast.success('设置已保存');
  };

  const handleReset = () => {
    const defaultConfig = {
      maxDepth: 10,
      minFileSize: 1024,
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      fileTypes: DEFAULT_FILE_TYPES,
      enabledTypes: ['audio', 'video', 'image', 'document', 'archive'],
      excludedDirectories: ['node_modules', '.git', 'System Volume Information', '$RECYCLE.BIN'],
      // 删除延时配置
      enableDelayedDelete: false,
      delayBetweenFiles: 1000
    };

    setLocalConfig({
      ...defaultConfig,
      enabledTypes: defaultConfig.enabledTypes as EnabledFileType[]
    });
    setHasChanges(true);
    toast.info('已重置为默认设置');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const parseFileSize = (sizeStr: string): number => {
    const match = sizeStr.match(/^([0-9.]+)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  };

  const handleOpenRepository = () => {
    const repositoryUrl = 'https://github.com/YZz-S/duplicate-file-detector';

    // 在 Electron 环境中使用 shell.openExternal
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(repositoryUrl);
    } else {
      // 在浏览器环境中使用 window.open
      window.open(repositoryUrl, '_blank');
    }
    toast.success('正在打开GitHub仓库...');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => setCurrentPage('home')}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </button>
            <div className="flex items-center">
              <SettingsIcon className="h-6 w-6 text-blue-600 mr-3" />
              <h1 className="text-lg font-semibold text-gray-900">设置</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 操作栏 */}
        {hasChanges && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <SettingsIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">
                    您有未保存的更改
                  </p>
                  <p className="text-sm text-blue-700">
                    请保存设置以应用更改
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setLocalConfig({
                      ...scanConfig,
                      fileTypes: scanConfig.fileTypes || DEFAULT_FILE_TYPES,
                      enabledTypes: scanConfig.enabledTypes || ['audio', 'video', 'image', 'document', 'archive'],
                      enableDelayedDelete: scanConfig.enableDelayedDelete || false,
                      delayBetweenFiles: scanConfig.delayBetweenFiles || 1000
                    });
                    setHasChanges(false);
                  }}
                  className="px-3 py-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存设置
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* 扫描参数配置 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center">
                <HardDrive className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">扫描参数</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 扫描深度 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大扫描深度
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={localConfig.maxDepth}
                    onChange={(e) => handleConfigChange('maxDepth', parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900 w-12">
                    {localConfig.maxDepth} 层
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  控制扫描文件夹的最大层级深度，避免扫描过深的目录结构
                </p>
              </div>

              {/* 文件大小限制 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最小文件大小
                  </label>
                  <input
                    type="text"
                    value={formatFileSize(localConfig.minFileSize)}
                    onChange={(e) => {
                      const size = parseFileSize(e.target.value);
                      if (size > 0) handleConfigChange('minFileSize', size);
                    }}
                    placeholder="例如: 1KB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    忽略小于此大小的文件
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最大文件大小
                  </label>
                  <input
                    type="text"
                    value={formatFileSize(localConfig.maxFileSize)}
                    onChange={(e) => {
                      const size = parseFileSize(e.target.value);
                      if (size > 0) handleConfigChange('maxFileSize', size);
                    }}
                    placeholder="例如: 100MB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    忽略大于此大小的文件
                  </p>
                </div>
              </div>

              {/* 删除延时配置 */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">删除延时设置</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enableDelayedDelete"
                      checked={localConfig.enableDelayedDelete}
                      onChange={(e) => handleConfigChange('enableDelayedDelete', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableDelayedDelete" className="text-sm font-medium text-gray-700">
                      启用删除延时
                    </label>
                  </div>
                  
                  {localConfig.enableDelayedDelete && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          删除间隔时间
                        </label>
                        <select
                          value={localConfig.delayBetweenFiles}
                          onChange={(e) => handleConfigChange('delayBetweenFiles', parseInt(e.target.value))}
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
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <Info className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-yellow-800 mb-2">
                              网络驱动器删除优化
                            </h4>
                            <div className="text-sm text-yellow-700 space-y-2">
                              <p>• 系统已自动检测网络驱动器并应用增强删除策略</p>
                              <p>• 网络驱动器将使用更长的重试延时（1-3秒）</p>
                              <p>• 删除操作会进行严格的验证确保文件真正被删除</p>
                              <p>• 如遇到权限问题，建议设置10秒以上的延时间隔</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                          <div className="text-xs text-blue-800">
                            <p className="font-medium mb-1">建议设置：</p>
                            <ul className="space-y-1">
                              <li>• 本地硬盘：0.5-1秒</li>
                              <li>• 网络驱动器（如极空间）：5-10秒</li>
                              <li>• 大量文件删除：10-30秒</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 文件类型配置 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center">
                <Filter className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">文件类型配置</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 启用的文件类型 */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">启用的文件类型</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries({
                    audio: { icon: Music, label: '音频', color: 'blue' },
                    video: { icon: Video, label: '视频', color: 'purple' },
                    image: { icon: Image, label: '图片', color: 'green' },
                    document: { icon: FileText, label: '文档', color: 'orange' },
                    archive: { icon: FileArchive, label: '压缩包', color: 'red' }
                  }).map(([type, config]) => {
                    const Icon = config.icon;
                    const isEnabled = localConfig.enabledTypes.includes(type as EnabledFileType);
                    return (
                      <label key={type} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleFileTypeToggle(type as EnabledFileType)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {config.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 各类型支持的格式 */}
              {Object.entries(localConfig.fileTypes || {}).map(([fileType, formats]) => {
                const typeConfig = {
                  audio: { icon: Music, label: '音频格式', color: 'blue' },
                  video: { icon: Video, label: '视频格式', color: 'purple' },
                  image: { icon: Image, label: '图片格式', color: 'green' },
                  document: { icon: FileText, label: '文档格式', color: 'orange' },
                  archive: { icon: FileArchive, label: '压缩包格式', color: 'red' }
                }[fileType];

                if (!typeConfig || !localConfig.enabledTypes.includes(fileType as EnabledFileType)) return null;

                const Icon = typeConfig.icon;
                const allFormatsForType = DEFAULT_FILE_TYPES[fileType] || [];

                return (
                  <div key={fileType} className="border rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Icon className="h-4 w-4 text-gray-500 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900">{typeConfig.label}</h4>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {allFormatsForType.map((format) => (
                        <label key={format} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formats.includes(format)}
                            onChange={() => handleFormatToggle(fileType, format)}
                            className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">
                            {format.toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center space-x-3">
                      <button
                        onClick={() => handleConfigChange('fileTypes', {
                          ...localConfig.fileTypes,
                          [fileType]: allFormatsForType
                        })}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        全选
                      </button>
                      <button
                        onClick={() => handleConfigChange('fileTypes', {
                          ...localConfig.fileTypes,
                          [fileType]: []
                        })}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        清空
                      </button>
                      <span className="text-xs text-gray-500">
                        已选择 {formats.length} 种格式
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 排除目录 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center">
                <Folder className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">排除目录</h2>
              </div>
            </div>

            <div className="p-6">
              <textarea
                value={localConfig.excludedDirectories.join(', ')}
                onChange={(e) => handleExcludedDirChange(e.target.value)}
                placeholder="输入要排除的目录名称，用逗号分隔"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                这些目录将被跳过，不会进行扫描。支持目录名称匹配，用逗号分隔多个目录。
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {localConfig.excludedDirectories.map((dir, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {dir}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置为默认
            </button>

            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              保存设置
            </button>
          </div>

          {/* 关于项目 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center">
                <Info className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">关于项目</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 项目介绍 */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <Heart className="h-4 w-4 text-red-500 mr-2" />
                  开源项目说明
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>Duplicate File Detector</strong> 是一个功能全面的重复文件检测和删除工具，
                    支持音频、视频、图片、文档和压缩包等多种文件格式的重复检测。
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    本项目完全开源，采用 Apache 2.0 许可证，欢迎社区贡献和改进。
                    我们致力于为用户提供高效、安全的文件管理解决方案。
                  </p>
                </div>
              </div>

              {/* 技术栈介绍 */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">技术栈</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>前端框架:</strong> React 18 + TypeScript
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>桌面应用:</strong> Electron
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>构建工具:</strong> Vite + Electron Builder
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>样式框架:</strong> Tailwind CSS
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>状态管理:</strong> Zustand
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>图标库:</strong> Lucide React
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>通知组件:</strong> Sonner
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        <strong>路由管理:</strong> React Router DOM
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* GitHub 仓库链接 */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">开源仓库</h3>
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Github className="h-8 w-8 text-gray-700" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          GitHub 仓库
                        </p>
                        <p className="text-xs text-gray-600">
                          查看源代码、提交问题或贡献代码
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenRepository}
                      className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      访问仓库
                    </button>
                  </div>
                </div>
              </div>

              {/* 版本信息 */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>版本: v1.0.0</span>
                  <span>许可证: Apache 2.0</span>
                  <span>构建时间: {new Date().toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;