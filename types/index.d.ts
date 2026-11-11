export type PlanStep = { label: string; status: 'pending' | 'in_progress' | 'completed' }

export type Run = {
  startedAt: number
  now: number
  steps: number
  phase: string
  isDone: boolean
  /** Percentuale mostrata, che insegue dolcemente quella stimata. */
  shown?: number
  /** La lista dei passi che Claude tiene per questa richiesta, se c'è. */
  plan?: PlanStep[]
  /** Quando è iniziato il passo in corso, e quante azioni ci ha fatto. */
  stepStartedAt?: number
  stepActions?: number
}

declare module 'claude-code' {
  interface PluginState {
    'barra-progresso': { run: Run | null; frame: number }
  }
}
