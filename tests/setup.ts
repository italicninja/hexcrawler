import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend vitest's expect with jest-dom matchers (toBeInTheDocument, etc.)
expect.extend(matchers);

// Cleanup the DOM after each test to prevent state leaking between tests
afterEach(() => {
  cleanup();
});
