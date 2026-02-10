import { useSyncExternalStore, useCallback } from 'react';
import type { GameState } from '../core/types.ts';
import { GameStore } from '../core/GameStore.ts';

const store = GameStore.Instance;

const subscribe = (listener: () => void) => store.subscribe(listener);
const getSnapshot = () => store.State;

export function useGameStore(): GameState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useGameStoreSelector<T>(selector: (state: GameState) => T): T {
  const selectorStable = useCallback(
    () => selector(getSnapshot()),
    [selector],
  );
  return useSyncExternalStore(subscribe, selectorStable);
}

export { store };
