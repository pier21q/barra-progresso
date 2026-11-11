import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'barra-progresso',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 20, scroll: { offset: 0, bodyRows: 20 } },
} as const

test('la barra parte al messaggio, avanza e arriva a 100%', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const empty = await $.ui.mount({ ...BAND, surface })
    expect(await empty.find({ type: 'Text', text: /%/ })).toBeUndefined()
    await empty.unmount()
  }

  await $.prompt.submit({ text: 'ciao' } as never)
  await clock.advance(10_000)
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const mid = await ui.find({ type: 'Text', text: /%/ })
  expect(mid?.text).toMatch(/[1-9]\d?%/)
  expect((await ui.find({ type: 'Text', text: /azioni/ }))?.text).toMatch(/Eseguo comandi · 1 azioni · 10s/)
  await ui.unmount()

  await $.turn.complete({ reason: 'answer' } as never)
  await clock.advance(2000)
  const done = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await done.find({ type: 'Text', text: /%/ }))?.text).toMatch(/✓ .*100%/)
  await done.unmount()

  await clock.advance(4500)
  const gone = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await gone.find({ type: 'Text', text: /%/ })).toBeUndefined()
  await gone.unmount()
})

test('la barra si riempie senza scatti', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  let last = 0
  for (let i = 0; i < 30; i++) {
    if (i === 5) await $.tool.call({ tool: 'Read', file_path: '/x' } as never)
    await clock.advance(80)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const pct = Number(/(\d+)%/.exec((await ui.find({ type: 'Text', text: /%/ }))?.text ?? '')?.[1])
    await ui.unmount()
    expect(pct).toBeGreaterThanOrEqual(last)
    expect(pct - last).toBeLessThanOrEqual(3)
    last = pct
  }
})

test('la mascotte compare, cammina e festeggia', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  await clock.advance(400)
  const indent = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const head = (await ui.find({ type: 'Text', text: /▐/ }))?.text ?? ''
    await ui.unmount()
    return head.indexOf('▐')
  }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /─┤/ }))?.text).toMatch(/·/)
    expect(await ui.find({ type: 'Text', text: /▐▟███▟█|▐█▟███▟|▐▂███▂█/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▝▜██████▀/ })).toBeDefined()
    await ui.unmount()
  }
  const start = await indent()
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(30_000)
  expect(await indent()).toBeGreaterThan(start)

  await $.turn.complete({ reason: 'answer' } as never)
  await clock.advance(1500)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /─┤/ }))?.text).toMatch(/✓/)
  expect(await ui.find({ type: 'Text', text: /▗▟▛███▛█▄/ })).toBeDefined()
  await ui.unmount()
})

test('arriva al 100% anche se la fine del turno non arriva', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  await clock.advance(20_000)
  const working = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await working.unmount()
  const idle = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: false } })
  await idle.unmount()
  await clock.advance(2000)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: false } })
  expect((await ui.find({ type: 'Text', text: /%/ }))?.text).toMatch(/✓ .*100%/)
  await ui.unmount()
})

test('la nuvoletta e la mascotte hanno la forma giusta', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  await clock.advance(240)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /╭───────╮/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /─┤\s.*│/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▝▝\u00A0\u00A0\u00A0▝▝/ })).toBeDefined()
  await ui.unmount()
})

const pctOf = async ($: any) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const text = (await ui.find({ type: 'Text', text: /%/ }))?.text ?? ''
  const label = (await ui.find({ type: 'Text', text: /· \d+s$/ }))?.text ?? ''
  await ui.unmount()
  return { pct: Number(/(\d+)%/.exec(text)?.[1]), label }
}

test('segue la lista dei passi', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Leggo il codice', status: 'in_progress' },
      { content: 'Correggo il bug', status: 'pending' },
      { content: 'Aggiungo i test', status: 'pending' },
      { content: 'Verifico tutto', status: 'pending' },
    ],
    scope: 'continuation',
  } as never)
  await clock.advance(3000)
  const a = await pctOf($)
  expect(a.label).toMatch(/Passo 1\/4: Leggo il codice/)
  expect(a.pct).toBeLessThan(25)

  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true } as never)
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true } as never)
  await clock.advance(3000)
  const b = await pctOf($)
  expect(b.label).toMatch(/Passo 3\/4: Aggiungo i test/)
  expect(b.pct).toBeGreaterThanOrEqual(48)
  expect(b.pct).toBeLessThan(75)

  // Un passo lungo continua a muoversi ma non supera la sua parte.
  await clock.advance(200_000)
  const c = await pctOf($)
  expect(c.pct).toBeGreaterThan(b.pct)
  expect(c.pct).toBeLessThan(75)

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'ok' } as never)
  await clock.advance(3000)
  const d = await pctOf($)
  expect(d.pct).toBeGreaterThanOrEqual(97)
  expect(d.label).toMatch(/Tutti i 4 passi fatti/)
})

test('senza lista non resta mai fermo a lungo', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.prompt.submit({ text: 'ciao' } as never)
  await clock.advance(60_000)
  const a = await pctOf($)
  await clock.advance(140_000)
  const b = await pctOf($)
  expect(b.pct - a.pct).toBeGreaterThanOrEqual(10)
  expect(b.pct).toBeLessThan(90)
})
