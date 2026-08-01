export type Locale = "ja" | "en" | "zh";

export const LOCALE_KEY = "md-resume-locale";

export const messages = {
  ja: {
    documentTitle: "Markdown職務経歴書 PDF変換ツール｜無料・ブラウザで完結",
    description:
      "日本の定番テンプレートでは物足りない人へ。Markdownで書いた職務経歴書を、デザイン性のあるA4レイアウトに整えてPDF保存できます。入力内容はブラウザ内だけで処理します。",
    languageLabel: "表示言語",
    brandTitle: "型にはまらない、あなたの職務経歴書",
    lede: "Markdownで書いて、自分のキャリアを自分で設計する。",
    privacyNote: "データはブラウザ内だけで処理",
    headerDetail: "A4 / Markdown → PDF",
    editorPaneLabel: "原稿エディター",
    autosave: "自動保存",
    editorTitle: "Markdownで内容を整える",
    editorInput: "Markdown入力",
    loadSample: "サンプル",
    loadSampleConfirm: "現在の編集内容は失われます。サンプルを読み込みますか？",
    downloadSample: "サンプルを保存",
    openMd: ".mdを開く",
    saveMd: ".md保存",
    clear: "クリア",
    profilePhoto: "プロフィール写真",
    avatarUnset: "未設定",
    avatarSet: "設定済み",
    avatarPending: "保存待ち",
    avatarUploadFailed: "アップロード失敗",
    uploadImage: "画像をアップロード",
    editPhoto: "編集",
    removePhoto: "取り除く",
    photoKicker: "PROFILE PHOTO",
    editPhotoTitle: "写真を整える",
    close: "閉じる",
    closePhotoEditor: "写真編集を閉じる",
    adjustPhoto: "写真をドラッグして位置を調整。ホイールで拡大縮小",
    photoPreviewAlt: "プロフィール写真の編集プレビュー",
    zoom: "拡大率",
    displayShape: "表示形状",
    square: "方形",
    circle: "円形",
    photoEditorNote:
      "ドラッグで位置調整、スクロールで拡大縮小。変更内容は「保存」でプレビューに反映されます。",
    cancel: "キャンセル",
    save: "保存",
    previewLabel: "プレビュー",
    previewTitle: "職務経歴書の仕上がり",
    resumePreview: "職務経歴書プレビュー",
    theme: "テーマ",
    themeNavy: "クラシック・ネイビー",
    themeGraphite: "ミニマル・グラファイト",
    themeSlate: "スレート・ブルー",
    themeForest: "フォレスト・グリーン",
    themeBurgundy: "ワイン・バーガンディ",
    themeAmber: "ウォーム・アンバー",
    background: "背景",
    backgroundPaper: "ピュア・ホワイト",
    backgroundMist: "クール・ミスト",
    backgroundLinen: "ソフト・リネン",
    savePdf: "PDFとして保存",
    printTipTitle: "PDF保存のコツ",
    printTip:
      "印刷設定で用紙を「A4」、倍率を「既定」、ヘッダーとフッターを「オフ」にすると最もきれいに仕上がります。",
    aboutTitle: "このツールについて",
    aboutText:
      "日本の定番テンプレートでは表現しにくい、自分らしさとキャリアの個性を、Markdownから自分で組み立てられる職務経歴書に。入力した内容はデザイン性のあるA4レイアウトに整形され、サーバーに送信されることなくブラウザ内で処理されます。",
    howToTitle: "使い方",
    howToStep1:
      "「サンプルを読み込む」でMarkdownの書き方を確認するか、お手持ちの.mdファイルを開きます。",
    howToStep2:
      "左側のエディタで内容を編集すると、右側のプレビューにリアルタイムで反映されます。",
    howToStep3:
      "「PDFとして保存」を押すと印刷ダイアログが開きます。出力先を「PDFに保存」にして保存すれば完了です。",
    howToStep4:
      "お手持ちの履歴書をAIに渡し、「このサンプルの見出しと構成に合わせて整理して」と依頼することもできます。個人情報を含む内容を外部AIへ送信する場合は、利用するサービスの設定を確認してください。",
    contactTitle: "連絡先の書き方",
    contactHelp:
      "名前の直後に1行で記述すると、タイトル下に表示されます。<strong>PhoneとEmail</strong>はテキスト、<strong>LinkedIn・GitHub・Portfolio・個人サイト・SNS</strong>などはMarkdownリンクにします。",
    syntaxTitle: "対応記法",
    syntaxText:
      "見出し（# ## ###）、箇条書き、表、太字などの標準的なMarkdown記法に対応しています。",
    clearConfirm: "編集内容をすべて消去しますか？",
    pageAriaLabel: "職務経歴書 {count}ページ目",
    pageCount: "A4 / {count}ページ",
    resumePhotoAlt: "プロフィール写真",
  },
  en: {
    documentTitle: "Markdown Resume Studio | Create a polished PDF resume",
    description:
      "Write your resume in Markdown, format it as a polished A4 document, and save it as a PDF. Everything is processed locally in your browser.",
    languageLabel: "Language",
    brandTitle: "Your resume, your way.",
    lede: "Write in Markdown. Shape your career story your way.",
    privacyNote: "Processed entirely in your browser",
    headerDetail: "A4 / Markdown → PDF",
    editorPaneLabel: "Draft editor",
    autosave: "Autosave",
    editorTitle: "Edit your resume in Markdown",
    editorInput: "Markdown input",
    loadSample: "Load sample",
    loadSampleConfirm: "Your current edits will be replaced. Load the sample?",
    downloadSample: "Download sample",
    openMd: "Open .md file",
    saveMd: "Save .md",
    clear: "Clear",
    profilePhoto: "Profile photo",
    avatarUnset: "Not set",
    avatarSet: "Set",
    avatarPending: "Unsaved changes",
    avatarUploadFailed: "Upload failed",
    uploadImage: "Upload image",
    editPhoto: "Edit",
    removePhoto: "Remove",
    photoKicker: "PROFILE PHOTO",
    editPhotoTitle: "Adjust your photo",
    close: "Close",
    closePhotoEditor: "Close photo editor",
    adjustPhoto: "Drag to adjust the position. Scroll to zoom.",
    photoPreviewAlt: "Profile photo editing preview",
    zoom: "Zoom",
    displayShape: "Shape",
    square: "Square",
    circle: "Circle",
    photoEditorNote:
      "Drag to reposition and scroll to zoom. Select Save to apply changes to the preview.",
    cancel: "Cancel",
    save: "Save",
    previewLabel: "Preview",
    previewTitle: "Resume preview",
    resumePreview: "Resume preview",
    theme: "Theme",
    themeNavy: "Classic navy",
    themeGraphite: "Minimal graphite",
    themeSlate: "Slate blue",
    themeForest: "Forest green",
    themeBurgundy: "Deep burgundy",
    themeAmber: "Warm amber",
    background: "Background",
    backgroundPaper: "Pure white",
    backgroundMist: "Cool mist",
    backgroundLinen: "Soft linen",
    savePdf: "Save as PDF",
    printTipTitle: "PDF export tip",
    printTip:
      "For the cleanest result, set the paper size to A4, keep the scale at Default, and turn off headers and footers in the print settings.",
    aboutTitle: "About this tool",
    aboutText:
      "Standard resume templates can make it hard to express your personality and career story. This tool lets you build a distinctive resume from Markdown, format it as a polished A4 document, and process everything locally in your browser without sending your content to a server.",
    howToTitle: "How to use",
    howToStep1:
      "Select Load sample to see how the Markdown is structured, or open your own .md file.",
    howToStep2:
      "Edit your content in the left-hand editor and see the preview update in real time on the right.",
    howToStep3:
      "Select Save as PDF, then choose Save to PDF as the destination in the print dialog.",
    howToStep4:
      "You can also give an AI tool the sample and your existing resume and ask it to reorganize your content to match the sample structure. Check the service's privacy settings before sending personal information to an external AI tool.",
    contactTitle: "Contact information",
    contactHelp:
      "Write one line directly below your name to show it beneath the title. Keep <strong>Phone and Email</strong> as plain text; use Markdown links for <strong>LinkedIn, GitHub, Portfolio, personal websites, social media</strong>, and other profiles.",
    syntaxTitle: "Supported syntax",
    syntaxText:
      "Supports standard Markdown syntax, including headings (# ## ###), lists, tables, and bold text.",
    clearConfirm: "Clear all content in the editor?",
    pageAriaLabel: "Resume page {count}",
    pageCount: "A4 / {count} pages",
    resumePhotoAlt: "Profile photo",
  },
  zh: {
    documentTitle: "Markdown 履历书工具｜免费导出 PDF",
    description:
      "用 Markdown 写履历书，自动排版成简洁、有设计感的 A4 文档，并导出为 PDF。所有内容仅在浏览器中处理。",
    languageLabel: "语言",
    brandTitle: "不被模板束缚的履历书",
    lede: "用 Markdown 写下来，按自己的方式呈现职业经历。",
    privacyNote: "数据仅在浏览器中处理",
    headerDetail: "A4 / Markdown → PDF",
    editorPaneLabel: "原稿编辑器",
    autosave: "自动保存",
    editorTitle: "用 Markdown 整理履历书",
    editorInput: "Markdown 输入",
    loadSample: "加载示例",
    loadSampleConfirm: "当前编辑内容将被替换。确定要加载示例吗？",
    downloadSample: "下载示例",
    openMd: "打开 .md 文件",
    saveMd: "保存 .md",
    clear: "清空",
    profilePhoto: "个人头像",
    avatarUnset: "未设置",
    avatarSet: "已设置",
    avatarPending: "待保存",
    avatarUploadFailed: "上传失败",
    uploadImage: "上传图片",
    editPhoto: "编辑",
    removePhoto: "移除",
    photoKicker: "PROFILE PHOTO",
    editPhotoTitle: "调整照片",
    close: "关闭",
    closePhotoEditor: "关闭照片编辑器",
    adjustPhoto: "拖动照片调整位置，滚动鼠标滚轮进行缩放",
    photoPreviewAlt: "照片编辑预览",
    zoom: "缩放",
    displayShape: "头像形状",
    square: "方形",
    circle: "圆形",
    photoEditorNote:
      "拖动调整位置，滚动鼠标滚轮缩放。点击“保存”后，修改才会应用到预览中。",
    cancel: "取消",
    save: "保存",
    previewLabel: "预览",
    previewTitle: "履历书预览",
    resumePreview: "履历书预览",
    theme: "配色",
    themeNavy: "经典藏蓝",
    themeGraphite: "极简石墨灰",
    themeSlate: "沉稳灰蓝",
    themeForest: "森林绿",
    themeBurgundy: "深酒红",
    themeAmber: "暖琥珀",
    background: "背景",
    backgroundPaper: "纯白",
    backgroundMist: "冷雾",
    backgroundLinen: "柔和亚麻",
    savePdf: "导出 PDF",
    printTipTitle: "PDF 保存提示",
    printTip:
      "打印时将纸张设为 A4、缩放保持“默认”，并关闭页眉和页脚，导出的效果最佳。",
    aboutTitle: "关于本工具",
    aboutText:
      "日本常见的履历书模板往往难以展现个人风格和职业经历。这个工具让你从 Markdown 出发，自己排版一份简洁、有设计感的 A4 履历书。所有内容仅在浏览器中处理，不会上传到服务器。",
    howToTitle: "使用方法",
    howToStep1: "点击“加载示例”查看 Markdown 的写法，或打开自己的 .md 文件。",
    howToStep2: "在左侧编辑器中修改内容，右侧预览会实时更新。",
    howToStep3: "点击“导出 PDF”，在打印对话框中将输出目标选择为“保存为 PDF”。",
    howToStep4:
      "也可以把示例和自己的履历书一起交给 AI，请它按照示例的标题和结构整理内容。向外部 AI 服务发送个人信息前，请先确认该服务的隐私设置。",
    contactTitle: "联系方式",
    contactHelp:
      "在姓名后另起一行填写联系方式，内容会显示在标题下方。<strong>Phone 和 Email</strong>直接写文本；<strong>LinkedIn、GitHub、Portfolio、个人网站、社交媒体</strong>等使用 Markdown 链接。",
    syntaxTitle: "支持的 Markdown 语法",
    syntaxText: "支持标题（# ## ###）、列表、表格、粗体等标准 Markdown 语法。",
    clearConfirm: "要清空编辑器中的全部内容吗？",
    pageAriaLabel: "履历书第 {count} 页",
    pageCount: "A4 / {count} 页",
    resumePhotoAlt: "个人头像",
  },
} as const;

export type MessageKey = keyof typeof messages.ja;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "ja" || value === "en" || value === "zh";
}

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ja";

  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (isLocale(stored)) return stored;

  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith("zh")) return "zh";
  if (browserLanguage.startsWith("en")) return "en";
  return "ja";
}

export function translate(locale: Locale, key: MessageKey) {
  return messages[locale][key] ?? messages.ja[key];
}
