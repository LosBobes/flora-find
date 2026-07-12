// Generates the PNG PWA icons from the FloraFind brand leaf mark.
// The generated files in ./public are committed, so this only needs to run when
// the brand mark changes. It depends on `sharp`, which is intentionally NOT a
// declared dependency (it would bloat CI installs) — install it ad hoc first:
//   npm i -D sharp && node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// The white leaf mark (matches BrandMark in src/icons.jsx), drawn on a 24x24 grid.
const leaf = (scale, translate) => `
  <g transform="translate(${translate} ${translate}) scale(${scale})">
    <path d="M20 4 C 8.8 4 3.8 9.6 3.8 19.4 C 3.8 20 4.3 20.4 4.9 20.1 C 13.4 15.9 18.8 11 20.2 4.6 C 20.3 4.2 20 4 20 4 Z" fill="#ffffff"/>
    <path d="M6 18.4 C 10 13.8 14 9.4 18 5.6" stroke="#2e7d32" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M8.4 12 L 9.6 14.3 L 12 15.3" stroke="#2e7d32" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11.6 9.1 L 12.6 11.1 L 14.6 11.9" stroke="#2e7d32" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14.6 6.7 L 15.4 8.2 L 16.9 8.9" stroke="#2e7d32" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`

// Standard icon: rounded green tile with the leaf inset (~58% of the box).
function standardSvg(size) {
  const radius = Math.round(size * 0.22)
  const inner = size * 0.58
  const scale = inner / 24
  const translate = (size - inner) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#2e7d32"/>
    ${leaf(scale, translate)}
  </svg>`
}

// Maskable icon: full-bleed green so the platform can crop to any shape, with the
// leaf kept inside the ~80% safe zone.
function maskableSvg(size) {
  const inner = size * 0.5
  const scale = inner / 24
  const translate = (size - inner) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#2e7d32"/>
    ${leaf(scale, translate)}
  </svg>`
}

const targets = [
  { name: 'pwa-192.png', svg: standardSvg(192) },
  { name: 'pwa-512.png', svg: standardSvg(512) },
  { name: 'pwa-maskable-512.png', svg: maskableSvg(512) },
  { name: 'apple-touch-icon.png', svg: standardSvg(180) },
]

for (const { name, svg } of targets) {
  await sharp(Buffer.from(svg)).png().toFile(join(publicDir, name))
  console.log('wrote', name)
}
