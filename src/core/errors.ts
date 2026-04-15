/**
 * OPC Agent Error Hierarchy - v1.0.0
 * Custom error classes with user-friendly messages and recovery hints.
 */

export class OPCError extends Error {
  public readonly code: string;
  public readonly hint?: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp = Date.now();

  constructor(message: string, opts?: { code?: string; hint?: string; context?: Record<string, unknown>; cause?: Error }) {
    super(message);
    this.name = 'OPCError';
    this.code = opts?.code ?? 'OPC_UNKNOWN';
    this.hint = opts?.hint;
    this.context = opts?.context;
    if (opts?.cause) this.cause = opts.cause;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, hint: this.hint, context: this.context, timestamp: this.timestamp };
  }

  toUserMessage(): string {
    return this.hint ? `${this.message}\n💡 ${this.hint}` : this.message;
  }
}

export class ProviderError extends OPCError {
  public readonly provider: string;
  public readonly statusCode?: number;

  constructor(provider: string, message: string, opts?: { statusCode?: number; hint?: string; cause?: Error }) {
    super(message, {
      code: 'OPC_PROVIDER_ERROR',
      hint: opts?.hint ?? `Check your API key and network connection for ${provider}.`,
      context: { provider, statusCode: opts?.statusCode },
      cause: opts?.cause,
    });
    this.name = 'ProviderError';
    this.provider = provider;
    this.statusCode = opts?.statusCode;
  }
}

export class ValidationError extends OPCError {
  public readonly field?: string;
  public readonly errors: string[];

  constructor(message: string, errors: string[] = [], field?: string) {
    super(message, {
      code: 'OPC_VALIDATION_ERROR',
      hint: 'Check your OAD configuration file for missing or invalid fields.',
      context: { field, errors },
    });
    this.name = 'ValidationError';
    this.field = field;
    this.errors = errors;
  }
}

export class ConfigError extends OPCError {
  constructor(message: string, hint?: string) {
    super(message, { code: 'OPC_CONFIG_ERROR', hint: hint ?? 'Check your oad.yaml and .env files.' });
    this.name = 'ConfigError';
  }
}

export class ChannelError extends OPCError {
  public readonly channelType: string;

  constructor(channelType: string, message: string, opts?: { hint?: string; cause?: Error }) {
    super(message, {
      code: 'OPC_CHANNEL_ERROR',
      hint: opts?.hint ?? `Check configuration for the ${channelType} channel.`,
      context: { channelType },
      cause: opts?.cause,
    });
    this.name = 'ChannelError';
    this.channelType = channelType;
  }
}

export class PluginError extends OPCError {
  public readonly pluginName: string;

  constructor(pluginName: string, message: string, opts?: { hint?: string; cause?: Error }) {
    super(message, {
      code: 'OPC_PLUGIN_ERROR',
      hint: opts?.hint ?? `Check plugin "${pluginName}" configuration.`,
      context: { pluginName },
      cause: opts?.cause,
    });
    this.name = 'PluginError';
    this.pluginName = pluginName;
  }
}

export class RateLimitError extends OPCError {
  public readonly retryAfterMs?: number;

  constructor(message?: string, retryAfterMs?: number) {
    super(message ?? 'Rate limit exceeded. Please slow down.', {
      code: 'OPC_RATE_LIMIT',
      hint: retryAfterMs ? `Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` : 'Please wait before sending more messages.',
      context: { retryAfterMs },
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class SecurityError extends OPCError {
  constructor(message: string, hint?: string) {
    super(message, { code: 'OPC_SECURITY_ERROR', hint: hint ?? 'This request was blocked for security reasons.' });
    this.name = 'SecurityError';
  }
}

export class TimeoutError extends OPCError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`, {
      code: 'OPC_TIMEOUT',
      hint: 'The operation took too long. Try again or increase the timeout.',
      context: { operation, timeoutMs },
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap an unknown thrown value into an OPCError.
 */
export function wrapError(err: unknown, fallbackMessage = 'An unexpected error occurred'): OPCError {
  if (err instanceof OPCError) return err;
  if (err instanceof Error) return new OPCError(err.message, { cause: err });
  return new OPCError(typeof err === 'string' ? err : fallbackMessage);
}

/**
 * Format error for user display (no stack traces).
 */
export function formatErrorForUser(err: unknown): string {
  if (err instanceof OPCError) return err.toUserMessage();
  if (err instanceof Error) return err.message;
  return String(err);
}
