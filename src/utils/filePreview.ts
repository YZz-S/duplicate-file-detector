import { FileInfo } from '../types';
import { toast } from 'sonner';
import { formatFileSize } from './fileScanner';

// 获取文件的MIME类型
const getMimeType = (extension: string): string => {
  const ext = extension.toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    // 图片
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    
    // 音频
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.wma': 'audio/x-ms-wma',
    
    // 视频
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mkv': 'video/x-matroska'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};

// 支持预览的文件类型
const PREVIEWABLE_TYPES = ['image', 'audio', 'video', 'document'] as const;

// 支持文本预览的文档类型
const TEXT_PREVIEWABLE_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.ini', '.cfg', '.conf'] as const;

// 文档类型的详细信息
const DOCUMENT_TYPES = {
  '.pdf': 'PDF文档',
  '.doc': 'Word文档',
  '.docx': 'Word文档',
  '.xls': 'Excel表格',
  '.xlsx': 'Excel表格',
  '.ppt': 'PowerPoint演示文稿',
  '.pptx': 'PowerPoint演示文稿',
  '.txt': '文本文件'
};

// 压缩包类型的详细信息
const ARCHIVE_TYPES = {
  '.zip': 'ZIP压缩包',
  '.rar': 'RAR压缩包',
  '.7z': '7-Zip压缩包',
  '.tar': 'TAR归档文件',
  '.gz': 'GZIP压缩文件',
  '.bz2': 'BZIP2压缩文件',
  '.xz': 'XZ压缩文件'
};

// 获取文件类型的友好名称
export const getFileTypeName = (file: FileInfo): string => {
  const extension = file.format.toLowerCase();
  
  if (file.type === 'document' && DOCUMENT_TYPES[extension as keyof typeof DOCUMENT_TYPES]) {
    return DOCUMENT_TYPES[extension as keyof typeof DOCUMENT_TYPES];
  }
  
  if (file.type === 'archive' && ARCHIVE_TYPES[extension as keyof typeof ARCHIVE_TYPES]) {
    return ARCHIVE_TYPES[extension as keyof typeof ARCHIVE_TYPES];
  }
  
  switch (file.type) {
    case 'audio': return '音频文件';
    case 'video': return '视频文件';
    case 'image': return '图片文件';
    case 'document': return '文档文件';
    case 'archive': return '压缩文件';
    default: return '未知类型文件';
  }
};

// 检查文件是否支持预览
export const isPreviewable = (file: FileInfo): boolean => {
  if (file.type === 'document') {
    // 对于文档类型，只有特定的文本文件支持预览
    return TEXT_PREVIEWABLE_EXTENSIONS.includes(file.format.toLowerCase() as any);
  }
  return PREVIEWABLE_TYPES.includes(file.type as any);
};

// 创建不支持预览的提示窗口
const createUnsupportedPreviewWindow = (file: FileInfo): void => {
  const fileTypeName = getFileTypeName(file);
  const previewWindow = window.open('', '_blank', 'width=500,height=400');
  
  if (previewWindow) {
    previewWindow.document.write(`
      <html>
        <head>
          <title>文件信息: ${file.name}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #f5f5f5;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
              width: 100%;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 20px;
              color: #6b7280;
            }
            .title {
              font-size: 18px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 10px;
              word-break: break-all;
            }
            .type {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 20px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 8px 16px;
              text-align: left;
              margin: 20px 0;
              padding: 16px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .info-label {
              font-weight: 500;
              color: #374151;
              font-size: 13px;
            }
            .info-value {
              color: #6b7280;
              font-size: 13px;
              word-break: break-all;
            }
            .unsupported {
              background: #fef3c7;
              color: #92400e;
              padding: 12px;
              border-radius: 8px;
              font-size: 14px;
              margin-top: 20px;
              border: 1px solid #fbbf24;
            }
            .actions {
              margin-top: 20px;
              display: flex;
              gap: 10px;
              justify-content: center;
            }
            .btn {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
              text-decoration: none;
              display: inline-block;
            }
            .btn-primary {
              background: #3b82f6;
              color: white;
            }
            .btn-secondary {
              background: #e5e7eb;
              color: #374151;
            }
            .btn:hover {
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📄</div>
            <div class="title">${file.name}</div>
            <div class="type">${fileTypeName}</div>
            
            <div class="info-grid">
              <span class="info-label">文件大小:</span>
              <span class="info-value">${formatFileSize(file.size)}</span>
              
              <span class="info-label">文件格式:</span>
              <span class="info-value">${file.format.toUpperCase()}</span>
              
              <span class="info-label">修改时间:</span>
              <span class="info-value">${new Date(file.lastModified).toLocaleString('zh-CN')}</span>
              
              <span class="info-label">文件路径:</span>
              <span class="info-value">${file.path}</span>
            </div>
            
            <div class="unsupported">
              ⚠️ 此文件类型暂不支持在线预览
            </div>
            
            <div class="actions">
              <button class="btn btn-primary" onclick="copyPath()">
                📋 复制路径
              </button>
              <button class="btn btn-secondary" onclick="window.close()">
                关闭
              </button>
            </div>
          </div>
          
          <script>
            function copyPath() {
              if (navigator.clipboard) {
                navigator.clipboard.writeText('${file.path}').then(() => {
                  alert('文件路径已复制到剪贴板');
                }).catch(() => {
                  prompt('请手动复制文件路径:', '${file.path}');
                });
              } else {
                prompt('请手动复制文件路径:', '${file.path}');
              }
            }
          </script>
        </body>
      </html>
    `);
    previewWindow.document.close();
  }
};

// 创建图片预览窗口
const createImagePreview = async (file: FileInfo): Promise<void> => {
  try {
    // 检查是否在Electron环境中
    if (window.electronAPI && window.electronAPI.readFileForPreview) {
      const result = await window.electronAPI.readFileForPreview(file.path);
      if (result.success) {
        const mimeType = getMimeType(file.format);
        const dataUrl = `data:${mimeType};base64,${result.data}`;
        
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head><title>预览: ${file.name}</title></head>
              <body style="margin:0;padding:20px;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                <div style="text-align:center;">
                  <h3 style="margin-bottom:20px;color:#333;">${file.name}</h3>
                  <img src="${dataUrl}" style="max-width:100%;max-height:80vh;border:1px solid #ddd;border-radius:8px;" 
                       onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                  <div style="display:none;padding:40px;background:white;border-radius:8px;border:1px solid #ddd;">
                    <p style="color:#666;">无法预览此图片文件</p>
                    <p style="font-size:12px;color:#999;">路径: ${file.path}</p>
                  </div>
                </div>
              </body>
            </html>
          `);
          previewWindow.document.close();
        }
      } else {
        throw new Error(result.error);
      }
    } else {
      // 浏览器环境回退
      createUnsupportedPreviewWindow(file);
    }
  } catch (error) {
    console.error('图片预览失败:', error);
    createUnsupportedPreviewWindow(file);
  }
};

// 创建音频预览窗口
const createAudioPreview = async (file: FileInfo): Promise<void> => {
  try {
    // 检查是否在Electron环境中
    if (window.electronAPI && window.electronAPI.readFileForPreview) {
      const result = await window.electronAPI.readFileForPreview(file.path);
      if (result.success) {
        const mimeType = getMimeType(file.format);
        const dataUrl = `data:${mimeType};base64,${result.data}`;
        
        const previewWindow = window.open('', '_blank', 'width=600,height=400');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head><title>预览: ${file.name}</title></head>
              <body style="margin:0;padding:20px;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                <div style="text-align:center;background:white;padding:30px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                  <h3 style="margin-bottom:20px;color:#333;">${file.name}</h3>
                  <audio controls style="width:100%;margin-bottom:20px;" 
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <source src="${dataUrl}" type="${mimeType}">
                    您的浏览器不支持音频播放
                  </audio>
                  <div style="display:none;color:#666;">
                    <p>无法预览此音频文件</p>
                    <p style="font-size:12px;color:#999;">路径: ${file.path}</p>
                  </div>
                  <div style="font-size:12px;color:#999;">
                    ${file.duration ? `时长: ${file.duration}` : ''}
                    ${file.bitrate ? ` | 比特率: ${file.bitrate}kbps` : ''}
                  </div>
                </div>
              </body>
            </html>
          `);
          previewWindow.document.close();
        }
      } else {
        throw new Error(result.error);
      }
    } else {
      // 浏览器环境回退
      createUnsupportedPreviewWindow(file);
    }
  } catch (error) {
    console.error('音频预览失败:', error);
    createUnsupportedPreviewWindow(file);
  }
};

// 创建视频预览窗口
const createVideoPreview = async (file: FileInfo): Promise<void> => {
  try {
    // 检查是否在Electron环境中
    if (window.electronAPI && window.electronAPI.readFileForPreview) {
      const result = await window.electronAPI.readFileForPreview(file.path);
      if (result.success) {
        const mimeType = getMimeType(file.format);
        const dataUrl = `data:${mimeType};base64,${result.data}`;
        
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head><title>预览: ${file.name}</title></head>
              <body style="margin:0;padding:20px;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                <div style="text-align:center;">
                  <h3 style="margin-bottom:20px;color:#333;">${file.name}</h3>
                  <video controls style="max-width:100%;max-height:70vh;border-radius:8px;" 
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <source src="${dataUrl}" type="${mimeType}">
                    您的浏览器不支持视频播放
                  </video>
                  <div style="display:none;padding:40px;background:white;border-radius:8px;border:1px solid #ddd;">
                    <p style="color:#666;">无法预览此视频文件</p>
                    <p style="font-size:12px;color:#999;">路径: ${file.path}</p>
                  </div>
                  <div style="margin-top:10px;font-size:12px;color:#999;">
                    ${file.duration ? `时长: ${file.duration}` : ''}
                    ${file.width && file.height ? ` | 尺寸: ${file.width}x${file.height}` : ''}
                  </div>
                </div>
              </body>
            </html>
          `);
          previewWindow.document.close();
        }
      } else {
        throw new Error(result.error);
      }
    } else {
      // 浏览器环境回退
      createUnsupportedPreviewWindow(file);
    }
  } catch (error) {
    console.error('视频预览失败:', error);
    createUnsupportedPreviewWindow(file);
  }
};

// 创建文本文件预览窗口
const createTextPreview = async (file: FileInfo): Promise<void> => {
  try {
    // 检查是否在Electron环境中
    if (window.electronAPI && window.electronAPI.readFileForPreview) {
      const result = await window.electronAPI.readFileForPreview(file.path);
      if (result.success) {
        // 将Base64解码为文本
        const textContent = atob(result.data);
        
        // 转义HTML特殊字符
        const escapedContent = textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        const previewWindow = window.open('', '_blank', 'width=900,height=700');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head>
                <title>预览: ${file.name}</title>
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    background: #f5f5f5;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                  }
                  .container {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    overflow: hidden;
                  }
                  .header {
                    background: #f8f9fa;
                    padding: 15px 20px;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin: 0;
                  }
                  .file-info {
                    font-size: 12px;
                    color: #666;
                  }
                  .content {
                    padding: 20px;
                    max-height: 600px;
                    overflow: auto;
                  }
                  .text-content {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 14px;
                    line-height: 1.5;
                    color: #333;
                    background: #fafafa;
                    padding: 15px;
                    border-radius: 4px;
                    border: 1px solid #e9ecef;
                  }
                  .empty-file {
                    text-align: center;
                    color: #999;
                    font-style: italic;
                    padding: 40px;
                  }
                  .actions {
                    padding: 15px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid #e9ecef;
                    text-align: right;
                  }
                  .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    margin-left: 8px;
                  }
                  .btn-primary {
                    background: #007bff;
                    color: white;
                  }
                  .btn-secondary {
                    background: #6c757d;
                    color: white;
                  }
                  .btn:hover {
                    opacity: 0.9;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h3 class="title">${file.name}</h3>
                    <div class="file-info">
                      ${formatFileSize(file.size)} | ${file.format.toUpperCase()}
                    </div>
                  </div>
                  <div class="content">
                    ${textContent.trim() ? 
                      `<div class="text-content">${escapedContent}</div>` : 
                      '<div class="empty-file">📄 文件为空</div>'
                    }
                  </div>
                  <div class="actions">
                    <button class="btn btn-primary" onclick="copyContent()">
                      📋 复制内容
                    </button>
                    <button class="btn btn-secondary" onclick="window.close()">
                      关闭
                    </button>
                  </div>
                </div>
                
                <script>
                  function copyContent() {
                    const content = \`${textContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(content).then(() => {
                        alert('文件内容已复制到剪贴板');
                      }).catch(() => {
                        prompt('请手动复制文件内容:', content);
                      });
                    } else {
                      prompt('请手动复制文件内容:', content);
                    }
                  }
                </script>
              </body>
            </html>
          `);
          previewWindow.document.close();
        }
      } else {
        throw new Error(result.error);
      }
    } else {
      // 浏览器环境回退
      createUnsupportedPreviewWindow(file);
    }
  } catch (error) {
    console.error('文本预览失败:', error);
    createUnsupportedPreviewWindow(file);
  }
};

// 主要的文件预览函数
export const previewFile = async (file: FileInfo): Promise<void> => {
  try {
    if (!isPreviewable(file)) {
      // 对于不支持预览的文件类型，显示详细信息窗口
      createUnsupportedPreviewWindow(file);
      return;
    }

    // 根据文件类型创建相应的预览窗口
    switch (file.type) {
      case 'image':
        await createImagePreview(file);
        break;
      case 'audio':
        await createAudioPreview(file);
        break;
      case 'video':
        await createVideoPreview(file);
        break;
      case 'document':
        // 只有支持文本预览的文档类型才会到这里
        await createTextPreview(file);
        break;
      default:
        createUnsupportedPreviewWindow(file);
    }
  } catch (error) {
    console.error('预览文件失败:', error);
    toast.error('预览失败：无法打开文件');
  }
};

// 显示不支持预览的提示
export const showUnsupportedToast = (file: FileInfo): void => {
  const fileTypeName = getFileTypeName(file);
  toast.warning(`${fileTypeName}暂不支持预览`, {
    description: `文件: ${file.name}\n大小: ${formatFileSize(file.size)}`,
    duration: 3000
  });
};