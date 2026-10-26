// @ts-nocheck
// hls.js loader that uses the Android app's native HTTP stack, so the WebView's browser CORS rule does not apply.
// It only fetches the URLs the player asks for; it does not remove geo-blocks, logins, tokens or DRM.
import { CapacitorHttp } from '@capacitor/core'

const b64ToBuf = (b64: string) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer }

export class NativeLoader {
  constructor() {
    this.context = null
    this.stats = { aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0, loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 } }
    this.dead = false
  }
  destroy() { this.dead = true; this.context = null }
  abort() { this.dead = true; this.stats.aborted = true }
  async load(context, config, callbacks) {
    this.context = context; this.dead = false
    const s = this.stats; s.loading.start = performance.now()
    const binary = context.responseType === 'arraybuffer'
    const headers = { ...(context.headers || {}) }
    if (context.rangeStart !== undefined) headers.Range = `bytes=${context.rangeStart}-${context.rangeEnd !== undefined ? context.rangeEnd - 1 : ''}`
    try {
      const r = await CapacitorHttp.get({ url: context.url, headers, responseType: binary ? 'arraybuffer' : 'text', connectTimeout: config.timeout || 20000, readTimeout: config.timeout || 20000 })
      if (this.dead) return
      if (r.status < 200 || r.status >= 300) { callbacks.onError({ code: r.status, text: `HTTP ${r.status}` }, context, null, s); return }
      const data = binary ? b64ToBuf(r.data) : String(r.data)
      s.loading.first = s.loading.end = performance.now()
      s.loaded = s.total = binary ? data.byteLength : data.length
      callbacks.onSuccess({ url: r.url || context.url, data }, s, context, null)
    } catch (e) {
      if (this.dead) return
      callbacks.onError({ code: 0, text: String((e && e.message) || e) }, context, null, s)
    }
  }
  getCacheAge() { return null }
}
