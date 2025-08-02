import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { setupGlobalErrorHandling } from './utils/notifications'

// 设置全局错误处理
setupGlobalErrorHandling();

// 清理localStorage中的历史记录数据，确保每次启动应用时历史记录为空
try {
  const storageKey = 'music-duplicate-detector-storage';
  const storedData = localStorage.getItem(storageKey);
  if (storedData) {
    const parsedData = JSON.parse(storedData);
    // 移除deleteHistory字段
    if (parsedData.state && parsedData.state.deleteHistory) {
      delete parsedData.state.deleteHistory;
      localStorage.setItem(storageKey, JSON.stringify(parsedData));
      console.log('✅ 已清理localStorage中的历史记录数据');
    }
  }
} catch (error) {
  console.warn('⚠️ 清理localStorage历史记录时出错:', error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
