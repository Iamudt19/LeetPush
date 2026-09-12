# ⚡ LeetPush — LeetCode to GitHub, Automatically

> Solve a problem on LeetCode. Get an "Accepted" verdict. **LeetPush** automatically pushes your exact code, stats, and approach notes to your GitHub repository. Zero extra clicks required.

---

## 🚀 Quick Start (Choose Option A or B)

### Option A — Instant Install (No Coding Required)
*(Best for non-developers or sharing directly with friends)*

1. **Download the Zip**: Download `leetpush.zip` from the [Releases](https://github.com/YOUR_USERNAME/leetpush/releases) page (or grab `leetpush.zip` directly from this repository).
2. **Unpack it**: Extract `leetpush.zip` into a folder on your computer.
3. **Load into Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Turn on **Developer mode** (toggle switch in the top-right corner)
   - Click **Load unpacked** and select your extracted folder
4. **Done!** Click the ⚡ **LeetPush** icon in your Chrome toolbar to connect GitHub.

---

### Option B — Build from Source (For Developers)

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/leetpush.git
cd leetpush

# 2. Install dependencies & build
npm install
npm run build

# 3. Load into Chrome
# Open chrome://extensions/ -> Enable Developer Mode -> Click "Load unpacked" -> Select the `dist` directory
```

---

## 🔑 4-Step GitHub Setup

1. Open Chrome Extension menu → Click **⚡ LeetPush** → Open **⚙️ Settings**.
2. Click **[Create GitHub Token](https://github.com/settings/tokens/new?scopes=repo&description=LeetPush)** (requires `repo` scope).
3. Paste your Personal Access Token (PAT) → Click **Verify & Connect**.
4. Select your target repository from the dropdown → Click **Save All Settings**.

*That's it! Every accepted submission will now sync instantly to GitHub.*

---

## 🗂️ How Your GitHub Repository Will Look

```text
leetcode-solutions/
├── solutions/
│   ├── 0001-two-sum/
│   │   ├── solution.py
│   │   └── README.md          <-- Contains problem description, runtime & notes
│   ├── 0070-climbing-stairs/
│   │   ├── solution.java
│   │   └── README.md
│   └── 0146-lru-cache/
│       ├── solution.cpp
│       └── README.md
└── contests/
    └── weekly-contest-412/
        └── 0001-two-sum/
            └── solution.py
```

- **Zero-padded numbers** (`0001-`, `0002-`) ensure clean numeric sorting on GitHub.
- **Multi-language support**: Solve in Python today and C++ tomorrow — both live side-by-side in the problem directory.

---

## ⭐ Key Features

- **⚡ Instant Sync on Accepted**: Triggers only on confirmed "Accepted" submissions — ignores Wrong Answer (WA) or Time Limit Exceeded (TLE).
- **📝 Post-Solve Note Panel**: Prompt after submission lets you log approach notes & time/space complexity right into problem `README.md`.
- **📊 Interactive Dashboard**: Tracks your solve streak 🔥, daily/weekly metrics, and Easy/Medium/Hard breakdown.
- **🏆 Contest Mode**: Automatically routes contest solutions into a dedicated `contests/` subfolder.
- **🔁 Auto Retry Queue**: Network hiccups or failed pushes are automatically queued and retried.
- **⊘ Skip Problem Feature**: Button lets you blacklist any problem you don't want pushed.
- **👥 Co-Author Support**: Optional pair programming `Co-authored-by:` credit in commit logs.

---

## 🔒 Privacy & Security

- **100% Client-Side**: LeetPush talks directly to GitHub's REST API. No intermediate backend server touches your code or credentials.
- **Token Protection**: Tokens are stored strictly inside Chrome's sandboxed `chrome.storage.local`.
- **Log Masking**: Internal logger automatically censors token strings (`ghp_...`).

---

## ❓ Frequently Asked Questions

**Q: My solution didn't push automatically. What should I check?**
> Open the LeetPush popup and click the **Queue** tab. If there was a network error or expired token, click **↻ Retry** or update your PAT in Settings.

**Q: Does LeetPush copy what is in the code editor or what was actually submitted?**
> LeetPush queries LeetCode's GraphQL API for the exact submission ID code — not just current editor text.

**Q: Can I share this extension with friends in a ZIP file?**
> Yes! Run `npm run package` (or use `leetpush.zip`). Anyone can extract `leetpush.zip` and use **Load unpacked** in Chrome without installing Node.js or running build tools.

---

## 💻 Developer Commands

| Command | Action |
|---|---|
| `npm run dev` | Development watch mode (auto-rebuilds on save) |
| `npm test` | Run unit test suite (Vitest + jsdom) |
| `npm run lint` | Run TypeScript type checks (`tsc --noEmit`) |
| `npm run build` | Compile production bundle into `dist/` |
| `npm run package` | Build & package distributable `leetpush.zip` |

---

## 📄 License

[MIT License](LICENSE) — Feel free to use, modify, and distribute!