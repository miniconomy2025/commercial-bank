import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Integration', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });
});