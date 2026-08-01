import { describe, it, expect, beforeEach } from 'vitest';
import { getBoardToken, setBoardToken } from './api';

describe('api token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no tokens are stored', () => {
    expect(getBoardToken(1)).toBeNull();
  });

  it('saves and retrieves token per board', () => {
    setBoardToken(1, 'token-board-1');
    setBoardToken(2, 'token-board-2');

    expect(getBoardToken(1)).toBe('token-board-1');
    expect(getBoardToken(2)).toBe('token-board-2');
    expect(getBoardToken(3)).toBeNull();
  });
});
