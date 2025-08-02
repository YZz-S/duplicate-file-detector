const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 确保输出目录存在
const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 源图标文件
const sourceIcon = path.join(__dirname, '..', 'assets', 'app-icon.png');

// 生成不同尺寸的图标
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generateIcons() {
  try {
    console.log('开始生成图标文件...');
    
    // 生成PNG格式的不同尺寸
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(sourceIcon)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`生成: ${outputPath}`);
    }
    
    // 生成favicon.ico (16x16, 32x32, 48x48)
    const faviconSizes = [16, 32, 48];
    const faviconBuffers = [];
    
    for (const size of faviconSizes) {
      const buffer = await sharp(sourceIcon)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      faviconBuffers.push(buffer);
    }
    
    // 生成主图标文件
    const mainIconPath = path.join(iconsDir, 'icon.png');
    await sharp(sourceIcon)
      .resize(512, 512, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(mainIconPath);
    console.log(`生成主图标: ${mainIconPath}`);
    
    // 复制到public目录作为favicon
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // 使用32x32的图标作为favicon
    const faviconPath = path.join(publicDir, 'favicon.png');
    const iconPath32 = path.join(iconsDir, 'icon-32x32.png');
    fs.copyFileSync(iconPath32, faviconPath);
    console.log(`复制favicon: ${faviconPath}`);
    
    console.log('所有图标文件生成完成！');
    
  } catch (error) {
    console.error('生成图标时出错:', error);
    process.exit(1);
  }
}

generateIcons();