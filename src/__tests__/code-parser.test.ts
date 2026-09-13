import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCodeFromMonacoDom, resolveSubmittedCode } from '../leetcode/code-parser';

describe('code-parser full code extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).monaco;
  });

  it('extracts full code from hidden #leetpush-submitted-code element', async () => {
    const textarea = document.createElement('textarea');
    textarea.id = 'leetpush-submitted-code';
    textarea.value = 'class Solution {\n    public int[] twoSum() {\n        return new int[]{0, 1};\n    }\n}';
    document.body.appendChild(textarea);

    const code = await extractCodeFromMonacoDom();
    expect(code).toBe(textarea.value);
  });

  it('extracts full code from window.monaco model when available', async () => {
    (window as any).monaco = {
      editor: {
        getModels: () => [
          {
            getValue: () => 'def two_sum(nums, target):\n    # Full untruncated code\n    return [0, 1]',
          },
        ],
      },
    };

    const code = await extractCodeFromMonacoDom();
    expect(code).toContain('# Full untruncated code');
  });

  it('extracts full code via Main World custom event bridge', async () => {
    // Listen for custom event and reply
    const listener = () => {
      const textarea = document.createElement('textarea');
      textarea.id = 'leetpush-monaco-code';
      textarea.value = '// Main world code response\nfunction solution() {\n  return 42;\n}';
      document.body.appendChild(textarea);

      window.dispatchEvent(
        new CustomEvent('LEETPUSH_RESPONSE_MONACO_CODE', {
          detail: { code: textarea.value },
        })
      );
    };

    window.addEventListener('LEETPUSH_REQUEST_MONACO_CODE', listener);

    const code = await extractCodeFromMonacoDom();
    expect(code).toBe('// Main world code response\nfunction solution() {\n  return 42;\n}');

    window.removeEventListener('LEETPUSH_REQUEST_MONACO_CODE', listener);
  });

  it('resolves code using initialCode when available', async () => {
    const result = await resolveSubmittedCode('12345', 'console.log("hello world");');
    expect(result?.code).toBe('console.log("hello world");');
  });
});
