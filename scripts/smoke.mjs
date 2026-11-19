import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { chromium } from 'playwright'
const dist = path.resolve('dist')
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' }
const server = http.createServer((req,res) => {
  const target = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname))
  if (!target.startsWith(dist + path.sep) && target !== dist) { res.writeHead(403).end(); return }
  const filename = target === dist || target.endsWith('/') ? path.join(target,'index.html') : target
  try { res.setHeader('Content-Type',types[path.extname(filename)] ?? 'application/octet-stream'); res.end(fs.readFileSync(filename)) } catch { res.writeHead(404).end() }
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({headless:true})
  const page = await browser.newPage({viewport:{width:1440,height:1250}})
  const errors = [], unexpected = [], blocked = []
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',request=>{ const url=new URL(request.url()); if(url.origin!==origin && !['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname) && !['data:','blob:'].includes(url.protocol)) unexpected.push(url.origin) })
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>{window.__blocked=(window.__blocked??[]).concat(event.blockedURI)}))
  await page.goto(origin, {waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Client roster',exact:true}).waitFor()
  assert.match(await page.title(),/Interactive Demo/)
  // Client page and plans (the demo has no cycle builder: its release flags are off in the public build).
  await page.getByRole('button',{name:/Maya Chen/}).first().click()
  await page.getByRole('button',{name:'View programs →',exact:true}).click()
  await page.getByRole('heading',{name:'Plans',exact:true}).waitFor()
  assert.match(await page.locator('main').innerText(),/Fall strength · 4 weeks/)
  await page.getByRole('button',{name:'Client roster',exact:true}).click()
  // Edit/save/refresh: an athlete added in the demo is saved to the demo's own storage and survives a reload.
  await page.getByRole('button',{name:'+ Add athlete',exact:true}).click()
  const add = page.getByRole('dialog',{name:'Add athlete'})
  await add.getByRole('textbox').first().fill('Showcase Athlete')
  await add.getByRole('button',{name:'Add athlete',exact:true}).click()
  await page.getByText('Showcase Athlete').first().waitFor()
  await page.waitForFunction(()=>(localStorage.getItem('unrack-showcase-workspace-v1')??'').includes('Showcase Athlete'))
  await page.screenshot({path:'dist/demo-workspace.png',fullPage:false})
  assert.equal(await page.getByRole('button',{name:'Reset demo',exact:true}).count(),1)
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Client roster',exact:true}).waitFor()
  await page.getByText('Showcase Athlete').first().waitFor()
  const keys = await page.evaluate(()=>Object.keys(localStorage))
  assert.ok(keys.includes('unrack-showcase-workspace-v1'))
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Reset demo',exact:true}).click()
  await page.getByRole('heading',{name:'Client roster',exact:true}).waitFor()
  assert.ok(!JSON.stringify(await page.evaluate(()=>localStorage.getItem('unrack-showcase-workspace-v1'))).includes('Showcase Athlete'))
  blocked.push(...await page.evaluate(()=>window.__blocked??[]))
  assert.deepEqual(errors, [], 'Browser runtime errors')
  assert.deepEqual(unexpected, [], 'Unexpected network destinations')
  assert.deepEqual(blocked, [], 'Unexpected CSP violations')
  console.log('PASS: built demo, roster, client page, plans, add-athlete save/refresh persistence, reset, runtime and network isolation')
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)) }
