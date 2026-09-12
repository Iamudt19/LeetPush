export interface LanguageMeta {
  name: string;        // Canonical display name: "Java", "Python3", "C++"
  extension: string;   // Extension including dot: ".java", ".py"
  defaultFilename: string; // "Solution.java", "solution.py"
  monacoLanguage: string;
}

const LANGUAGE_MAP: Record<string, LanguageMeta> = {
  // Python
  python: { name: 'Python', extension: '.py', defaultFilename: 'solution.py', monacoLanguage: 'python' },
  python3: { name: 'Python3', extension: '.py', defaultFilename: 'solution.py', monacoLanguage: 'python' },
  py: { name: 'Python3', extension: '.py', defaultFilename: 'solution.py', monacoLanguage: 'python' },

  // C++
  cpp: { name: 'C++', extension: '.cpp', defaultFilename: 'solution.cpp', monacoLanguage: 'cpp' },
  'c++': { name: 'C++', extension: '.cpp', defaultFilename: 'solution.cpp', monacoLanguage: 'cpp' },

  // Java
  java: { name: 'Java', extension: '.java', defaultFilename: 'Solution.java', monacoLanguage: 'java' },

  // C
  c: { name: 'C', extension: '.c', defaultFilename: 'solution.c', monacoLanguage: 'c' },

  // C#
  csharp: { name: 'C#', extension: '.cs', defaultFilename: 'Solution.cs', monacoLanguage: 'csharp' },
  'c#': { name: 'C#', extension: '.cs', defaultFilename: 'Solution.cs', monacoLanguage: 'csharp' },
  cs: { name: 'C#', extension: '.cs', defaultFilename: 'Solution.cs', monacoLanguage: 'csharp' },

  // JavaScript
  javascript: { name: 'JavaScript', extension: '.js', defaultFilename: 'solution.js', monacoLanguage: 'javascript' },
  js: { name: 'JavaScript', extension: '.js', defaultFilename: 'solution.js', monacoLanguage: 'javascript' },

  // TypeScript
  typescript: { name: 'TypeScript', extension: '.ts', defaultFilename: 'solution.ts', monacoLanguage: 'typescript' },
  ts: { name: 'TypeScript', extension: '.ts', defaultFilename: 'solution.ts', monacoLanguage: 'typescript' },

  // PHP
  php: { name: 'PHP', extension: '.php', defaultFilename: 'solution.php', monacoLanguage: 'php' },

  // Swift
  swift: { name: 'Swift', extension: '.swift', defaultFilename: 'solution.swift', monacoLanguage: 'swift' },

  // Kotlin
  kotlin: { name: 'Kotlin', extension: '.kt', defaultFilename: 'solution.kt', monacoLanguage: 'kotlin' },
  kt: { name: 'Kotlin', extension: '.kt', defaultFilename: 'solution.kt', monacoLanguage: 'kotlin' },

  // Dart
  dart: { name: 'Dart', extension: '.dart', defaultFilename: 'solution.dart', monacoLanguage: 'dart' },

  // Go
  golang: { name: 'Go', extension: '.go', defaultFilename: 'solution.go', monacoLanguage: 'go' },
  go: { name: 'Go', extension: '.go', defaultFilename: 'solution.go', monacoLanguage: 'go' },

  // Ruby
  ruby: { name: 'Ruby', extension: '.rb', defaultFilename: 'solution.rb', monacoLanguage: 'ruby' },
  rb: { name: 'Ruby', extension: '.rb', defaultFilename: 'solution.rb', monacoLanguage: 'ruby' },

  // Scala
  scala: { name: 'Scala', extension: '.scala', defaultFilename: 'solution.scala', monacoLanguage: 'scala' },

  // Rust
  rust: { name: 'Rust', extension: '.rs', defaultFilename: 'solution.rs', monacoLanguage: 'rust' },
  rs: { name: 'Rust', extension: '.rs', defaultFilename: 'solution.rs', monacoLanguage: 'rust' },

  // Racket
  racket: { name: 'Racket', extension: '.rkt', defaultFilename: 'solution.rkt', monacoLanguage: 'racket' },
  rkt: { name: 'Racket', extension: '.rkt', defaultFilename: 'solution.rkt', monacoLanguage: 'racket' },

  // Erlang
  erlang: { name: 'Erlang', extension: '.erl', defaultFilename: 'solution.erl', monacoLanguage: 'erlang' },
  erl: { name: 'Erlang', extension: '.erl', defaultFilename: 'solution.erl', monacoLanguage: 'erlang' },

  // Elixir
  elixir: { name: 'Elixir', extension: '.ex', defaultFilename: 'solution.ex', monacoLanguage: 'elixir' },
  ex: { name: 'Elixir', extension: '.ex', defaultFilename: 'solution.ex', monacoLanguage: 'elixir' },
};

/**
 * Normalize a language string (e.g. 'python3', 'Python', 'C++', 'golang') into LanguageMeta.
 */
export function getLanguageMeta(rawLang: string): LanguageMeta {
  if (!rawLang) {
    return { name: 'Text', extension: '.txt', defaultFilename: 'solution.txt', monacoLanguage: 'plaintext' };
  }
  const clean = rawLang.trim().toLowerCase();
  const meta = LANGUAGE_MAP[clean];
  if (meta) return meta;

  // Fallback: sanitized name with default extension
  const safeName = rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
  return {
    name: safeName,
    extension: `.${clean}`,
    defaultFilename: `solution.${clean}`,
    monacoLanguage: clean,
  };
}

/**
 * Returns the standard filename for a given language.
 */
export function getSolutionFilename(rawLang: string): string {
  return getLanguageMeta(rawLang).defaultFilename;
}
