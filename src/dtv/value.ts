/**
 * Value tracking — metrics and ROI for agent operations.
 */
export interface ValueMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export class ValueTracker {
  private metrics: Map<string, ValueMetric[]> = new Map();
  private trackedNames: Set<string>;

  constructor(metricNames: string[] = []) {
    this.trackedNames = new Set(metricNames);
  }

  record(name: string, value: number, unit: string = ''): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push({ name, value, unit, timestamp: Date.now() });
  }

  getMetrics(name: string): ValueMetric[] {
    return this.metrics.get(name) ?? [];
  }

  getAverage(name: string): number {
    const m = this.getMetrics(name);
    if (m.length === 0) return 0;
    return m.reduce((sum, v) => sum + v.value, 0) / m.length;
  }

  getSummary(): Record<string, { count: number; average: number; last: number }> {
    const result: Record<string, { count: number; average: number; last: number }> = {};
    for (const [name, values] of this.metrics) {
      result[name] = {
        count: values.length,
        average: this.getAverage(name),
        last: values[values.length - 1]?.value ?? 0,
      };
    }
    return result;
  }
}
