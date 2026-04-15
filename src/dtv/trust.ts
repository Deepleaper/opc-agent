import type { TrustLevelType } from '../schema/oad';

/**
 * Trust levels: sandbox → verified → certified → listed
 *
 * - sandbox:   No network, no file system, limited capabilities
 * - verified:  Identity verified, basic capabilities
 * - certified: Passed security audit, full capabilities
 * - listed:    Published in OPC marketplace
 */
export class TrustManager {
  private level: TrustLevelType;

  constructor(level: TrustLevelType = 'sandbox') {
    this.level = level;
  }

  getLevel(): TrustLevelType {
    return this.level;
  }

  canAccessNetwork(): boolean {
    return this.level !== 'sandbox';
  }

  canAccessFileSystem(): boolean {
    return this.level === 'certified' || this.level === 'listed';
  }

  canPublish(): boolean {
    return this.level === 'listed';
  }

  upgrade(to: TrustLevelType): void {
    const order: TrustLevelType[] = ['sandbox', 'verified', 'certified', 'listed'];
    const currentIdx = order.indexOf(this.level);
    const targetIdx = order.indexOf(to);
    if (targetIdx <= currentIdx) {
      throw new Error(`Cannot downgrade trust from ${this.level} to ${to}`);
    }
    this.level = to;
  }
}
