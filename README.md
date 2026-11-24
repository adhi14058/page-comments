<p align="center">
  <img src="docs/images/banner.svg" width="100%" alt="Page Comments: point at anything on a web page, say what should change, hand it on">
</p>

<p align="center">
  <a href="https://page-comments.share.heyadhi.com/"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fadhi14058%2Fpage-comments%2Fmain%2Frelease.json&query=%24.version&label=version&color=ea580c&style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/account-none%20needed-16a34a?style=flat-square" alt="No account needed">
</p>

<p align="center">
  <a href="#-three-ways-to-use-it"><b>Get it</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="docs/GUIDE.md"><b>Guide</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="docs/DEVELOPING.md"><b>Developing</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="CHANGELOG.md"><b>Changes</b></a>
</p>

<br>

<p align="center">
  <img src="docs/images/demo.gif" width="760" alt="Hover an element, click it, type a comment, press Enter: a numbered pin appears">
</p>

## ✨ How it works

<table>
  <tr>
    <td width="33%" align="center"><img src="docs/images/step-point.webp" alt="Hovering a button shows its tag, size and colour"></td>
    <td width="33%" align="center"><img src="docs/images/step-comment.webp" alt="The comment box open on the price"></td>
    <td width="33%" align="center"><img src="docs/images/step-share.webp" alt="The comments list with three numbered comments"></td>
  </tr>
  <tr>
    <td align="center"><b>1 · Point</b><br><sub>Hover anything to see its tag, size and colour.</sub></td>
    <td align="center"><b>2 · Comment</b><br><sub>Click it, type, press <kbd>Enter</kbd>. A numbered pin stays.</sub></td>
    <td align="center"><b>3 · Hand it on</b><br><sub>Copy, share a link, or send it to Claude Code.</sub></td>
  </tr>
</table>

## 🚀 Three ways to use it

| | <img src="docs/images/way-bookmark.svg" width="40" alt=""><br>**The bookmark** | <img src="docs/images/way-github.svg" width="40" alt=""><br>**Copy it from GitHub** | <img src="docs/images/way-extension.svg" width="40" alt=""><br>**The extension** |
|---|:---:|:---:|:---:|
| **For** | Most people | Networks that reach only github.com | The sharpest pictures |
| **Updates** | By itself | A dot tells you | Through the store |
| **Get it** | **[Install page →](https://page-comments.share.heyadhi.com/)** | **[bookmarklet.txt →](bookmarklet.txt)** | Coming soon |

All three run the same tool and share comments and share links.

<details>
<summary><b>Add the GitHub copy as a bookmark</b></summary>
<br>

1. Open [`bookmarklet.txt`](bookmarklet.txt) and click **Copy raw file**.
2. Right-click the bookmarks bar → **Add page…** (Firefox: **Add Bookmark…**).
3. Name it *Page comments* and paste into **URL**.

</details>

<details>
<summary><b>Try the extension before it is in the stores</b></summary>
<br>

Load it unpacked: see [Developing → The extension](docs/DEVELOPING.md#the-extension).

</details>

## 📮 Where your comments go

<p align="center">
  <img src="docs/images/handover.svg" width="100%" alt="Your comments go to Slack, Jira, Google Docs or email by Copy; to a teammate by Share link; to Claude Code by Send">
</p>

## 🧰 What it can do

<p align="center">
  <img src="docs/images/toolbar.png" width="470" alt="Hover the round button and it grows into a bar of actions">
</p>

<table>
  <tr>
    <td width="50%" valign="top"><b>📌 Pins that stay</b><br><sub>Saved per page, back whenever you open the tool again.</sub></td>
    <td width="50%" valign="top"><b>📸 Pictures</b><br><sub>Each comment can carry a numbered picture of what it points at.</sub></td>
  </tr>
  <tr>
    <td valign="top"><b>🔲 More ways to point</b><br><sub>Select text, drag an area, or pick several things at once.</sub></td>
    <td valign="top"><b>🧊 Freeze</b><br><sub>Keep a hover menu or tooltip still while you comment on it.</sub></td>
  </tr>
  <tr>
    <td valign="top"><b>🔗 Share link</b><br><sub>Comments and small pictures travel inside the link itself.</sub></td>
    <td valign="top"><b>🤖 Send to Claude Code</b><br><sub>On your own dev app, Claude edits the source. <a href="docs/GUIDE.md#send-to-claude">How</a></sub></td>
  </tr>
</table>

<details>
<summary><b>⌨️ Keyboard shortcuts</b></summary>
<br>

| Key | Does |
|---|---|
| <kbd>Enter</kbd> | Comment on the outlined element |
| <kbd>↑</kbd> <kbd>↓</kbd> | Outline the parent or the inner element |
| <kbd>A</kbd> | Select an area |
| <kbd>B</kbd> | Select several |
| <kbd>F</kbd> | Freeze the page |
| <kbd>L</kbd> | Comments list |
| <kbd>C</kbd> | Copy |
| <kbd>S</kbd> | Share link |
| <kbd>D</kbd> | Details on or off |
| <kbd>?</kbd> | All shortcuts |
| <kbd>Esc</kbd> | Back out one step |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Switch between commenting and browsing |

</details>

## 🔒 Privacy

Comments live in the page's own browser storage. Nothing leaves your browser unless you copy, share or send it. No account needed.

## 📚 More

- **[Guide](docs/GUIDE.md)**: every action, key and limit.
- **[Developing](docs/DEVELOPING.md)**: folders, build, release, tests.
- **[Changes](CHANGELOG.md)**: what each version brought.

<sub>MIT licensed. See <a href="LICENSE">LICENSE</a>.</sub>
