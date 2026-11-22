import {makeAutoObservable} from 'mobx';

class MockNovaStore {
  userName = '';
  hudExpanded = false;
  timers: Array<{id: string; label: string; endsAt: number}> = [];

  constructor() {
    makeAutoObservable(this);
  }

  setUserName = jest.fn((name: string) => {
    this.userName = name;
  });
  toggleHud = jest.fn(() => {
    this.hudExpanded = !this.hudExpanded;
  });
  addTimer = jest.fn();
  cancelAllTimers = jest.fn(() => 0);
}

export const mockNovaStore = new MockNovaStore();
