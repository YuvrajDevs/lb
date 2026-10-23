import { useSyncExternalStore } from 'react'
import { store } from '../game/store'

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get)
}
