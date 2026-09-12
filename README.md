# ⚡ LeetPush — LeetCode to GitHub, Automatically

> Solve a problem on LeetCode. Get an "Accepted" verdict. **LeetPush** automatically pushes your exact code, stats, and approach notes to your GitHub repository. Zero extra clicks required.

---

## 📥 Quick Start & Installation

Getting started takes less than 2 minutes. No coding or build tools required!

### Step 1 — Download the Zip File
👉 **[Click Here to Download `leetpush.zip`](https://github.com/Iamudt19/LeetPush/raw/main/leetpush.zip)**

*(Or download `leetpush.zip` directly from the repository files list above)*

### Step 2 — Extract the Zip
Unpack/extract `leetpush.zip` into a folder on your computer.

### Step 3 — Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Turn on **Developer mode** (toggle switch in the top-right corner)
3. Click **Load unpacked** (top-left button)
4. Select the extracted `leetpush` folder

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
│   │   └── README.md          <-- Problem description, complexity & notes
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

**Q: Where can I download the extension zip?**
> Download directly using **[this link](https://github.com/Iamudt19/LeetPush/raw/main/leetpush.zip)**.

---

## 📄 License

[MIT License](LICENSE) — Feel free to use, modify, and distribute!