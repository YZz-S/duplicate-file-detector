import React, { useState } from 'react';
import { useAppStore, formatFileSize } from '../store/useAppStore';
import { ArrowLeft, Trash2, Download, Calendar, Folder, FolderOpen, File, Clock, Filter } from 'lucide-react';
import { toast } from 'sonner';

type TabType = 'delete-history' | 'folder-structure';

const History: React.FC = () => {
  const {
    deleteHistory,
    folderStructures,
    setCurrentPage,
    clearHistory,
    exportHistory
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('delete-history');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const filteredHistory = filterDate 
    ? deleteHistory.filter(record => {
        const deletedDate = record.deletedAt instanceof Date ? record.deletedAt : new Date(record.deletedAt);
        return deletedDate.toDateString() === new Date(filterDate).toDateString();
      })
    : deleteHistory;

  const handleClearHistory = () => {
    clearHistory();
    setShowClearConfirm(false);
  };

  const renderFolderTree = (folder: any, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id} className="select-none">
        <div 
          className={`flex items-center py-2 px-3 hover:bg-gray-50 rounded cursor-pointer ${
            level > 0 ? 'ml-' + (level * 4) : ''
          }`}
          onClick={() => hasChildren && toggleFolder(folder.id)}
        >
          <div className="flex items-center flex-1">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-600 mr-2" />
              ) : (
                <Folder className="h-4 w-4 text-blue-600 mr-2" />
              )
            ) : (
              <File className="h-4 w-4 text-gray-400 mr-2" />
            )}
            <span className="text-sm font-medium text-gray-900">{folder.name}</span>
            {folder.fileCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {folder.fileCount} 文件
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {folder.scannedAt ? folder.scannedAt.toLocaleDateString() : '未知时间'}
          </span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {folder.children.map((child: any, index: number) => (
              <div key={`${child.id || child.name || index}-${level + 1}`}>
                {renderFolderTree(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
              <Clock className="h-6 w-6 text-blue-600 mr-3" />
              <h1 className="text-lg font-semibold text-gray-900">历史记录</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标签页 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('delete-history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'delete-history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                删除历史 ({deleteHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('folder-structure')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'folder-structure'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                文件夹结构 ({folderStructures.length})
              </button>
            </nav>
          </div>

          {/* 删除历史标签页内容 */}
          {activeTab === 'delete-history' && (
            <div className="p-6">
              {/* 操作栏 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    {filterDate && (
                      <button
                        onClick={() => setFilterDate('')}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={exportHistory}
                    disabled={deleteHistory.length === 0}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    导出历史
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={deleteHistory.length === 0}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    清空历史
                  </button>
                </div>
              </div>

              {/* 删除历史列表 */}
              {filteredHistory.length > 0 ? (
                <div className="space-y-4">
                  {filteredHistory.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Trash2 className="h-4 w-4 text-red-600" />
                            <h3 className="font-medium text-gray-900">{record.fileName}</h3>
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                              已删除
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">文件大小：</span>
                              {formatFileSize(record.fileSize)}
                            </div>
                            <div>
                              <span className="font-medium">删除时间：</span>
                              {(record.deletedAt instanceof Date ? record.deletedAt : new Date(record.deletedAt)).toLocaleString()}
                            </div>
                            <div>
                              <span className="font-medium">删除原因：</span>
                              {record.reason}
                            </div>
                          </div>
                          
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <span className="font-medium text-gray-700">原路径：</span>
                            <span className="font-mono text-gray-600 break-all">{record.filePath}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {filterDate ? '没有找到匹配的记录' : '暂无删除历史'}
                  </h3>
                  <p className="text-gray-500">
                    {filterDate ? '请尝试选择其他日期或清除筛选条件' : '删除文件后，记录将显示在这里'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 文件夹结构标签页内容 */}
          {activeTab === 'folder-structure' && (
            <div className="p-6">
              {folderStructures.length > 0 ? (
                <div className="space-y-6">
                  {folderStructures.map((structure) => (
                    <div key={structure.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Folder className="h-5 w-5 text-blue-600" />
                            <h3 className="font-medium text-gray-900">{structure.name}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {structure.children?.length || 0} 项
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            路径：{structure.path}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 font-mono">
                          {structure.path}
                        </div>
                      </div>
                      
                      <div className="p-4 max-h-64 overflow-y-auto">
                        <div key={`folder-tree-${structure.id}`}>
                          {renderFolderTree(structure)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文件夹结构</h3>
                  <p className="text-gray-500">扫描目录后，文件夹结构信息将显示在这里</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 清空历史确认对话框 */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">确认清空历史</h3>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500">
                  您即将清空所有删除历史记录，此操作不可撤销。
                </p>
                <p className="text-sm text-red-600 mt-2 font-medium">
                  共 {deleteHistory.length} 条记录将被永久删除。
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleClearHistory}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  确认清空
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;