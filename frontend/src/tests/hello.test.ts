import { describe, it, expect } from 'vitest';

describe('Hello World', () => {
  it('should return hello world', () => {
    const hello = () => 'Hello World';
    expect(hello()).toBe('Hello World');
  });
});