// 系统通知工具
import { isElectronEnvironment } from './electronFileScanner';

interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
}

interface NotificationResult {
    success: boolean;
    error?: string;
}

class NotificationManager {
    private permissionGranted = false;
    private requestingPermission = false;

    constructor() {
        this.checkPermission();
    }

    // 检查通知权限
    private async checkPermission(): Promise<void> {
        if (isElectronEnvironment()) {
            // Electron环境下通知权限通常是可用的
            this.permissionGranted = true;
            return;
        }

        // Web环境检查权限
        if (!('Notification' in window)) {
            console.warn('浏览器不支持通知功能');
            return;
        }

        if (Notification.permission === 'granted') {
            this.permissionGranted = true;
        } else if (Notification.permission === 'default') {
            // 权限未设置，尝试请求
            await this.requestPermission();
        }
    }

    // 请求通知权限
    async requestPermission(): Promise<boolean> {
        if (this.requestingPermission) {
            return false;
        }

        this.requestingPermission = true;

        try {
            if (isElectronEnvironment()) {
                this.permissionGranted = true;
                return true;
            }

            if (!('Notification' in window)) {
                return false;
            }

            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';

            return this.permissionGranted;
        } catch (error) {
            console.error('请求通知权限失败:', error);
            return false;
        } finally {
            this.requestingPermission = false;
        }
    }

    // 发送通知
    async sendNotification(options: NotificationOptions): Promise<NotificationResult> {
        try {
            // 确保有权限
            if (!this.permissionGranted) {
                const granted = await this.requestPermission();
                if (!granted) {
                    return {
                        success: false,
                        error: '通知权限未授权'
                    };
                }
            }

            if (isElectronEnvironment()) {
                // Electron环境使用IPC发送通知
                await this.sendElectronNotification(options);
            } else {
                // Web环境使用浏览器通知API
                await this.sendWebNotification(options);
            }

            return { success: true };
        } catch (error) {
            console.error('发送通知失败:', error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    // 发送Electron通知
    private async sendElectronNotification(options: NotificationOptions): Promise<void> {
        if (window.electronAPI && window.electronAPI.sendNotification) {
            await window.electronAPI.sendNotification({
                title: options.title,
                body: options.body,
                icon: options.icon,
                tag: options.tag
            });
        } else {
            // 如果Electron API不可用，回退到Web通知
            await this.sendWebNotification(options);
        }
    }

    // 发送Web通知
    private async sendWebNotification(options: NotificationOptions): Promise<void> {
        const notification = new Notification(options.title, {
            body: options.body,
            icon: options.icon || '/favicon.svg',
            tag: options.tag,
            requireInteraction: false,
            silent: false
        });

        // 自动关闭通知
        setTimeout(() => {
            notification.close();
        }, 5000);

        // 点击通知时聚焦窗口
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }

    // 检查是否支持通知
    isSupported(): boolean {
        return isElectronEnvironment() || ('Notification' in window);
    }

    // 获取权限状态
    getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
        if (!this.isSupported()) {
            return 'unsupported';
        }

        if (isElectronEnvironment()) {
            return 'granted';
        }

        return Notification.permission;
    }
}

// 创建单例实例
const notificationManager = new NotificationManager();

// 导出便捷函数
export const sendNotification = (options: NotificationOptions) =>
    notificationManager.sendNotification(options);

export const requestNotificationPermission = () =>
    notificationManager.requestPermission();

export const isNotificationSupported = () =>
    notificationManager.isSupported();

export const getNotificationPermission = () =>
    notificationManager.getPermissionStatus();

// 预定义的扫描通知
export const scanNotifications = {
    // 扫描开始
    scanStarted: (dirCount: number, fileTypes: string[]) => sendNotification({
        title: '🔍 开始扫描重复文件',
        body: `正在扫描 ${dirCount} 个目录中的 ${fileTypes.join('、')} 文件`,
        tag: 'scan-started'
    }),

    // 扫描完成
    scanCompleted: (duplicateGroups: number, totalFiles: number, wastedSpace: string, scanTime: number) => sendNotification({
        title: '✅ 扫描完成',
        body: `发现 ${duplicateGroups} 组重复文件（共 ${totalFiles} 个），浪费空间 ${wastedSpace}，耗时 ${scanTime.toFixed(1)} 秒`,
        tag: 'scan-completed'
    }),

    // 扫描错误
    scanError: (error: string) => sendNotification({
        title: '❌ 扫描失败',
        body: `扫描过程中发生错误：${error}`,
        tag: 'scan-error'
    })
};

// 预定义的删除通知
export const deleteNotifications = {
    // 删除开始
    deleteStarted: (fileCount: number, deleteType: string) => sendNotification({
        title: '🗑️ 开始删除文件',
        body: `正在删除 ${fileCount} 个重复文件（${deleteType}）`,
        tag: 'delete-started'
    }),

    // 删除完成
    deleteCompleted: (deletedCount: number, failedCount: number, deleteTime: number) => sendNotification({
        title: '✅ 删除操作完成',
        body: `成功删除 ${deletedCount} 个文件${failedCount > 0 ? `，${failedCount} 个文件删除失败` : ''}，耗时 ${deleteTime.toFixed(1)} 秒`,
        tag: 'delete-completed'
    }),

    // 删除错误
    deleteError: (error: string) => sendNotification({
        title: '❌ 删除操作失败',
        body: `删除过程中发生错误：${error}`,
        tag: 'delete-error'
    })
};

// 预定义的系统异常通知
export const systemNotifications = {
    // 权限错误
    permissionError: (operation: string, path?: string) => sendNotification({
        title: '🔒 权限不足',
        body: `执行 ${operation} 操作时权限不足${path ? `：${path}` : ''}`,
        tag: 'permission-error'
    }),

    // 磁盘空间不足
    diskSpaceError: (requiredSpace: string) => sendNotification({
        title: '💾 磁盘空间不足',
        body: `操作需要 ${requiredSpace} 可用空间，请清理磁盘后重试`,
        tag: 'disk-space-error'
    }),

    // 网络错误
    networkError: (operation: string) => sendNotification({
        title: '🌐 网络连接错误',
        body: `执行 ${operation} 操作时网络连接失败，请检查网络连接`,
        tag: 'network-error'
    }),

    // 文件系统错误
    fileSystemError: (operation: string, error: string) => sendNotification({
        title: '📁 文件系统错误',
        body: `${operation} 操作失败：${error}`,
        tag: 'file-system-error'
    }),

    // 内存不足
    memoryError: (operation: string) => sendNotification({
        title: '🧠 内存不足',
        body: `执行 ${operation} 操作时内存不足，请关闭其他应用程序后重试`,
        tag: 'memory-error'
    }),

    // 应用程序崩溃
    applicationCrash: (errorDetails?: string) => sendNotification({
        title: '💥 应用程序异常',
        body: `应用程序遇到异常${errorDetails ? `：${errorDetails}` : '，正在尝试恢复'}`,
        tag: 'app-crash'
    }),

    // 通用系统错误
    systemError: (error: string) => sendNotification({
        title: '⚠️ 系统错误',
        body: `系统发生错误：${error}`,
        tag: 'system-error'
    })
};

// 智能错误分类和通知
export const notifySystemError = (error: Error | string, operation: string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? '' : error.stack || '';

    // 权限错误
    if (errorMessage.includes('permission') || errorMessage.includes('权限') ||
        errorMessage.includes('EACCES') || errorMessage.includes('EPERM') ||
        errorMessage.includes('denied') || errorMessage.includes('不足')) {
        return systemNotifications.permissionError(operation);
    }

    // 磁盘空间错误
    if (errorMessage.includes('ENOSPC') || errorMessage.includes('space') ||
        errorMessage.includes('disk') || errorMessage.includes('磁盘') ||
        errorMessage.includes('空间不足')) {
        return systemNotifications.diskSpaceError('未知');
    }

    // 网络错误
    if (errorMessage.includes('network') || errorMessage.includes('网络') ||
        errorMessage.includes('timeout') || errorMessage.includes('connect') ||
        errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENETUNREACH')) {
        return systemNotifications.networkError(operation);
    }

    // 文件系统错误
    if (errorMessage.includes('ENOENT') || errorMessage.includes('ENOTDIR') ||
        errorMessage.includes('EISDIR') || errorMessage.includes('EMFILE') ||
        errorMessage.includes('文件') || errorMessage.includes('目录')) {
        return systemNotifications.fileSystemError(operation, errorMessage);
    }

    // 内存错误
    if (errorMessage.includes('memory') || errorMessage.includes('内存') ||
        errorMessage.includes('heap') || errorMessage.includes('out of memory') ||
        errorStack.includes('RangeError') && errorStack.includes('Maximum call stack')) {
        return systemNotifications.memoryError(operation);
    }

    // 应用程序崩溃
    if (errorStack.includes('at process.uncaughtException') ||
        errorStack.includes('at process.unhandledRejection') ||
        errorMessage.includes('crash') || errorMessage.includes('崩溃')) {
        return systemNotifications.applicationCrash(errorMessage);
    }

    // 通用系统错误
    return systemNotifications.systemError(errorMessage);
};

// 全局错误处理器
export const setupGlobalErrorHandling = () => {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的Promise拒绝:', event.reason);
        notifySystemError(event.reason || '未知Promise错误', '异步操作').catch(error => {
            console.warn('发送系统错误通知失败:', error);
        });
    });

    // 捕获全局错误
    window.addEventListener('error', (event) => {
        console.error('全局错误:', event.error || event.message);
        notifySystemError(event.error || event.message || '未知错误', '应用运行').catch(error => {
            console.warn('发送系统错误通知失败:', error);
        });
    });

    // 监听资源加载错误
    window.addEventListener('error', (event) => {
        if (event.target !== window && event.target) {
            const target = event.target as HTMLElement;
            console.error('资源加载错误:', target.tagName, target.getAttribute('src') || target.getAttribute('href'));
            systemNotifications.fileSystemError('资源加载', `无法加载${target.tagName}资源`).catch(error => {
                console.warn('发送资源加载错误通知失败:', error);
            });
        }
    }, true);

    console.log('✅ 全局错误处理器已设置');
};

export default notificationManager;