import { describe, it, expect } from 'vitest';

describe('submission detection filtering', () => {
  function shouldSynchronize(statusMsg: string, statusCode?: number): boolean {
    // Exact status condition required by extension architecture
    if (statusMsg === 'Accepted') return true;
    if (statusCode === 10) return true;
    return false;
  }

  it('identifies Accepted submissions for synchronization', () => {
    expect(shouldSynchronize('Accepted')).toBe(true);
    expect(shouldSynchronize('SUCCESS', 10)).toBe(true);
  });

  it('strictly rejects non-accepted submissions', () => {
    expect(shouldSynchronize('Wrong Answer')).toBe(false);
    expect(shouldSynchronize('Runtime Error')).toBe(false);
    expect(shouldSynchronize('Time Limit Exceeded')).toBe(false);
    expect(shouldSynchronize('Memory Limit Exceeded')).toBe(false);
    expect(shouldSynchronize('Compile Error')).toBe(false);
    expect(shouldSynchronize('Output Limit Exceeded')).toBe(false);
    expect(shouldSynchronize('Pending')).toBe(false);
  });
});
