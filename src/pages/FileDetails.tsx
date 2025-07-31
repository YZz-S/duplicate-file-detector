import React, { useState } from 'react';
import { useAppStore, formatFileSize } from '../store/useAppStore';
import { ArrowLeft, Trash2, Check, X, FileText, Calendar, HardDrive, Music } from 'lucide-react';
import { toast } from 'sonner';

const FileDetails: React.FC = () => {
  const {
    selectedGroup,
    setCurrentPage,
    setSelectedGroup,
    deleteFiles
  } = useAppStore();

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">未选择文件组</h3>
          <p className="text-gray-500 mb-4">请返回主页面选择要查看的重复文件组</p>
          <button
            onClick={() => setCurrentPage('home')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  const handleFileSelect = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === selectedGroup.files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(selectedGroup.files.map(file => file.id));
    }
  };

  const handleSelectSmallest = () => {
    if (selectedGroup.files.length > 1) {
      const smallestFile = selectedGroup.files[selectedGroup.files.length - 1];
      setSelectedFiles([smallestFile.id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) {
      toast.error('请选择要删除的文件');
      return;
    }

    if (selectedFiles.length === selectedGroup.files.length) {
      toast.error('不能删除所有文件，请至少保留一个');
      return;
    }

    await deleteFiles(selectedFiles, '手动选择删除');
    setSelectedFiles([]);
    setShowDeleteConfirm(false);
    
    // 如果当前组只剩一个文件，返回主页
    const remainingFiles = selectedGroup.files.filter(file => !selectedFiles.includes(file.id));
    if (remainingFiles.length <= 1) {
      setSelectedGroup(null);
      setCurrentPage('home');
    }
  };

  const getFileIcon = (format: string) => {
    return <Music className="h-5 w-5 text-blue-600" />;
  };

  const getQualityBadge = (file: any, allFiles: any[]) => {
    const maxSize = Math.max(...allFiles.map(f => f.size));
    const minSize = Math.min(...allFiles.map(f => f.size));
    
    if (file.size === maxSize) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">最高质量</span>;
    } else if (file.size === minSize) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">最低质量</span>;
    }
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">中等质量</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => {
                setSelectedGroup(null);
                setCurrentPage('home');
              }}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </button>
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-3" />
              <h1 className="text-lg font-semibold text-gray-900">文件详情 - {selectedGroup.name}</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 操作栏 */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                已选择 {selectedFiles.length} / {selectedGroup.files.length} 个文件
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedFiles.length === selectedGroup.files.length ? '取消全选' : '全选'}
              </button>
              <button
                onClick={handleSelectSmallest}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                选择最小文件
              </button>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={selectedFiles.length === 0 || selectedFiles.length === selectedGroup.files.length}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除选中文件
            </button>
          </div>
        </div>

        {/* 文件对比列表 */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">文件对比</h2>
            <p className="text-sm text-gray-600 mt-1">
              共 {selectedGroup.files.length} 个重复文件，总大小 {formatFileSize(selectedGroup.totalSize)}
            </p>
          </div>
          
          <div className="divide-y">
            {selectedGroup.files.map((file, index) => (
              <div key={file.id} className={`p-6 hover:bg-gray-50 transition-colors ${
                selectedFiles.includes(file.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => handleFileSelect(file.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-3">
                      {getFileIcon(file.format)}
                      <h3 className="text-lg font-medium text-gray-900">{file.name}</h3>
                      {getQualityBadge(file, selectedGroup.files)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500">文件大小</div>
                          <div className="font-medium text-gray-900">{formatFileSize(file.size)}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500">文件格式</div>
                          <div className="font-medium text-gray-900">{file.format.toUpperCase()}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500">修改时间</div>
                          <div className="font-medium text-gray-900">{file.lastModified.toLocaleDateString()}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="h-4 w-4" /> {/* 占位符 */}
                        <div>
                          <div className="text-gray-500">质量排名</div>
                          <div className="font-medium text-gray-900">第 {index + 1} 位</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <div className="text-gray-500 mb-1">文件路径</div>
                      <div className="font-mono text-gray-900 break-all">{file.path}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">确认删除</h3>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-3">
                  您即将删除以下 {selectedFiles.length} 个文件：
                </p>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-3">
                  {selectedGroup.files
                    .filter(file => selectedFiles.includes(file.id))
                    .map(file => (
                      <div key={file.id} className="text-sm text-gray-700 mb-1">
                        {file.name} ({formatFileSize(file.size)})
                      </div>
                    ))
                  }
                </div>
                <p className="text-sm text-red-600 mt-3 font-medium">
                  此操作不可撤销，请确认您的选择。
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4 mr-2" />
                  取消
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Check className="h-4 w-4 mr-2" />
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDetails;