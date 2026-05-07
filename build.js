const fs = require('fs')
const path = require('path')

const DIST_DIR = path.join(__dirname, 'dist')
const FILES_TO_COPY = [
  'manifest.json',
  'background.js',
  'bridge.js',
  'always-active-inject.js',
  'popup.html',
  'popup.js',
  'popup.css'
]
const DIRS_TO_COPY = ['icons']

// Clean or create dist directory
if (fs.existsSync(DIST_DIR)) {
  console.log('Cleaning existing dist directory...')
  fs.rmSync(DIST_DIR, { recursive: true, force: true })
}
fs.mkdirSync(DIST_DIR)

// Copy individual files
FILES_TO_COPY.forEach((file) => {
  const src = path.join(__dirname, file)
  const dest = path.join(DIST_DIR, file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(`✓ Copied: ${file}`)
  } else {
    console.warn(`! Warning: ${file} not found, skipping.`)
  }
})

// Copy directories
DIRS_TO_COPY.forEach((dir) => {
  const srcDir = path.join(__dirname, dir)
  const destDir = path.join(DIST_DIR, dir)

  if (fs.existsSync(srcDir)) {
    copyFolderRecursiveSync(srcDir, DIST_DIR)
    console.log(`✓ Copied directory: ${dir}`)
  }
})

function copyFolderRecursiveSync(source, target) {
  let files = []
  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder)
  }

  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source)
    files.forEach(function (file) {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder)
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file))
      }
    })
  }
}

console.log('\n🚀 Build complete! Your extension is ready in the "dist" folder.')
