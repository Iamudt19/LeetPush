import { describe, it, expect } from 'vitest';
import { getLanguageMeta, getSolutionFilename } from '../utils/language';

describe('language utility', () => {
  it('maps standard languages to correct file extensions and filenames', () => {
    // Java
    expect(getLanguageMeta('java').extension).toBe('.java');
    expect(getSolutionFilename('java')).toBe('Solution.java');

    // Python
    expect(getLanguageMeta('python').extension).toBe('.py');
    expect(getLanguageMeta('python3').extension).toBe('.py');
    expect(getSolutionFilename('python3')).toBe('solution.py');

    // C++
    expect(getLanguageMeta('cpp').extension).toBe('.cpp');
    expect(getLanguageMeta('c++').extension).toBe('.cpp');
    expect(getSolutionFilename('cpp')).toBe('solution.cpp');

    // JavaScript & TypeScript
    expect(getLanguageMeta('javascript').extension).toBe('.js');
    expect(getLanguageMeta('js').extension).toBe('.js');
    expect(getLanguageMeta('typescript').extension).toBe('.ts');
    expect(getLanguageMeta('ts').extension).toBe('.ts');

    // Go & Rust
    expect(getLanguageMeta('golang').extension).toBe('.go');
    expect(getLanguageMeta('go').extension).toBe('.go');
    expect(getLanguageMeta('rust').extension).toBe('.rs');

    // C#
    expect(getLanguageMeta('csharp').extension).toBe('.cs');
    expect(getLanguageMeta('c#').extension).toBe('.cs');
    expect(getSolutionFilename('csharp')).toBe('Solution.cs');

    // Kotlin, Swift, Scala, Ruby, PHP
    expect(getLanguageMeta('kotlin').extension).toBe('.kt');
    expect(getLanguageMeta('swift').extension).toBe('.swift');
    expect(getLanguageMeta('scala').extension).toBe('.scala');
    expect(getLanguageMeta('ruby').extension).toBe('.rb');
    expect(getLanguageMeta('php').extension).toBe('.php');
  });

  it('gracefully handles unknown or edge-case languages', () => {
    const meta = getLanguageMeta('brainfuck');
    expect(meta.name).toBe('Brainfuck');
    expect(meta.extension).toBe('.brainfuck');
  });
});
