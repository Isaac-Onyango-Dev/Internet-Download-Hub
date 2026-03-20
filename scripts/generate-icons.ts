import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import toIco from 'to-ico'
import * as png2icons from 'png2icons'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SOURCE_IMAGE = path.join(__dirname, '../assets/logo-clear.svg')
const OUTPUT_DIR = path.join(__dirname, '../assets/icons')

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

async function generateIcons() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (const size of sizes) {
    await sharp(SOURCE_IMAGE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`))
    console.log(`Generated ${size}x${size} icon`)
  }

  // Copy 512px as main icon
  fs.copyFileSync(
    path.join(OUTPUT_DIR, 'icon-512.png'),
    path.join(__dirname, '../assets/icon.png')
  )

  console.log('All PNG icons generated successfully')

  await generateWindowsIco()
  await generateMacIcns()
}

async function generateWindowsIco() {
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    icoSizes.map(size =>
      sharp(SOURCE_IMAGE)
        .resize(size, size, {
           fit: 'contain',
           background: { r: 0, g: 0, b: 0, alpha: 0 }
         })
        .png()
        .toBuffer()
    )
  )

  const icoBuffer = await toIco(pngBuffers)
  fs.writeFileSync(path.join(__dirname, '../assets/icon.ico'), icoBuffer)
  console.log('Windows ICO generated')
}

async function generateMacIcns() {
  const input = fs.readFileSync(path.join(OUTPUT_DIR, 'icon-1024.png'))
  const icns = png2icons.createICNS(input, png2icons.BILINEAR, 0)
  if (icns) {
    fs.writeFileSync(path.join(__dirname, '../assets/icon.icns'), icns)
    console.log('Mac ICNS generated')
  } else {
    console.error('Failed to generate ICNS')
  }
}

generateIcons().catch(console.error)
