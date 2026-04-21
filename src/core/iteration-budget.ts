import { BudgetState } from './types';

export class IterationBudget {
  private current = 0;

  constructor(private max: number) {}

  tick(): void { this.current++; }

  isExhausted(): boolean { return this.current >= this.max; }

  getState(): BudgetState {
    const ratio = this.current / this.max;
    if (ratio >= 1) return 'stop';
    if (ratio >= 0.9) return 'critical';
    if (ratio >= 0.7) return 'warn';
    return 'ok';
  }

  getCurrent(): number { return this.current; }
  getMax(): number { return this.max; }
}
