import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NovaTimer {
  id: string;
  label: string;
  endsAt: number;
}

/**
 * State for the NOVA assistant layer: how to address the user, whether
 * the HUD is expanded, and running countdown timers. Timers live in JS
 * memory only: if the OS kills the app they are gone (no native alarm).
 */
export class NovaStore {
  userName: string = '';
  hudExpanded: boolean = true;
  timers: NovaTimer[] = [];

  private handles = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    makeAutoObservable<NovaStore, 'handles'>(this, {handles: false});
    makePersistable(this, {
      name: 'NovaStore',
      properties: ['userName', 'hudExpanded'],
      storage: AsyncStorage,
    });
  }

  setUserName(name: string) {
    this.userName = name.trim().slice(0, 40);
  }

  toggleHud() {
    this.hudExpanded = !this.hudExpanded;
  }

  addTimer(label: string, ms: number, onFire: (timer: NovaTimer) => void) {
    const timer: NovaTimer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      endsAt: Date.now() + ms,
    };
    this.timers.push(timer);
    const handle = setTimeout(() => {
      this.handles.delete(timer.id);
      runInAction(() => {
        this.timers = this.timers.filter(t => t.id !== timer.id);
      });
      onFire(timer);
    }, ms);
    this.handles.set(timer.id, handle);
    return timer;
  }

  cancelAllTimers(): number {
    const n = this.timers.length;
    this.handles.forEach(h => clearTimeout(h));
    this.handles.clear();
    this.timers = [];
    return n;
  }
}

export const novaStore = new NovaStore();
