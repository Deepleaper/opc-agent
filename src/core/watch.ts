import { EventEmitter } from 'events';

/**
 * ProcessWatcher — Background process output monitoring with pattern matching.
 *
 * Inspired by Hermes Agent's watch_patterns feature.
 * Set patterns to watch for in background process output and get callbacks
 * when they match — no polling needed.
 *
 * Usage:
 *   const watcher = new ProcessWatcher();
 *   watcher.watch(childProcess.stdout, {
 *     patterns: [
 *       { regex: /listening on port (\d+)/, label: 'server-ready' },
 *       { regex: /error|Error|ERROR/, label: 'error-detected' },
 *       { regex: /build completed/, label: 'build-done', once: true },
 *     ],
 *     onMatch: (match) => console.log(`[${match.label}] ${match.line}`),
 *   });
 */

export interface WatchPattern {
  /** Regex to match against each line of output */
  regex: RegExp;
  /** Human-readable label for this pattern */
  label: string;
  /** If true, auto-remove after first match */
  once?: boolean;
}

export interface WatchMatch {
  /** Pattern label */
  label: string;
  /** The full line that matched */
  line: string;
  /** Regex match groups */
  groups: string[];
  /** Timestamp of match */
  timestamp: number;
  /** Stream source */
  stream: 'stdout' | 'stderr';
}

export interface WatchOptions {
  /** Patterns to match */
  patterns: WatchPattern[];
  /** Callback on match */
  onMatch: (match: WatchMatch) => void;
  /** Optional: max matches to keep in history (default: 100) */
  maxHistory?: number;
}

export class ProcessWatcher extends EventEmitter {
  private watchers = new Map<string, {
    patterns: WatchPattern[];
    onMatch: (match: WatchMatch) => void;
    history: WatchMatch[];
    maxHistory: number;
  }>();

  private watcherIdCounter = 0;

  /**
   * Start watching a readable stream for patterns.
   * Returns a watcher ID that can be used to stop watching.
   */
  watch(
    stream: NodeJS.ReadableStream,
    options: WatchOptions,
    streamName: 'stdout' | 'stderr' = 'stdout',
  ): string {
    const id = `watcher_${++this.watcherIdCounter}`;
    const state = {
      patterns: [...options.patterns],
      onMatch: options.onMatch,
      history: [] as WatchMatch[],
      maxHistory: options.maxHistory ?? 100,
    };
    this.watchers.set(id, state);

    let buffer = '';

    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        this.matchLine(id, line, streamName);
      }
    };

    stream.on('data', onData);
    stream.on('end', () => {
      // Process remaining buffer
      if (buffer) this.matchLine(id, buffer, streamName);
      this.watchers.delete(id);
      this.emit('watcher:end', id);
    });

    return id;
  }

  /**
   * Watch both stdout and stderr of a ChildProcess.
   */
  watchProcess(
    proc: { stdout?: NodeJS.ReadableStream | null; stderr?: NodeJS.ReadableStream | null },
    options: WatchOptions,
  ): string[] {
    const ids: string[] = [];
    if (proc.stdout) ids.push(this.watch(proc.stdout, options, 'stdout'));
    if (proc.stderr) ids.push(this.watch(proc.stderr, options, 'stderr'));
    return ids;
  }

  /** Stop a specific watcher */
  unwatch(id: string): void {
    this.watchers.delete(id);
  }

  /** Get match history for a watcher */
  getHistory(id: string): WatchMatch[] {
    return this.watchers.get(id)?.history ?? [];
  }

  /** Add a pattern to an existing watcher */
  addPattern(id: string, pattern: WatchPattern): void {
    const state = this.watchers.get(id);
    if (state) state.patterns.push(pattern);
  }

  /** Remove a pattern by label from a watcher */
  removePattern(id: string, label: string): void {
    const state = this.watchers.get(id);
    if (state) {
      state.patterns = state.patterns.filter(p => p.label !== label);
    }
  }

  private matchLine(watcherId: string, line: string, stream: 'stdout' | 'stderr'): void {
    const state = this.watchers.get(watcherId);
    if (!state) return;

    const toRemove: number[] = [];

    for (let i = 0; i < state.patterns.length; i++) {
      const pattern = state.patterns[i];
      const m = line.match(pattern.regex);
      if (m) {
        const match: WatchMatch = {
          label: pattern.label,
          line,
          groups: m.slice(1),
          timestamp: Date.now(),
          stream,
        };

        state.history.push(match);
        if (state.history.length > state.maxHistory) {
          state.history.shift();
        }

        state.onMatch(match);
        this.emit('match', match);

        if (pattern.once) {
          toRemove.push(i);
        }
      }
    }

    // Remove once-patterns in reverse order
    for (let i = toRemove.length - 1; i >= 0; i--) {
      state.patterns.splice(toRemove[i], 1);
    }
  }
}
