import { describe, it, expect } from 'vitest'
import { parseM3U, search, dedupe, servers } from './m3u'
const sample = `#EXTM3U
#EXTINF:-1 tvg-id="A.in" tvg-logo="https://x/logo.png" group-title="News" tvg-language="Hindi",Aaj <b>News</b>
https://example.com/a.m3u8
#EXTINF:-1 group-title="Kids",Pogo
javascript:alert(1)
#EXTINF:-1 group-title="Kids",Cartoon HD
#EXTVLCOPT:http-referrer=x
http://example.com/c.m3u8`
describe('parseM3U', () => {
  const r = parseM3U(sample)
  it('parses valid entries and drops unsafe URLs', () => { expect(r.map(c => c.url)).toEqual(['https://example.com/a.m3u8', 'http://example.com/c.m3u8']) })
  it('sanitizes names and categorizes', () => { expect(r[0].name).toBe('Aaj bNews/b'); expect(r[0].category).toBe('News'); expect(r[1].category).toBe('Kids & Cartoons') })
  it('searches loosely', () => { expect(search(r, 'cartoon-hd')).toHaveLength(1) })
})

describe('servers', () => {
  const l = parseM3U(`#EXTM3U
#EXTINF:-1,Hungama TV (480p)
https://a/1.m3u8
#EXTINF:-1,Hungama TV (720p) [Not 24/7]
https://a/2.m3u8
#EXTINF:-1,Pogo
https://a/3.m3u8`)
  it('keeps best quality per channel and lists backups', () => {
    expect(dedupe(l).map(c => c.url)).toEqual(['https://a/2.m3u8', 'https://a/3.m3u8'])
    expect(servers(l, l[1]).map(c => c.url)).toEqual(['https://a/1.m3u8'])
  })
})
