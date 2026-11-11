import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { PlanStep, Run } from '../types'

const run = atom({ plugin: 'barra-progresso', key: 'run' } as const, null)
const frame = atom({ plugin: 'barra-progresso', key: 'frame' } as const, 0)

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const PARTS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
const WIDTH = 30
const TICK_MS = 80
const HIDE_MS = 4000

// ---------- Stima del progresso ----------

function current(plan: readonly PlanStep[]): number {
  return plan.findIndex(p => p.status === 'in_progress')
}

// Con la lista dei passi: passi completati sul totale, piu' una parte del passo in corso
// che cresce col tempo e con le azioni fatte dentro quel passo (al massimo l'85% del passo).
// Senza lista: una curva lenta che continua sempre a muoversi.
function target(r: Run): number {
  if (r.isDone) return 100
  const plan = r.plan ?? []
  if (plan.length > 0) {
    const done = plan.filter(p => p.status === 'completed').length
    if (done === plan.length) return 99
    const inStep = current(plan) >= 0
    const secs = (r.now - (r.stepStartedAt ?? r.startedAt)) / 1000
    const x = secs / 60 + (r.stepActions ?? 0) * 0.25
    const partial = inStep ? 0.85 * (x / (1 + x)) : 0
    return Math.min(98, (100 * (done + partial)) / plan.length)
  }
  const secs = (r.now - r.startedAt) / 1000
  const x = secs / 40 + r.steps * 0.2
  return 90 * (x / (1 + x))
}

// La percentuale mostrata insegue quella stimata, senza scatti e senza tornare indietro.
function ease(r: Run): number {
  const shown = r.shown ?? 0
  const goal = target(r)
  if (goal <= shown) return shown
  const next = shown + (goal - shown) * (r.isDone ? 0.3 : 0.12)
  return goal - next < 0.3 ? goal : next
}

// Applica un aggiornamento della lista dei passi, come fa l'app.
function applyPlan(
  plan: readonly PlanStep[],
  u: { items?: readonly { content: string; status: PlanStep['status'] }[]; advance?: boolean; done?: readonly number[]; start?: number },
): PlanStep[] {
  if (u.items) return u.items.map(i => ({ label: i.content, status: i.status }))
  const out = plan.map(p => ({ ...p }))
  if (u.advance) {
    const i = current(out)
    const cur = out[i]
    if (cur) cur.status = 'completed'
    const nextPending = out.findIndex((p, j) => j > i && p.status === 'pending')
    const target = out[nextPending]
    if (target) target.status = 'in_progress'
  }
  for (const n of u.done ?? []) {
    const step = out[n - 1]
    if (step) step.status = 'completed'
  }
  if (u.start !== undefined) {
    const step = out[u.start - 1]
    if (step) step.status = 'in_progress'
  }
  return out
}

// Barra con 8 sotto-livelli per cella.
function bar(pct: number): string {
  const eighths = Math.round((pct / 100) * WIDTH * 8)
  const full = Math.floor(eighths / 8)
  const part = PARTS[eighths % 8] ?? ''
  const used = full + (part ? 1 : 0)
  return '█'.repeat(full) + part + '░'.repeat(Math.max(0, WIDTH - used))
}

// ---------- La mascotte (pose prese dal disegno originale di Claude Code) ----------

type Eyes = 'open' | 'left' | 'right' | 'closed' | 'wink'
type Arms = 'down' | 'up' | 'one-up'
type Feet = 'both' | 'left' | 'right'

const EYES: Record<Eyes, string> = {
  open: '▛███▛█',
  left: '▟███▟█',
  right: '█▟███▟',
  closed: '▂███▂█',
  wink: '▛███▂█',
}
const ARMS: Record<Arms, { r1L: string; r1R: string; r2L: string; r2R: string }> = {
  down: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▀' },
  up: { r1L: '▗▟', r1R: '▄', r2L: ' ▜', r2R: '█▘' },
  'one-up': { r1L: ' ▐', r1R: '▄', r2L: '▝▜', r2R: '█▘' },
}
const FEET: Record<Feet, string> = {
  both: ' ▝▝   ▝▝ ',
  left: ' ▝▝      ',
  right: '      ▝▝ ',
}
const SPRITE_W = 9
const BLANK = ' '.repeat(SPRITE_W)

function sprite(eyes: Eyes, arms: Arms, feet: Feet): string[] {
  const a = ARMS[arms]
  return [
    (a.r1L + EYES[eyes] + a.r1R).padEnd(SPRITE_W),
    (a.r2L + '█████' + a.r2R).padEnd(SPRITE_W),
    FEET[feet],
  ]
}

// Nuvoletta a fumetto di 3 righe accanto alla mascotte.
function cloud(content: string): string[] {
  const c = content.padEnd(5).slice(0, 5)
  return ['  ╭───────╮', ' ─┤ ' + c + ' │', '  ╰───────╯']
}

function cloudContent(phase: string, f: number): string {
  const beat = Math.floor(f / 4) % 3
  if (phase === 'Penso') return [' ·', ' · ·', ' · · ·'][beat] ?? ''
  if (phase === 'Leggo i file') return ['⌕', '  ⌕', '    ⌕'][beat] ?? ''
  if (phase === 'Scrivo') return ['✎', '✎ ─', '✎ ──'][beat] ?? ''
  if (phase === 'Eseguo comandi') return beat === 1 ? ' >' : ' >_'
  if (phase === 'Lavoro con un agente') return beat === 1 ? ' ☺ ☺' : '☺ ☺'
  if (phase === 'Fatto') return '  ✓'
  if (phase === 'Interrotto' || phase === 'Terminato con errore') return '  !'
  return beat === 1 ? '  ✦' : '  ⚙'
}

function mascot(r: Run, f: number, finished: boolean): string[] {
  const ok = r.phase === 'Fatto'
  const step = Math.floor(f / 3) % 4
  const walkFeet: Feet = step === 1 ? 'left' : step === 3 ? 'right' : 'both'
  const blink = f % 30 < 2
  let eyes: Eyes = blink ? 'closed' : 'open'
  let arms: Arms = 'down'
  let feet: Feet = walkFeet
  let lifted = false

  if (finished && ok) {
    // Festeggia: braccia alzate, saltella e fa l'occhiolino.
    arms = 'up'
    feet = 'both'
    eyes = Math.floor(f / 6) % 3 === 2 ? 'wink' : 'open'
    lifted = Math.floor(f / 3) % 2 === 0
  } else if (r.isDone && !ok) {
    eyes = 'closed'
    feet = 'both'
  } else if (r.phase === 'Penso') {
    // Si guarda intorno e ondeggia.
    eyes = blink ? 'closed' : Math.floor(f / 10) % 2 === 0 ? 'left' : 'right'
    feet = 'both'
    lifted = Math.floor(f / 6) % 2 === 1
  } else if (r.phase === 'Leggo i file') {
    eyes = blink ? 'closed' : 'right'
  } else if (r.phase === 'Scrivo' || r.phase === 'Eseguo comandi') {
    arms = Math.floor(f / 3) % 2 === 0 ? 'one-up' : 'down'
  }

  const body = sprite(eyes, arms, feet)
  const rows = lifted ? [...body, BLANK] : [BLANK, ...body]
  const bubble = ['', ...cloud(cloudContent(r.phase, f))]
  const x = Math.round(((r.shown ?? 0) / 100) * (WIDTH + 7 - SPRITE_W - 11))
  const pad = ' '.repeat(Math.max(0, x))
  // Spazi non separabili: l'app desktop non li comprime e il disegno resta intero.
  return rows.map((line, i) => (pad + line + (bubble[i] ?? '')).replace(/ /g, ' '))
}

function status(r: Run): string {
  const plan = r.plan ?? []
  if (r.isDone || plan.length === 0) return r.steps > 0 ? `${r.phase} · ${r.steps} azioni` : r.phase
  const i = current(plan)
  const done = plan.filter(p => p.status === 'completed').length
  if (i < 0) return done === plan.length ? `Tutti i ${plan.length} passi fatti · scrivo la risposta` : `${done}/${plan.length} passi`
  const label = plan[i]?.label ?? ''
  const short = label.length > 42 ? label.slice(0, 41) + '…' : label
  return `Passo ${i + 1}/${plan.length}: ${short}`
}

function phaseLabel(tool: string): string {
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return 'Leggo i file'
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return 'Scrivo'
  if (tool === 'Bash') return 'Eseguo comandi'
  if (tool === 'Agent') return 'Lavoro con un agente'
  if (tool.startsWith('mcp__')) return 'Uso uno strumento'
  return 'Lavoro'
}

// ---------- Hook ----------

// Stato dei timer: vive nel modulo e ricomincia a ogni ricaricamento.
const live: { tick: Timer | null; hide: Timer | null; sawWorking: boolean; sawIdle: boolean } = {
  tick: null,
  hide: null,
  sawWorking: false,
  sawIdle: false,
}

function stop() {
  live.tick?.cancel()
  live.tick = null
}

function scheduleHide($: EngineInterface) {
  if (live.hide !== null) return
  live.hide = $.clock.after(HIDE_MS, () => {
    stop()
    live.hide = null
    void update($, run, x => (x && x.isDone ? null : x)).catch(() => {})
  })
}

async function step($: EngineInterface) {
  const t = await $.clock.now()
  await update($, frame, f => (f + 1) % 8400)
  const r = await update($, run, r => {
    if (!r) return r
    let m: Run = r
    if (!m.isDone && live.sawIdle) m = { ...m, isDone: true, phase: 'Fatto', now: t }
    else if (!m.isDone) m = { ...m, now: t }
    return { ...m, shown: ease(m) }
  })
  if (r === null) {
    stop()
    return
  }
  if (r.isDone && (r.shown ?? 0) >= 100) scheduleHide($)
}

function ensureTick($: EngineInterface) {
  if (live.tick !== null) return
  live.tick = $.clock.every(TICK_MS, () => {
    void step($).catch(() => {})
  })
}

async function finishSoon($: EngineInterface) {
  const r = await update($, run, r => (r && r.isDone ? { ...r, shown: 100 } : r))
  if (r) scheduleHide($)
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      stop()
      live.hide?.cancel()
      live.hide = null
      live.sawWorking = false
      live.sawIdle = false
      await update($, run, () => ({ startedAt: now, now, steps: 0, phase: 'Penso', isDone: false, shown: 0 }))
      ensureTick($)
    } catch {}
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      const t = await $.clock.now()
      if (e.tool === 'mcp__ccd_turn__update_plan') {
        const u = { items: e.items, advance: e.advance, done: e.done, start: e.start }
        await update($, run, r => {
          if (!r || r.isDone) return r
          const before = current(r.plan ?? [])
          const plan = applyPlan(r.plan ?? [], u)
          const after = current(plan)
          const moved = after !== before || u.items !== undefined
          return moved ? { ...r, plan, stepStartedAt: t, stepActions: 0 } : { ...r, plan }
        })
      } else if (e.tool === 'mcp__ccd_turn__wrap_up') {
        await update($, run, r =>
          r && !r.isDone && r.plan ? { ...r, plan: r.plan.map(p => ({ ...p, status: 'completed' as const })), phase: 'Scrivo' } : r,
        )
      } else {
        const label = phaseLabel(e.tool)
        await update($, run, r =>
          r && !r.isDone ? { ...r, steps: r.steps + 1, stepActions: (r.stepActions ?? 0) + 1, phase: label } : r,
        )
      }
    } catch {}
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    try {
      const t = await $.clock.now()
      const phase = e.reason === 'answer' ? 'Fatto' : e.reason === 'aborted' ? 'Interrotto' : 'Terminato con errore'
      await update($, run, r => (r ? { ...r, now: t, phase, isDone: true } : r))
      // Riparto l'animazione da qui, così la barra arriva al 100% anche se il timer si era fermato.
      stop()
      ensureTick($)
      // Riserva: se l'animazione non parte, tra poco porto comunque la barra al 100%.
      $.clock.after(1500, () => {
        void finishSoon($).catch(() => {})
      })
    } catch {}
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)
    if (e.props.hasSurvey || r === null) return next(e)

    if (!r.isDone) {
      if (e.props.isWorking) live.sawWorking = true
      else if (live.sawWorking && !live.sawIdle) {
        live.sawIdle = true
        try {
          ensureTick($)
        } catch {}
      }
    }

    const f = await read($, frame)
    const shown = r.shown ?? 0
    const pct = Math.round(shown)
    const secs = Math.max(0, Math.round((r.now - r.startedAt) / 1000))
    const finished = r.isDone && shown >= 100
    const ok = r.phase === 'Fatto'
    const icon = finished ? (ok ? '✓' : '■') : SPIN[f % SPIN.length] ?? '·'
    const color = finished ? (ok ? 'green' : 'yellow') : 'cyan'
    const art = mascot(r, f, finished)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {art.map((line, i) => (
          <Box key={`m${i}`}>
            <Text color="claude" mono wrap="truncate-end">
              {line}
            </Text>
          </Box>
        ))}
        <Box>
          <Text color={color} mono>
            {icon} {bar(shown)} {String(pct).padStart(3)}%
          </Text>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {status(r)} · {secs}s
          </Text>
        </Box>
      </Box>
    )
  })
}
