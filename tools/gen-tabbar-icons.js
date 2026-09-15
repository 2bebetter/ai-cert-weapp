/**
 * 生成 tabBar 图标 PNG（微信小程序 tabBar 只支持本地 png，不支持 svg）
 *
 * 用法：node tools/gen-tabbar-icons.js
 * 产物：images/tab/*.png（81×81，对应 24×24 设计栅格）
 *
 * 不参与小程序打包：只被本脚本读写的图片才是产物，本文件本身不被任何页面引用。
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 81 // 微信推荐 81×81
const U = SIZE / 24 // 设计栅格单位：24×24 → 81×81
const STROKE = 2 // 线宽（栅格单位）

/* ── 图标定义：24×24 栅格下的折线与圆 ── */
const ICONS = {
  // 首页：屋顶 + 墙体 + 门
  home: {
    lines: [
      [[3.2, 9.6], [12, 2.6], [20.8, 9.6]],
      [[3.4, 9.2], [3.4, 20.6]],
      [[20.6, 9.2], [20.6, 20.6]],
      [[3.4, 20.6], [20.6, 20.6]],
      [[9.3, 20.6], [9.3, 13.2], [14.7, 13.2], [14.7, 20.6]]
    ]
  },
  // 理论学习：翻开的书（书脊 + 封面 + 两条文字线）
  book: {
    lines: [
      [[7.2, 3.2], [19.4, 3.2]],
      [[19.4, 3.2], [19.4, 20.8]],
      [[19.4, 20.8], [7.2, 20.8]],
      [[7.2, 3.2], [4.6, 5.4], [4.6, 18.6], [7.2, 20.8]],
      [[10.6, 8.2], [16, 8.2]],
      [[10.6, 12], [16, 12]]
    ]
  },
  // 实操学习：代码尖括号
  code: {
    lines: [
      [[15.4, 6.4], [21, 12], [15.4, 17.6]],
      [[8.6, 6.4], [3, 12], [8.6, 17.6]]
    ]
  },
  // 我的：头 + 肩
  user: {
    lines: [
      [[20, 20.6], [20, 19], [17, 15.6], [7, 15.6], [4, 19], [4, 20.6]]
    ],
    circles: [{ cx: 12, cy: 7.4, r: 4 }]
  }
}

const COLORS = {
  '': '#8e8e93',    // 未选中
  '-on': '#007aff'  // 选中
}

/* ── 光栅化：点到线段距离 → 抗锯齿覆盖度 ── */
function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = x0 + t * dx
  const cy = y0 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function coverage(icon, px, py) {
  const half = (STROKE * U) / 2
  let best = 0
  const touches = (d) => {
    // d 为到笔画中心线的距离；<=half 完全覆盖，向外 1px 线性衰减
    const a = half + 0.5 - d
    if (a > best) best = a
  }
  for (const line of icon.lines || []) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i]
      const [x1, y1] = line[i + 1]
      touches(distToSegment(px, py, x0 * U, y0 * U, x1 * U, y1 * U))
    }
  }
  for (const c of icon.circles || []) {
    const d = Math.abs(Math.hypot(px - c.cx * U, py - c.cy * U) - c.r * U)
    touches(d)
  }
  return best < 0 ? 0 : best > 1 ? 1 : best
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function render(icon, hex) {
  const [R, G, B] = hexToRgb(hex)
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  let p = 0
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < SIZE; x++) {
      const a = coverage(icon, x + 0.5, y + 0.5)
      raw[p++] = R
      raw[p++] = G
      raw[p++] = B
      raw[p++] = Math.round(a * 255)
    }
  }
  return raw
}

/* ── 最小 PNG 编码器 ── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ── 输出 ── */
const outDir = path.join(__dirname, '..', 'images', 'tab')
fs.mkdirSync(outDir, { recursive: true })

let n = 0
for (const [name, icon] of Object.entries(ICONS)) {
  for (const [suffix, hex] of Object.entries(COLORS)) {
    const file = path.join(outDir, `${name}${suffix}.png`)
    fs.writeFileSync(file, encodePng(render(icon, hex)))
    n++
  }
}
console.log(`✅ 生成 ${n} 个 tabBar 图标 → images/tab/`)
