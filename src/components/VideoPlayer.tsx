import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Capacitor } from '@capacitor/core'
import { NativeLoader } from '../lib/nativeLoader'
import type { Channel } from '../lib/m3u'

type State = 'loading' | 'playing' | 'error'
export default function VideoPlayer({ channel, onNext, onPrev, tv, reloadKey, backups = [] }: { channel: Channel; onNext: () => void; onPrev: () => void; tv?: boolean; reloadKey?: number; backups?: string[] }) {
  const ref = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [state, setState] = useState<State>('loading')
  const [msg, setMsg] = useState('')
  const [levels, setLevels] = useState<number[]>([])
  const [level, setLevel] = useState(-1)
  const [res, setRes] = useState('')
  const [tries, setTries] = useState(0)
  const [att, setAtt] = useState({ id: channel.id, n: 0 })
  const urls = [channel.url, ...backups]
  const n = att.id === channel.id ? Math.min(att.n, urls.length - 1) : 0
  const src = urls[n]
  useEffect(() => { if (reloadKey) setAtt({ id: channel.id, n: 0 }) }, [reloadKey]) // eslint-disable-line

  useEffect(() => {
    const v = ref.current!; setState('loading'); setMsg(''); setLevels([]); setLevel(-1); setRes('')
    if (n > 0) setMsg(`Trying backup server ${n + 1} of ${urls.length}…`)
    hlsRef.current?.destroy(); hlsRef.current = null
    const fail = (m: string) => {
      if (n < urls.length - 1) { setAtt({ id: channel.id, n: n + 1 }); return }
      setState('error'); setMsg(urls.length > 1 ? `All ${urls.length} servers failed. ${m}` : m)
    }
    const to = window.setTimeout(() => fail('No video after 15 seconds.'), 15000)
    const onPlay = () => clearTimeout(to)
    v.addEventListener('playing', onPlay)
    if (Hls.isSupported()) {
      const hls = new Hls(Capacitor.isNativePlatform() ? { startLevel: -1, loader: NativeLoader as any } : { startLevel: -1 })
      hlsRef.current = hls
      hls.loadSource(src); hls.attachMedia(v)
      hls.on(Hls.Events.MANIFEST_PARSED, (_, d) => { setLevels([...new Set(d.levels.map(l => l.height).filter(Boolean))].sort((a, b) => b - a)); v.play().catch(() => {}) })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => { const l = hls.levels[d.level]; if (l?.height) setRes(`${l.height}p`) })
      hls.on(Hls.Events.ERROR, (_, e) => {
        if (!e.fatal) return
        if (e.type === Hls.ErrorTypes.NETWORK_ERROR) fail(`Stream unreachable, offline or geo-restricted. (${e.details}${e.response?.code ? ', HTTP ' + e.response.code : ''}${e.response?.text ? ': ' + e.response.text : ''})`)
        else if (e.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else fail('Unsupported or corrupt stream.')
      })
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src; v.play().catch(() => {})
    } else fail('This browser cannot play HLS streams.')
    const onErr = () => fail('Playback error.')
    v.addEventListener('error', onErr)
    return () => { clearTimeout(to); v.removeEventListener('playing', onPlay); v.removeEventListener('error', onErr); hlsRef.current?.destroy() }
  }, [src, tries, reloadKey])

  const pick = (h: number) => {
    const hls = hlsRef.current; if (!hls) return
    const idx = h === -1 ? -1 : hls.levels.reduce((b, l, i) => (l.height === h && (b < 0 || l.bitrate > hls.levels[b].bitrate) ? i : b), -1)
    hls.currentLevel = idx; setLevel(h)
  }

  return (
    <div className="player">
      <video ref={ref} controls={!tv} autoPlay playsInline onPlaying={() => setState('playing')} onWaiting={() => setState(s => s === 'error' ? s : 'loading')} />
      {state === 'loading' && <div className="overlay"><div className="spinner" />{msg || `Loading ${channel.name}…`}</div>}
      {state === 'error' && <div className="overlay"><p>⚠ {msg}</p><div><button onClick={() => { setAtt({ id: channel.id, n: 0 }); setTries(t => t + 1) }}>Retry</button> <button onClick={onNext}>Next channel</button></div>{tv && <small>◀ retry · ▲▼ change channel · OK channel list</small>}</div>}
      <div className="bar">
        <button onClick={onPrev} aria-label="Previous channel">⏮</button>
        <strong>{channel.name}</strong>
        <span className="muted">{state}{res && ` · ${res}`}{urls.length > 1 && ` · server ${n + 1}/${urls.length}`}</span>
        <button onClick={onNext} aria-label="Next channel">⏭</button>
        {levels.length > 1 && <select value={level} onChange={e => pick(Number(e.target.value))}><option value={-1}>Auto</option>{levels.map(h => <option key={h} value={h}>{h}p</option>)}</select>}
        <button onClick={() => ref.current?.requestFullscreen?.()}>⛶</button>
      </div>
    </div>
  )
}
