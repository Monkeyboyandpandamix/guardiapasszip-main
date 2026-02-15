let _demoMode = false;
const listeners: ((active: boolean) => void)[] = [];

export const demoMode = {
  get isActive() {
    return _demoMode;
  },

  toggle() {
    _demoMode = !_demoMode;
    listeners.forEach(fn => fn(_demoMode));
    return _demoMode;
  },

  activate() {
    _demoMode = true;
    listeners.forEach(fn => fn(true));
  },

  deactivate() {
    _demoMode = false;
    listeners.forEach(fn => fn(false));
  },

  subscribe(fn: (active: boolean) => void) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },
};
