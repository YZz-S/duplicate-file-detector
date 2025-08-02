// 测试桌面通知功能的脚本
const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');

// 确保应用只运行一个实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，将会聚焦到myWindow上
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // 加载简单的HTML内容
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>通知测试</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          button { padding: 10px 20px; margin: 10px; font-size: 16px; }
        </style>
      </head>
      <body>
        <h2>桌面通知功能测试</h2>
        <button onclick="testNotification()">测试通知</button>
        <p id="status">点击按钮测试桌面通知功能</p>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          function testNotification() {
            const status = document.getElementById('status');
            
            try {
              // 通过IPC发送通知请求到主进程
              ipcRenderer.invoke('send-notification', {
                title: '测试通知',
                body: '桌面通知功能正常工作！'
              }).then(result => {
                if (result.success) {
                  status.textContent = '✅ 通知已发送！检查系统通知区域。';
                  status.style.color = 'green';
                } else {
                  status.textContent = '❌ 通知发送失败: ' + result.error;
                  status.style.color = 'red';
                }
              }).catch(error => {
                status.textContent = '❌ 通知发送失败: ' + error.message;
                status.style.color = 'red';
              });
            } catch (error) {
              status.textContent = '❌ 通知发送失败: ' + error.message;
              status.style.color = 'red';
            }
          }
        </script>
      </body>
      </html>
    `));

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    // 设置应用用户模型ID (Windows通知功能需要)
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.duplicate-file-detector.test');
    }

    // 注册IPC处理器
    ipcMain.handle('send-notification', async (event, options) => {
      try {
        if (!Notification.isSupported()) {
          return { success: false, error: '系统不支持通知功能' };
        }

        const notification = new Notification({
          title: options.title,
          body: options.body,
          silent: false
        });

        notification.show();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    createWindow();

    // 3秒后自动发送一个测试通知
    setTimeout(() => {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: '自动测试通知',
          body: '应用启动后的自动通知测试',
          silent: false
        });
        notification.show();
      }
    }, 3000);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}