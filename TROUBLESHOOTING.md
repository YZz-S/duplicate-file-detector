# 🔧 启动问题故障排除指南

## 🚀 推荐启动方式

### 主要方法
```powershell
# 右键点击 powershell-start.ps1 → "用PowerShell运行"
# 或命令行：
.\powershell-start.ps1
```

### 备用方法
```powershell
# 分两步启动：
# 1. 启动 Vite: npm run dev
# 2. 启动 Electron: .\start-electron.ps1
```

## 🐛 常见问题解决

### 问题1：PowerShell 执行策略限制
**错误**: "无法加载文件，因为在此系统上禁止运行脚本"

**解决方案：**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题2：只看到 Vite 启动，没有 Electron 窗口
**现象**: 控制台显示 "VITE v6.3.5 ready" 但应用窗口没出现

**解决方案：**
使用分步启动：
1. 保持 Vite 运行
2. 新窗口运行：`.\start-electron.ps1`

#### 2. 手动诊断
如果修复版仍有问题，请依次检查：

**Step 1: 环境检查**
```cmd
node --version
npm --version
```
- Node.js 版本应该是 16.0.0 或更高
- npm 应该正常显示版本号

**Step 2: 项目检查**
```cmd
dir package.json
dir scripts\start-app-en.js
dir node_modules
```
- 确保所有必要文件存在

**Step 3: 依赖检查**
```cmd
npm list --depth=0
```
- 检查是否有缺失的依赖

**Step 4: 构建检查**
```cmd
npm run electron:build-dev
```
- 检查 Electron 主进程是否能正确构建

**Step 5: 端口检查**
```cmd
netstat -an | findstr :5174
```
- 确保端口 5174 没有被占用

#### 3. 备用启动方法

**方法 1: 使用传统命令**
```cmd
npm run electron:dev
```

**方法 2: 分步启动**
```cmd
# 1. 构建主进程
npm run electron:build-dev

# 2. 启动 Vite 服务器（新窗口）
start cmd /k "npm run dev"

# 3. 等待几秒后启动 Electron
timeout /t 5
npx electron .
```

**方法 3: 直接测试**
```cmd
# 测试 Vite 服务器
npm run dev
# 在浏览器打开 http://localhost:5174

# 测试 Electron（在另一个终端）
npx electron .
```

### 🚨 具体错误解决方案

#### 错误 1: "Node.js not found"
**解决方案：**
1. 从 https://nodejs.org/ 下载安装 Node.js
2. 安装时勾选 "Add to PATH"
3. 重启命令行窗口
4. 验证：`node --version`

#### 错误 2: "npm not available"
**解决方案：**
1. 重新安装 Node.js（npm 应该一起安装）
2. 或单独安装 npm：下载 npm installer
3. 验证：`npm --version`

#### 错误 3: "Port 5174 is occupied"
**解决方案：**
```cmd
# 方法 1: 查找并终止占用进程
netstat -ano | findstr :5174
taskkill /PID <PID号> /F

# 方法 2: 使用端口管理工具
npm run port:kill

# 方法 3: 重启计算机（最简单）
```

#### 错误 4: "Electron build failed"
**解决方案：**
```cmd
# 1. 清理缓存
rmdir /s dist-electron
rmdir /s node_modules

# 2. 重新安装依赖
npm install

# 3. 重新构建
npm run electron:build-dev
```

#### 错误 5: "Application failed to start"
**解决方案：**
```cmd
# 1. 完整重置
rmdir /s node_modules
rmdir /s dist
rmdir /s dist-electron
npm install
npm run electron:build-dev

# 2. 检查防火墙设置
# 确保防火墙允许 Node.js 和 Electron

# 3. 以管理员身份运行
# 右键启动脚本 -> "以管理员身份运行"
```

### 📋 完整诊断清单

在寻求帮助前，请运行以下完整诊断：

```cmd
echo === 系统信息 ===
systeminfo | findstr /C:"OS"
echo.

echo === Node.js 环境 ===
node --version
npm --version
echo.

echo === 项目状态 ===
dir package.json
dir scripts\
dir node_modules\
echo.

echo === 健康检查 ===
npm run health-check
echo.

echo === 端口状态 ===
netstat -an | findstr :5174
echo.

echo === 构建测试 ===
npm run electron:build-dev
echo.

echo === 依赖状态 ===
npm list --depth=0
```

### 🆘 获取帮助

如果以上方法都无法解决问题，请：

1. **运行修复版脚本** `start-app-fixed.bat` 并截图错误信息
2. **收集诊断信息** 运行上面的诊断清单
3. **检查日志文件** 查看是否有生成的日志文件
4. **尝试简单版本** 使用 `test-simple.bat` 进行基础测试

### 💡 预防措施

为了避免类似问题：

1. **定期更新**：保持 Node.js 和 npm 为最新版本
2. **清理缓存**：定期运行 `npm cache clean --force`
3. **使用修复版**：优先使用 `start-app-fixed.bat` 启动
4. **定期检查**：使用 `npm run health-check` 定期检查项目状态

---

> 💡 **提示**: 大多数启动问题都可以通过使用 `start-app-fixed.bat` 解决。这个版本专门处理了闪退问题并提供详细的错误信息。