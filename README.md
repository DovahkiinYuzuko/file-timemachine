# ファイルタイムマシン / File Time Machine

<p align="center">
  <img src="app-icon.png" alt="File Time Machine Icon" width="128" height="128" />
</p>

<p align="center">
  <strong>ファイルの過去・現在を自由に行き来できるタイムマシン / A Visual Git GUI for Everyone</strong>
</p>

<p align="center">
  <a href="#日本語">日本語</a> | <a href="#english">English</a>
</p>

---

## 日本語

### 💡 開発者の想い
**「Git」という素晴らしい魔法を、すべてのPCユーザーの手に。**

「さっき保存した内容、やっぱり昨日の時点に戻したいな…」  
「あのファイルのどこを書き換えたか、一目で確認できたらいいのに…」  

ファイルを扱うすべての人にとって、こうした「過去に戻りたい」「変更点を知りたい」という願いは日常茶飯事です。エンジニアの世界には、それを完璧に叶えてくれる「Git（ギット）」という世界最高峰のシステムがあります。

しかし、Gitは黒い画面で難しい呪文（コマンド）を打ち込む必要があり、専門知識のない一般のユーザー（非エンジニア）にとっては非常に敷居が高いものでした。「こんなに便利な魔法があるのに、一部のエンジニアだけで独占されているのはもったいない！」

そんな想いから生まれたのが、この**「ファイルタイムマシン」**です。難しい専門用語やコマンドを覚える必要は一切ありません。誰でも直感的に、まるでタイムマシンを操作するように、安全で強力なファイル管理の恩恵を受けられるように設計しました。

---

### 🛠️ 実は裏で動いていること（Gitの紹介）
このアプリは魔法のように見えますが、実は裏で世界中のプロ開発者が愛用する**「Git」**を動かしています。

あなたがアプリのボタンを「ポチッ」と押すたびに、アプリがあなたの代わりに裏で「ファイルを保存する」「過去の記録を掘り起こす」といった難しいコマンドをGitに指示しています。
複雑で壊れやすいGitコマンドの操作をすべてアプリが肩代わりしてくれるため、あなたは難しいことを一切気にせず、安全にファイルのタイムトラベルを楽しむことができます。

---

### ✨ このアプリで出来ること
難しい言葉は一切なし！このアプリを使えば、以下のことがすべて簡単に行えます。

* **履歴のタイムライン表示（グラフ可視化）**
  - ファイルの変更履歴が、一本の美しい路線図（グラフ）のように視覚的に表示されます。いつ、どんな変更が行われたかが一目でわかります。
* **過去との違いをチェック（ファイル比較）**
  - 過去の時点のファイルと現在のファイルで「どこが新しく追加され、どこが削除されたか」を色分けして並べて表示します。
* **ワンクリックでタイムトラベル（過去バージョンの復元）**
  - 「あの時の状態に戻したい！」と思ったら、履歴からその時点を選んで復元ボタンを押すだけ。一瞬で過去のファイルがよみがえります。
* **安全第一のセキュリティ対策（裏で危険をブロック）**
  - 不正なファイル操作や、システムを壊すような危険なコマンドが実行されないよう、アプリの裏側で強力な安全検証（セキュリティブロック）を常に行っています。
* **世界中で使える16言語対応**
  - 日本語や英語をはじめ、世界中の16の言語に対応しており、お好みの言語で操作できます。

---

### 📦 インストール方法（一般ユーザー向け）

このアプリは、Windows、Mac、Linuxのどれでも動作します！

1. **ダウンロード**
   - このページの右側にある **Releases** （または最新リリース）から、お使いのパソコンに合ったインストーラーをダウンロードします。
     - **Windowsをお使いの方**: `.msi` または `.exe` ファイルをダウンロードします。
     - **Macをお使いの方**: `.dmg` ファイルをダウンロードします。
2. **インストール**
   - ダウンロードしたファイルをダブルクリックして、画面の指示に従ってインストールするだけで準備完了です！

---

### 🚀 基本的な使い方（3つのステップ）

1. **フォルダを選択する**
   - アプリを起動し、過去を記録・管理したいファイルが入っているフォルダを選択します。
2. **履歴を見る**
   - 変更が行われると、自動的に美しいタイムラインが作られていきます。過去の時点をクリックすると、その時のファイルの様子や変更点を確認できます。
3. **過去に戻す**
   - 戻したい履歴を選択して「復元」ボタンを押すだけで、ファイルがその瞬間の状態に戻ります！

---

### 💻 開発者向け情報 (For Developers)

開発者として本プロジェクトをビルド・カスタマイズしたい方向けの情報です。

#### 技術スタック
- **デスクトップフレームワーク**: Tauri v2
- **フロントエンド**: React (TypeScript), Vite
- **バックエンド / コマンド制御**: Rust
- **ローカライズ**: i18next (16言語対応)

#### セットアップとビルド手順
1. リポジトリをクローンします。
2. `app-file-timemachine` ディレクトリに移動し、依存関係をインストールします。
   ```bash
   cd app-file-timemachine
   npm install
   ```
3. 開発用サーバーを起動してアプリを実行します。
   ```bash
   npm run tauri dev
   ```
4. リリース用パッケージ（インストーラー）をビルドします。
   ```bash
   npm run tauri build
   ```

---

## English

### 💡 Developer's Vision
**Bringing the Magic of "Git" to Every PC User.**

"I wish I could revert the changes I made to this file yesterday..."  
"If only I could see at a glance what exactly was changed in this document..."  

For anyone who works with files, the desire to "go back in time" or "compare differences" is a daily occurrence. In the engineering world, there is a legendary system called "Git" that fulfills these wishes flawlessly.

However, Git has traditionally required typing cryptic commands into a black terminal screen, making it incredibly intimidating for general users without a programming background. We thought, "It's a shame that such a powerful magic is locked away for only engineers to use!"

That's why we created **"File Time Machine"**. You don't need to know any technical jargon or command-line wizardry. It is designed so that anyone can intuitively enjoy the security and power of file version control—just like operating a real time machine.

---

### 🛠️ What's Happening Under the Hood (Introduction to Git)
While this app might feel like magic, it is actually powered by **Git**, the industry-standard version control system trusted by professional developers worldwide.

Every time you click a button in the app, it acts as your translator, converting your clicks into complex Git commands behind the scenes. Because the app handles all the fragile and complicated command-line operations for you, you can safely travel through your file history without a single worry.

---

### ✨ Features
We kept the jargon out! Here is what you can easily do with this app:

* **Visual History Timeline (Graph Visualization)**
  - Your file changes are mapped onto a beautiful, train-route-style timeline. You can see when and what was changed at a single glance.
* **Compare Differences Side-by-Side (Diff Viewer)**
  - Compare the past version with the current one. The app highlights newly added parts and deleted parts in distinct colors, side-by-side.
* **One-Click Time Travel (Version Restoring)**
  - "I want to go back to this exact moment!" Just select that point in history and click the restore button. Your files are instantly brought back to life as they were.
* **Safety First (In-App Security Verification)**
  - To prevent system errors or malicious executions, the app constantly runs robust security checks in the background, keeping your files and system completely safe.
* **16-Language Localization Support**
  - Fully translated into 16 languages, allowing you to use the app comfortably in your preferred language.

---

### 📦 How to Install (For General Users)

This app runs smoothly on Windows, macOS, and Linux!

1. **Download**
   - Go to the **Releases** section on the right side of this page and download the package for your OS:
     - **Windows**: Download the `.msi` or `.exe` installer.
     - **macOS**: Download the `.dmg` installer.
2. **Install**
   - Double-click the downloaded file and follow the on-screen instructions to get started!

---

### 🚀 Basic Usage (3 Simple Steps)

1. **Choose a Folder**
   - Open the app and select the folder containing the files you want to manage.
2. **Explore History**
   - As you change files, a beautiful timeline is built automatically. Click on any past point to view the file states and review what changed.
3. **Revert in One Click**
   - Select the desired historical state and click the "Restore" button to instantly revert your files!

---

### 💻 For Developers

Information for developers who wish to build or customize the project.

#### Tech Stack
- **Desktop Framework**: Tauri v2
- **Frontend**: React (TypeScript), Vite
- **Backend / Core Control**: Rust
- **Localization**: i18next (16-language support)

#### Setup and Build Instructions
1. Clone the repository.
2. Navigate to the `app-file-timemachine` folder and install dependencies:
   ```bash
   cd app-file-timemachine
   npm install
   ```
3. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```
4. Build the release installers:
   ```bash
   npm run tauri build
   ```
