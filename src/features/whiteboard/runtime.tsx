import { createContext } from 'react'
import type { RuntimeContextValue } from './types'

export const RuntimeContext = createContext<RuntimeContextValue>({
  status: 'idle',
  error: null,
  runCode: async () => undefined,
})
