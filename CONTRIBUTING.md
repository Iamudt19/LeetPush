# Contributing to LeetPush

Thank you for taking the time to contribute to **LeetPush**! 🎉

---

## 🛠️ Local Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/leetpush.git
   cd leetpush
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start Watch Mode (Development)**:
   ```bash
   npm run dev
   ```
   This rebuilds `dist/` automatically on every save.

4. **Load into Chrome**:
   - Open `chrome://extensions/`
   - Turn on **Developer mode** (top-right toggle)
   - Click **Load unpacked**
   - Select the `dist/` folder in the project root.

---

## 🧪 Testing & Linting

Before opening a pull request, ensure all tests pass and type checks complete without errors:

```bash
# Run TypeScript type check
npm run lint

# Run Vitest unit tests
npm test

# Build and package distributable ZIP
npm run package
```

---

## 💡 Guidelines

- Keep code clean, type-safe, and self-documented.
- Avoid external npm dependencies in runtime extension code unless necessary (keep output bundle tiny).
- Never log user secrets or Personal Access Tokens (`ghp_`). Use `logger.ts` which redacts tokens automatically.
- Open an issue before submitting large architectural changes.

Thank you for building for the LeetCode community! ⚡
