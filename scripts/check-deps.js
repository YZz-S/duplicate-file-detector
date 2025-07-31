#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

// 检查必要的文件和目录
function checkProjectStructure() {
    log('检查项目结构...', colors.cyan);

    const requiredFiles = [
        'package.json',
        'electron/main.ts',
        'electron/preload.ts',
        'vite.config.ts',
        'vite.electron.config.ts'
    ];

    const requiredDirs = [
        'src',
        'electron'
    ];

    let allGood = true;

    // 检查文件
    requiredFiles.forEach(file => {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
            log(`✓ ${file}`, colors.green);
        } else {
            log(`✗ ${file} 缺失`, colors.red);
            allGood = false;
        }
    });

    // 检查目录
    requiredDirs.forEach(dir => {
        const dirPath = path.join(projectRoot, dir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            log(`✓ ${dir}/`, colors.green);
        } else {
            log(`✗ ${dir}/ 目录缺失`, colors.red);
            allGood = false;
        }
    });

    return allGood;
}

// 检查 node_modules
function checkNodeModules() {
    log('\n检查依赖安装...', colors.cyan);

    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        log('✗ node_modules 目录不存在', colors.red);
        return false;
    }

    // 检查关键依赖
    const criticalDeps = ['electron', 'vite', 'react', 'concurrently'];
    let allInstalled = true;

    criticalDeps.forEach(dep => {
        const depPath = path.join(nodeModulesPath, dep);
        if (fs.existsSync(depPath)) {
            log(`✓ ${dep}`, colors.green);
        } else {
            log(`✗ ${dep} 未安装`, colors.red);
            allInstalled = false;
        }
    });

    return allInstalled;
}

// 检查端口占用
function checkPorts() {
    return new Promise(async (resolve) => {
        log('\n检查端口占用...', colors.cyan);

        const net = await import('net');
        const server = net.default.createServer();

        server.listen(5174, () => {
            server.close(() => {
                log('✓ 端口 5174 可用', colors.green);
                resolve(true);
            });
        });

        server.on('error', () => {
            log('✗ 端口 5174 被占用', colors.red);
            resolve(false);
        });
    });
}

// 运行健康检查
async function runHealthCheck() {
    log('=== 项目健康检查 ===\n', colors.cyan);

    const structureOk = checkProjectStructure();
    const depsOk = checkNodeModules();
    const portsOk = await checkPorts();

    log('\n=== 检查结果 ===', colors.cyan);

    if (structureOk && depsOk && portsOk) {
        log('✓ 所有检查通过，项目可以正常启动！', colors.green);
        return true;
    } else {
        log('✗ 发现问题，请先解决以上问题再启动应用', colors.red);

        if (!depsOk) {
            log('\n建议运行: npm install', colors.yellow);
        }

        if (!portsOk) {
            log('\n建议关闭占用端口 5174 的进程', colors.yellow);
        }

        return false;
    }
}

// 自动修复一些问题
async function autoFix() {
    log('\n尝试自动修复...', colors.cyan);

    // 检查是否需要安装依赖
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        log('正在安装依赖...', colors.yellow);

        return new Promise((resolve) => {
            const installProcess = spawn('npm', ['install'], {
                cwd: projectRoot,
                stdio: 'inherit'
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    log('✓ 依赖安装完成', colors.green);
                    resolve(true);
                } else {
                    log('✗ 依赖安装失败', colors.red);
                    resolve(false);
                }
            });
        });
    }

    return true;
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const shouldFix = args.includes('--fix');

    if (shouldFix) {
        await autoFix();
    }

    const isHealthy = await runHealthCheck();
    process.exit(isHealthy ? 0 : 1);
}

main().catch(console.error);