// Layout check for the tester. Not part of `node --test`: it needs a browser.
// Run with the Playwright that is already installed in the container:
//   node scripts/layout-check.cjs
// For each tab and each screen size it checks that:
//   1. the page itself does not scroll (vertically or sideways);
//   2. the bottom-most control (Parent, or Start on the timer) can be reached, either on screen or
//      by scrolling the tool area;
//   3. the top tab bar has no tab cut off, and each tab is a 48px square.
// Prints one line per check and exits 1 if any check fails.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const ROOT = path.resolve(__dirname, '..')
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }
const SIZES = [
  { name: 'phone-small', w: 360, h: 640, touch: true },
  { name: 'phone', w: 390, h: 844, touch: true },
  { name: 'phone-landscape', w: 740, h: 360, touch: true },
  { name: 'tablet', w: 768, h: 1024, touch: true },
  { name: 'desktop', w: 1280, h: 800, touch: false },
]
const TABS = [1, 2, 3, 4]

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
      const file = path.join(ROOT, rel)
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function checkTab(page, tab) {
  return page.evaluate((n) => {
    document.querySelector(`#switcher button:nth-child(${n})`).click()
    const tool = document.getElementById('tool-area')
    const root = document.documentElement
    const tabs = [...document.querySelectorAll('#switcher button')]
    const bottomMost = document.querySelector('.parent') || document.querySelector('#start-btn')
    const r = bottomMost ? bottomMost.getBoundingClientRect() : null
    return {
      pageScrollsY: root.scrollHeight > innerHeight + 1,
      pageScrollsX: root.scrollWidth > innerWidth + 1,
      controlReachable: !!r && (r.bottom <= innerHeight + 1 || tool.scrollHeight > tool.clientHeight + 1),
      controlName: bottomMost ? (bottomMost.textContent || bottomMost.id).trim() : 'none',
      tabsOk: tabs.every((b) => {
        const q = b.getBoundingClientRect()
        return q.width >= 48 && q.height >= 48 && q.right <= innerWidth + 1 && q.left >= -1
      }),
      innerScroll: tool.scrollHeight > tool.clientHeight + 1,
    }
  }, tab)
}

;(async () => {
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}/index.html`
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  let failures = 0
  try {
    for (const s of SIZES) {
      const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: s.touch, hasTouch: s.touch })
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      await page.goto(base)
      for (const tab of TABS) {
        const r = await checkTab(page, tab)
        const problems = []
        if (r.pageScrollsY) problems.push('page scrolls vertically')
        if (r.pageScrollsX) problems.push('page scrolls sideways')
        if (!r.controlReachable) problems.push(`${r.controlName} is off screen and not reachable by scrolling`)
        if (!r.tabsOk) problems.push('a tab is smaller than 48px or cut off')
        if (errors.length) problems.push('script error: ' + errors.join('; '))
        const note = r.innerScroll ? ' (tool area scrolls)' : ''
        console.log(`${problems.length ? 'FAIL' : 'ok  '} ${s.name} ${s.w}x${s.h} tab${tab}${note}${problems.length ? ' — ' + problems.join('; ') : ''}`)
        if (problems.length) failures++
      }
      await page.close()
    }
  } finally {
    await browser.close()
    server.close()
  }
  console.log(failures ? `${failures} check(s) failed` : 'all layout checks passed')
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
