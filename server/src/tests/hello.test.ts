describe('Hello World', () => {
  test('should return hello world', () => {
    const hello = () => 'Hello World';
    expect(hello()).toBe('Hello World');
  });
});