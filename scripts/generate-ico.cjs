const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function generateIco() {
  try {
    console.log('Starting .ico icon generation...');
    
    const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
    
    const pngFiles = [
      path.join(iconsDir, 'icon-16x16.png'),
      path.join(iconsDir, 'icon-32x32.png'),
      path.join(iconsDir, 'icon-48x48.png'),
      path.join(iconsDir, 'icon-256x256.png')
    ];
    
    for (const file of pngFiles) {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }
    }
    
    const icoBuffer = await pngToIco(pngFiles);
    const icoPath = path.join(iconsDir, 'icon.ico');
    
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`Generated .ico file: ${icoPath}`);
    
    console.log('.ico icon generation completed!');
    
  } catch (error) {
    console.error('Error generating .ico file:', error);
    process.exit(1);
  }
}

generateIco();