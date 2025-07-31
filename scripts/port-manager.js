#!/usr/bin/env node

import http from 'http';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

// 检查端口是否被占用
function checkPort(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.listen(port, (err) => {
            if (err) {
                resolve(false);
            } else {
                server.close(() => resolve(true));
            }
        });
        server.on('error', () => resolve(false));
    });
}

// 查找占用端口的进程
async function findPortProcess(port) {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split('\n');
            const processes = [];

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
                    const pid = parts[4];
                    try {
                        const { stdout: taskOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
                        const taskLines = taskOutput.split('\n');
                        if (taskLines.length > 1) {
                            const processInfo = taskLines[1].split(',');
                            const processName = processInfo[0].replace(/"/g, '');
                            processes.push({ pid, name: processName });
                        }
                    } catch (e) {
                        processes.push({ pid, name: 'Unknown' });
                    }
                }
            }
            return processes;
        } else {
            // macOS/Linux
            const { stdout } = await execAsync(`lsof -ti:${port}`);
            const pids = stdout.trim().split('\n').filter(pid => pid);
            const processes = [];

            for (const pid of pids) {
                try {
                    const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
                    const processName = psOutput.trim();
                    processes.push({ pid, name: processName });
                } catch (e) {
                    processes.push({ pid, name: 'Unknown' });
                }
            }
            return processes;
        }
    } catch (error) {
        return [];
    }
}

// 杀掉占用端口的进程
async function killPortProcess(port) {
    try {
        if (process.platform === 'win32') {
            await execAsync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`);
        } else {
            await execAsync(`lsof -ti:${port} | xargs kill -9`);
        }
        return true;
    } catch (error) {
        return false;
    }
}

// 智能端口管理
async function managePort(port, options = {}) {
    const { autoKill = false, interactive = true } = options;

    log(`检查端口 ${port} 的占用情况...`, colors.cyan);

    const isAvailable = await checkPort(port);
    if (isAvailable) {
        log(`✓ 端口 ${port} 可用`, colors.green);
        return { available: true };
    }

    log(`✗ 端口 ${port} 被占用`, colors.red);

    // 查找占用进程
    const processes = await findPortProcess(port);
    if (processes.length === 0) {
        log('无法找到占用端口的进程', colors.yellow);
        return { available: false, processes: [] };
    }

    log('发现以下进程占用端口:', colors.yellow);
    processes.forEach(proc => {
        log(`  - PID: ${proc.pid}, 进程: ${proc.name}`, colors.magenta);
    });

    if (autoKill) {
        log('正在自动终止占用进程...', colors.yellow);
        const killed = await killPortProcess(port);
        if (killed) {
            // 等待一下让端口释放
            await new Promise(resolve => setTimeout(resolve, 1000));
            const isNowAvailable = await checkPort(port);
            if (isNowAvailable) {
                log(`✓ 端口 ${port} 已释放`, colors.green);
                return { available: true, killed: true };
            }
        }
        log(`✗ 无法自动释放端口 ${port}`, colors.red);
    }

    if (interactive) {
        log('\n解决方案:', colors.cyan);
        if (process.platform === 'win32') {
            log(`手动终止: taskkill /PID ${processes[0].pid} /F`, colors.yellow);
            log(`或查看所有占用: netstat -ano | findstr :${port}`, colors.yellow);
        } else {
            log(`手动终止: kill -9 ${processes[0].pid}`, colors.yellow);
            log(`或查看所有占用: lsof -i:${port}`, colors.yellow);
        }
    }

    return { available: false, processes };
}

// 等待端口可用
async function waitForPort(port, maxRetries = 30, retryInterval = 1000) {
    log(`等待端口 ${port} 可用...`, colors.cyan);

    for (let i = 0; i < maxRetries; i++) {
        const isAvailable = await checkPort(port);
        if (isAvailable) {
            log(`✓ 端口 ${port} 已可用`, colors.green);
            return true;
        }

        process.stdout.write(`\r${colors.yellow}等待中... (${i + 1}/${maxRetries})${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    console.log(); // 换行
    log(`✗ 端口 ${port} 等待超时`, colors.red);
    return false;
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const port = parseInt(args[1]) || 5174;

    switch (command) {
        case 'check':
            await managePort(port, { autoKill: false });
            break;

        case 'kill':
            await managePort(port, { autoKill: true });
            break;

        case 'wait':
            await waitForPort(port);
            break;

        case 'smart':
            const result = await managePort(port, { autoKill: false });
            if (!result.available) {
                log('\n是否要自动终止占用进程？(y/N)', colors.cyan);
                // 在实际使用中，这里可以添加交互式输入
                // 为了脚本自动化，这里暂时跳过交互
                process.exit(1);
            }
            break;

        default:
            log('用法: node port-manager.js <command> [port]', colors.cyan);
            log('命令:', colors.yellow);
            log('  check [port] - 检查端口占用情况', colors.white);
            log('  kill [port]  - 强制释放端口', colors.white);
            log('  wait [port]  - 等待端口可用', colors.white);
            log('  smart [port] - 智能端口管理', colors.white);
            log('\n默认端口: 5174', colors.yellow);
            break;
    }
}

// 导出函数供其他脚本使用
export { checkPort, findPortProcess, killPortProcess, managePort, waitForPort };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}