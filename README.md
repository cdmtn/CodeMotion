<div align="center">
    <img width="100%" height="100%" alt="github-codemotion-prev-rc" src="https://github.com/user-attachments/assets/eb11896a-4bdd-4f72-9181-e7d3e839b839" />
</div>
<h1 align="center">CodeMotion IDE<br>
(Early-Development Alpha)</h1>

<p align="center">CodeMotion is a web-focused, advanced 
open-source code editor (IDE) 
with native tools for web developers</p>

<div align="center">
    <a href="https://codemotion.yurba.one">Website</a>
    ⋅
    <a href="https://codemotion.yurba.one/docs">Documentation</a>
    ⋅
    <a href="https://codemotion.yurba.one/discord">CodeMotion Discord</a>
    ⋅
    <a href="https://codemotion.yurba.one/slim">Slim Language</a>
    ⋅
    <a href="https://codemotion.yurba.one/telegram">Telegram</a>
</div>

> [!IMPORTANT]
> If you download a pre-compiled build (exe), Windows may flag it as a keylogger, and VirusTotal may flag it for random viruses—and that’s NORMAL; I honestly don’t know why this happens. The project is in alpha development. If you don’t trust the build, you can compile the project [yourself](https://github.com/cdmtn-dev/codemotion-ide/wiki/%5BFOR-BEGINNERS%5D-How-do-I-build-an-app%3F)

> [!IMPORTANT]
> **macOS: "CodeMotion is damaged and can't be opened"** — this is NOT corruption. The build isn't signed with a paid Apple Developer certificate, so macOS Gatekeeper quarantines it. To fix, drag the app to `/Applications`, then run this once in Terminal:
>
> ```bash
> xattr -cr /Applications/CodeMotion.app
> ```
>
> The app will open normally afterwards.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

## ✨ Features

- **Work as a team**: Built-in tools for collaboration
- **Intuitive UI**: Clean, distraction-free coding environment
- **Developer-Friendly**: Built by developers, for developers
- **Lightweight**: About 2.5 times lighter than VSCode
- **Built-in analysis**: Run Python applications and analyze JavaScript and TypeScript directly within them
- **Smart Editing**: Advanced syntax highlighting and code completion
- **Extensible**: Easily customize and extend with own easy plugins engine

## 🎯 Quick Start

[If you're new here, check out our beginner's guide](https://codemotion.yurba.one/docs#for-beginners/FOR_BEGINNERS_BUILD_APP)

Prerequisites:

- Node.js (v20 or higher)
- npm

```
# Clone the repository
git clone https://github.com/cdmtn/CodeMotion.git

# Navigate to the project
cd CodeMotion

# Install dependencies
npm install

# Start the development server
npm start

# Or with dev mode
npm start -- --d
```

## 🏗️ Project Structure

```
codemotion-ide/
├── app/                 # App functions
├── assets/              # App assets
├── codemirror/          # Editor core
├── helpers/             # Different helpers
├── html/                # HTML Templates
└── languages/           # App languages in JSON
```

## 🛠️ Stack

- **Backend**: TypeScript
- **Frontend**: Pure JavaScript
- **Styling**: Pure CSS
- **Markup**: HTML
- **Architecture**: Modular & Component-based

## 🤝 Contributing

We love contributions! Whether it's bug reports, feature requests, or pull requests, we welcome your involvement.

#### Contributing Guidelines

- Fork the repository
- Create your feature branch ```git checkout -b feature/AmazingFeature```
- Ensure code quality and formatting:
  ```bash
  npm run lint       # Run linter checks
  npm run format     # Format code with Biome
  npm test           # Run tests
  ```
- Commit your changes ```git commit -m 'Add some AmazingFeature'```
- Push to the branch ```git push origin feature/AmazingFeature```
- Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## Authors

- [@cdmtn-dev](https://github.com/cdmtn-dev)

## Special thanks

- [@noxy](https://github.com/noxygalaxy) (Super contributor)
- [@NotKiwy](https://github.com/NotKiwy) (Triage)
