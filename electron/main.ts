import { app, BrowserWindow, ipcMain, dialog, shell, Notification } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';

// 设置进程编码以支持中文文件名
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096';
if (process.platform === 'win32') {
  // Windows平台设置UTF-8编码
  process.env.LANG = 'zh_CN.UTF-8';
  process.env.LC_ALL = 'zh_CN.UTF-8';
}

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// 创建主窗口
function createWindow(): void {
  // 根据平台选择合适的图标格式
  let iconPath: string;
  if (process.platform === 'win32') {
    iconPath = join(__dirname, '../assets/icons/icon.ico');
  } else {
    iconPath = join(__dirname, '../assets/icons/icon.png');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Duplicate File Detector',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  // 设置应用用户模型ID (Windows通知功能需要)
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.duplicate-file-detector.app');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 文件系统相关的IPC处理

// 选择目录
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择要扫描的目录',
  });

  if (result.canceled) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// 扫描目录中的文件
ipcMain.handle('scan-directory', async (event, dirPath: string, options: any = {}) => {
  try {
    const result = await scanDirectoryRecursive(dirPath, options, (progress) => {
      // 实时发送扫描进度和错误信息到渲染进程
      event.sender.send('scan-progress', {
        currentPath: progress.currentPath,
        errors: progress.errors,
        filesScanned: progress.filesScanned
      });
    });

    return {
      success: true,
      files: result.files,
      errors: result.errors,
      totalErrors: result.errors.length
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 查找重复文件
ipcMain.handle('find-duplicates', async (event, files: any[], scanMode: string = 'content') => {
  try {
    const duplicates = await findDuplicateFiles(files, scanMode);
    return { success: true, duplicates };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 删除文件
ipcMain.handle('delete-file', async (event, filePath: string) => {
  try {
    console.log(`🗑️ 开始删除文件: ${filePath}`);
    
    // 首先检查文件是否存在
    try {
      await fs.access(filePath);
      console.log(`✅ 文件存在性检查通过: ${filePath}`);
    } catch (accessError) {
      const errorMsg = `文件不存在或无法访问: ${filePath}`;
      console.error(`❌ ${errorMsg}`, accessError);
      return { success: false, error: errorMsg };
    }

    // 检查是否为网络驱动器
    const isNetworkDrive = filePath.match(/^[A-Z]:\\/) && !filePath.match(/^[C-F]:\\/);
    if (isNetworkDrive) {
      console.log(`🌐 检测到网络驱动器文件: ${filePath}`);
    }

    // 尝试移动到回收站
    try {
      console.log(`🗂️ 尝试移动到回收站: ${filePath}`);
      await shell.trashItem(filePath);
      console.log(`✅ 文件已成功移动到回收站: ${filePath}`);
      
      // 验证文件是否真的被删除
      try {
        await fs.access(filePath);
        console.warn(`⚠️ 警告：文件仍然存在，回收站操作可能未完全成功: ${filePath}`);
        return { success: false, error: `移动到回收站后文件仍然存在: ${filePath}` };
      } catch {
        // 文件不存在，说明删除成功
        return { success: true, method: 'trash' };
      }
    } catch (trashError) {
      console.warn(`⚠️ 移动到回收站失败，尝试直接删除: ${filePath}`, trashError);
      console.log(`移动到回收站失败，尝试直接删除: ${filePath} [Error: ${(trashError as Error).message}]`);

      // 如果移动到回收站失败，尝试直接删除
      try {
        console.log(`🔥 尝试直接删除: ${filePath}`);
        await fs.unlink(filePath);
        
        // 验证文件是否真的被删除
        try {
          await fs.access(filePath);
          console.error(`❌ 错误：直接删除后文件仍然存在: ${filePath}`);
          return { success: false, error: `直接删除后文件仍然存在: ${filePath}` };
        } catch {
          // 文件不存在，说明删除成功
          console.log(`✅ 文件已直接删除: ${filePath}`);
          return { success: true, method: 'direct' };
        }
      } catch (unlinkError) {
        const errorMessage = `删除失败 - 回收站错误: ${(trashError as Error).message}, 直接删除错误: ${(unlinkError as Error).message}`;
        console.error(`❌ ${errorMessage}`);
        console.log(`文件已直接删除: ${filePath}`);
        return { success: false, error: errorMessage };
      }
    }
  } catch (error) {
    const errorMessage = `删除文件时发生未预期错误: ${(error as Error).message}`;
    console.error(`❌ ${errorMessage}`, error);
    return { success: false, error: errorMessage };
  }
});

// 获取文件统计信息
ipcMain.handle('get-file-stats', async (event, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      success: true,
      stats: {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 打开文件
ipcMain.handle('open-file', async (event, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 在资源管理器中显示文件
ipcMain.handle('show-in-explorer', async (event, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 发送系统通知
ipcMain.handle('send-notification', async (event, options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}) => {
  try {
    // 检查通知支持
    if (!Notification.isSupported()) {
      return { success: false, error: '系统不支持通知功能' };
    }

    // 创建通知
    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon ? join(__dirname, '../dist', options.icon) : undefined,
      silent: false,
      urgency: 'normal'
    });

    // 点击通知时聚焦主窗口
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    // 显示通知
    notification.show();

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url: string) => {
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error('打开外部链接失败:', error);
    throw error;
  }
});

// 读取文件内容用于预览
ipcMain.handle('read-file-for-preview', async (event, filePath: string) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');
    return { success: true, data: base64Data };
  } catch (error) {
    console.error('读取文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 递归扫描目录
async function scanDirectoryRecursive(
  dirPath: string,
  options: {
    maxDepth?: number;
    excludeDirs?: string[];
    includeExtensions?: string[];
    maxFileSize?: number;
  } = {},
  onProgress?: (progress: { currentPath: string; errors: string[]; filesScanned: number }) => void
): Promise<{ files: any[]; errors: string[] }> {
  const {
    maxDepth = 10,
    excludeDirs = ['node_modules', '.git', '.vscode', 'dist', 'build'],
    includeExtensions = [],
    maxFileSize = 100 * 1024 * 1024, // 100MB
  } = options;

  const files: any[] = [];
  const errors: string[] = [];
  let filesScanned = 0;

  async function scan(currentPath: string, depth: number = 0): Promise<void> {
    if (depth > maxDepth) return;

    // 报告当前扫描路径，确保中文路径正确显示
    const currentPathUtf8 = Buffer.from(currentPath, 'utf8').toString('utf8');
    onProgress?.({
      currentPath: currentPathUtf8,
      errors: [...errors],
      filesScanned
    });

    try {
      // 使用UTF-8编码读取目录，确保中文文件名正确显示
      const entries = await fs.readdir(currentPath, { withFileTypes: true, encoding: 'utf8' });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // 跳过排除的目录
          if (excludeDirs.includes(entry.name)) continue;
          await scan(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);

            // 文件大小过滤
            if (stats.size > maxFileSize) continue;

            // 扩展名过滤
            if (includeExtensions.length > 0) {
              const ext = path.extname(entry.name).toLowerCase();
              if (!includeExtensions.includes(ext)) continue;
            }

            // 安全获取文件扩展名，确保中文文件名正确处理
            const fileName = Buffer.from(entry.name, 'utf8').toString('utf8');
            const extension = fileName ? path.extname(fileName).toLowerCase() : '';
            const fullPathUtf8 = Buffer.from(fullPath, 'utf8').toString('utf8');

            files.push({
              name: fileName || '',
              path: fullPathUtf8,
              size: stats.size,
              mtime: stats.mtime,
              ctime: stats.ctime,
              extension: extension,
              directory: path.dirname(fullPathUtf8),
            });

            filesScanned++;

            // 每扫描10个文件报告一次进度
            if (filesScanned % 10 === 0) {
              const progressPathUtf8 = Buffer.from(fullPath, 'utf8').toString('utf8');
              onProgress?.({
                currentPath: progressPathUtf8,
                errors: [...errors],
                filesScanned
              });
            }
          } catch (error) {
            // 记录文件访问错误，确保中文文件名正确显示
            const fullPathUtf8 = Buffer.from(fullPath, 'utf8').toString('utf8');
            const errorMsg = `无法访问文件: ${fullPathUtf8} - ${(error as Error).message}`;
            errors.push(errorMsg);
            console.warn(errorMsg, error);
          }
        }
      }
    } catch (error) {
      // 记录目录访问错误，确保中文目录名正确显示
      const currentPathUtf8 = Buffer.from(currentPath, 'utf8').toString('utf8');
      const errorMsg = `无法访问目录: ${currentPathUtf8} - ${(error as Error).message}`;
      errors.push(errorMsg);
      console.warn(errorMsg, error);
    }
  }

  await scan(dirPath);
  return { files, errors };
}

// 计算文件哈希值
async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    console.warn(`无法计算文件哈希: ${filePath}`, error);
    return '';
  }
}

// 查找重复文件
async function findDuplicateFiles(files: any[], scanMode: string = 'content'): Promise<any[]> {
  const duplicates: any[] = [];

  if (scanMode === 'name-different-size') {
    // 模式1：文件名相同但体积不同
    const nameGroups: { [name: string]: any[] } = {};

    for (const file of files) {
      // 安全检查：确保文件名存在且有效
      if (!file || !file.name || typeof file.name !== 'string') {
        console.warn('跳过无效文件对象:', file);
        continue;
      }

      try {
        const baseName = path.parse(file.name).name.toLowerCase();
        if (!baseName) {
          console.warn('文件名解析失败:', file.name);
          continue;
        }

        if (!nameGroups[baseName]) {
          nameGroups[baseName] = [];
        }
        nameGroups[baseName].push(file);
      } catch (error) {
        console.warn('处理文件名时出错:', file.name, error);
        continue;
      }
    }

    for (const [baseName, group] of Object.entries(nameGroups)) {
      if (group.length > 1) {
        // 检查是否有不同大小的文件
        const uniqueSizes = new Set(group.map(f => f.size));

        // 只要有同名文件且存在不同大小，就认为是重复
        if (uniqueSizes.size > 1) {
          duplicates.push({
            id: `${baseName}_different_size_${Date.now()}`,
            baseName,
            files: group,
            totalSize: group.reduce((sum, f) => sum + f.size, 0),
            count: group.length,
            scanMode: 'name-different-size'
          });
        }
      }
    }
  } else if (scanMode === 'name-same-size') {
    // 模式2：文件名相同且体积相同
    const nameAndSizeGroups: { [key: string]: any[] } = {};

    for (const file of files) {
      // 安全检查：确保文件名存在且有效
      if (!file || !file.name || typeof file.name !== 'string') {
        console.warn('跳过无效文件对象:', file);
        continue;
      }

      try {
        const baseName = path.parse(file.name).name.toLowerCase();
        if (!baseName) {
          console.warn('文件名解析失败:', file.name);
          continue;
        }

        const key = `${baseName}_${file.size}`;
        if (!nameAndSizeGroups[key]) {
          nameAndSizeGroups[key] = [];
        }
        nameAndSizeGroups[key].push(file);
      } catch (error) {
        console.warn('处理文件名时出错:', file.name, error);
        continue;
      }
    }

    for (const [key, group] of Object.entries(nameAndSizeGroups)) {
      if (group.length > 1) {
        const baseName = group[0]?.name ? path.parse(group[0].name).name : 'unknown';
        duplicates.push({
          id: `${baseName}_same_size_${Date.now()}`,
          baseName,
          files: group,
          totalSize: group.reduce((sum, f) => sum + f.size, 0),
          count: group.length,
          scanMode: 'name-same-size'
        });
      }
    }
  } else {
    // 模式3：内容相同（原有模式）
    const nameAndSizeGroups: { [key: string]: any[] } = {};

    for (const file of files) {
      // 安全检查：确保文件名存在且有效
      if (!file || !file.name || typeof file.name !== 'string') {
        console.warn('跳过无效文件对象:', file);
        continue;
      }

      try {
        const baseName = path.parse(file.name).name.toLowerCase();
        if (!baseName) {
          console.warn('文件名解析失败:', file.name);
          continue;
        }

        const key = `${baseName}_${file.size}`;
        if (!nameAndSizeGroups[key]) {
          nameAndSizeGroups[key] = [];
        }
        nameAndSizeGroups[key].push(file);
      } catch (error) {
        console.warn('处理文件名时出错:', file.name, error);
        continue;
      }
    }

    // 对于可能的重复文件，计算哈希值进行精确匹配
    for (const [key, group] of Object.entries(nameAndSizeGroups)) {
      if (group.length > 1) {
        // 计算每个文件的哈希值
        const hashGroups: { [hash: string]: any[] } = {};

        for (const file of group) {
          const hash = await calculateFileHash(file.path);
          if (hash) {
            if (!hashGroups[hash]) {
              hashGroups[hash] = [];
            }
            hashGroups[hash].push(file);
          }
        }

        // 只保留哈希值相同且数量大于1的组
        for (const hashGroup of Object.values(hashGroups)) {
          if (hashGroup.length > 1) {
            const baseName = hashGroup[0]?.name ? path.parse(hashGroup[0].name).name : 'unknown';
            duplicates.push({
              id: `${baseName}_${hashGroup[0].size}_${Date.now()}`,
              baseName,
              files: hashGroup,
              totalSize: hashGroup.reduce((sum, f) => sum + f.size, 0),
              count: hashGroup.length,
              scanMode: 'content'
            });
          }
        }
      }
    }
  }

  return duplicates.sort((a, b) => b.totalSize - a.totalSize);
}