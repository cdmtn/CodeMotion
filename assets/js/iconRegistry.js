/**
 * @fileoverview Icon registry and resolution mapping for files and directories.
 * Maps file names, extensions, and directory names to their corresponding SVG icon paths.
 */

/**
 * Mapping table of file extensions and specific filenames to icon SVG file names.
 * @type {Record<string, string>}
 */
export const ICON_MAP = {
  // Languages & Scripts
  js: "js.svg",
  javascript: "js.svg",
  jsx: "react.svg",
  ts: "ts.svg",
  typescript: "ts.svg",
  tsx: "react-ts.svg",
  mjs: "js.svg",
  cjs: "js.svg",
  py: "python.svg",
  python: "python.svg",
  pyw: "python.svg",
  c: "c.svg",
  h: "h.svg",
  cpp: "cplus.svg",
  "c++": "cplus.svg",
  cc: "cplus.svg",
  cplusplus: "cplus.svg",
  cxx: "cplus.svg",
  hpp: "h.svg",
  cs: "csharp.svg",
  csharp: "csharp.svg",
  "c#": "csharp.svg",
  go: "go.svg",
  golang: "go.svg",
  rs: "rust.svg",
  rust: "rust.svg",
  java: "java.svg",
  kt: "kotlin.svg",
  kotlin: "kotlin.svg",
  kts: "kotlin.svg",
  php: "php.svg",
  rb: "ruby.svg",
  ruby: "ruby.svg",
  lua: "lua.svg",
  sh: "shell.svg",
  bash: "shell.svg",
  shell: "shell.svg",
  zsh: "shell.svg",
  ps1: "shell.svg",
  powershell: "shell.svg",
  bat: "shell.svg",
  cmd: "shell.svg",
  zig: "zig.svg",
  nim: "nim.svg",
  swift: "swift.svg",
  dart: "dart.svg",
  scala: "scala.svg",
  elixir: "elixir.svg",
  ex: "elixir.svg",
  exs: "elixir.svg",
  erl: "erlang.svg",
  erlang: "erlang.svg",
  clj: "clojure.svg",
  clojure: "clojure.svg",
  cljs: "clojure.svg",
  pl: "perl.svg",
  perl: "perl.svg",
  pm: "perl.svg",
  r: "r.svg",
  sol: "solidity.svg",
  solidity: "solidity.svg",
  v: "v.svg",
  ocaml: "ocaml.svg",
  ml: "ocaml.svg",
  mli: "ocaml.svg",
  fs: "fsharp.svg",
  fsharp: "fsharp.svg",
  fsi: "fsharp.svg",
  fsx: "fsharp.svg",
  fsscript: "fsharp.svg",

  // Web Frameworks & Tools
  vue: "vue.svg",
  svelte: "svelte.svg",
  astro: "astro.svg",
  angular: "angular.svg",
  next: "next.svg",
  nuxt: "nuxt.svg",
  gatsby: "gatsby.svg",
  vite: "vite.svg",
  webpack: "webpack.svg",
  babel: "babel.svg",
  eslint: "eslint.svg",
  prettier: "prettier.svg",
  postcss: "postcss.svg",
  tailwind: "tailwind.svg",
  sass: "sass.svg",
  scss: "sass.svg",
  less: "sass.svg",
  styl: "stylus.svg",
  html: "html.svg",
  css: "brackets-orange.svg",
  graphql: "graphql.svg",
  gql: "graphql.svg",

  // Data & Config
  json: "code-yellow.svg",
  json5: "code-yellow.svg",
  yaml: "yaml.svg",
  yml: "yaml.svg",
  xml: "xml.svg",
  toml: "gear.svg",
  ini: "gear.svg",
  conf: "gear.svg",
  config: "gear.svg",
  csv: "csv.svg",
  sql: "database.svg",
  prisma: "prisma.svg",
  db: "database.svg",
  sqlite: "database.svg",

  // Documentation
  md: "markdown.svg",
  markdown: "markdown.svg",
  mdx: "mdx.svg",
  txt: "document.svg",
  plaintext: "document.svg",
  text: "document.svg",
  pdf: "pdf.svg",
  doc: "document.svg",
  docx: "document.svg",
  rtf: "document.svg",

  // Images & Media
  png: "image.svg",
  jpg: "image.svg",
  jpeg: "image.svg",
  gif: "image.svg",
  webp: "image.svg",
  svg: "svg.svg",
  ico: "image.svg",
  mp4: "video.svg",
  mov: "video.svg",
  avi: "video.svg",
  mp3: "audio.svg",
  wav: "audio.svg",
  flac: "audio.svg",

  // Build Systems
  cmake: "cmake.svg",
  "cmakelists.txt": "cmake.svg",
  "cmake.txt": "cmake.svg",

  // DevOps & Environment
  dockerfile: "docker.svg",
  dockerignore: "docker.svg",
  "docker-compose.yml": "docker.svg",
  "docker-compose.yaml": "docker.svg",
  ".gitignore": "git.svg",
  ".gitconfig": "git.svg",
  ".gitattributes": "git.svg",
  ".gitmodules": "git.svg",
  ".gitkeep": "git.svg",
  gitignore: "git.svg",
  gitconfig: "git.svg",
  gitattributes: "git.svg",
  "package.json": "npm.svg",
  "package-lock.json": "npm.svg",
  "yarn.lock": "yarn.svg",
  "pnpm-lock.yaml": "pnpm.svg",
  "pnpm-workspace.yaml": "pnpm.svg",
  "tsconfig.json": "tsconfig.svg",
  "jsconfig.json": "tsconfig.svg",
  "vite.config.ts": "vite.svg",
  "vite.config.js": "vite.svg",
  "next.config.js": "next.svg",
  "next.config.mjs": "next.svg",
  "svelte.config.js": "svelte.svg",
  "tailwind.config.js": "tailwind.svg",
  "tailwind.config.ts": "tailwind.svg",
  "vue.config.js": "vue.svg",
  "webpack.config.js": "webpack.svg",
  "webpack.config.ts": "webpack.svg",
  ".env": "gear.svg",
  ".env.local": "gear.svg",
  ".env.development": "gear.svg",
  ".env.production": "gear.svg",
  ".editorconfig": "editorconfig.svg",
  "vercel.json": "vercel.svg",
  "netlify.toml": "netlify.svg",
  procfile: "gear.svg",

  // Misc
  exe: "exe.svg",
  bin: "exe.svg",
  patch: "patch.svg",
  diff: "patch.svg",
  lock: "lock.svg",
  license: "license.svg",
  copying: "license.svg",
};

/**
 * Mapping table of directory names to custom folder icon prefix identifiers.
 * @type {Record<string, string>}
 */
export const FOLDER_MAP = {
  // Common
  src: "folder-src",
  public: "folder-assets",
  assets: "folder-assets",
  static: "folder-assets",
  images: "folder-images",
  img: "folder-images",
  fonts: "folder-fonts",
  icons: "folder-images",

  // Development
  node_modules: "folder-node-modules",
  components: "folder-app",
  ui: "folder-app",
  views: "folder-app",
  pages: "folder-app",
  layouts: "folder-layout",
  utils: "folder-utils",
  helpers: "folder-helpers",
  hooks: "folder-hooks",
  services: "folder-services",
  api: "folder-core",
  controllers: "folder-core",
  models: "folder-models",
  schemas: "folder-models",
  types: "folder-interfaces",
  interfaces: "folder-interfaces",
  context: "folder-context",
  providers: "folder-providers",
  store: "folder-reducer",
  redux: "folder-reducer",
  actions: "folder-actions",
  reducers: "folder-reducer",
  selectors: "folder-selector",
  effects: "folder-effects",
  middleware: "folder-middleware",
  interceptors: "folder-interceptors",
  router: "folder-router",
  routes: "folder-router",
  "src-tauri": "folder-tauri",

  // Styles
  styles: "folder-sass",
  css: "folder-sass",
  scss: "folder-sass",
  sass: "folder-sass",
  less: "folder-sass",

  // Build & Config
  scripts: "folder-build",
  dist: "folder-build",
  build: "folder-build",
  out: "folder-build",
  target: "folder-target",
  bin: "folder-build",
  config: "folder-config",
  configs: "folder-config",
  settings: "folder-config",
  ".vscode": "folder-vscode",
  ".github": "folder-github",
  ".git": "folder-github",
  ".husky": "folder-config",

  // Testing
  tests: "folder-cypress",
  test: "folder-cypress",
  __tests__: "folder-cypress",
  spec: "folder-cypress",
  specs: "folder-cypress",
  cypress: "folder-cypress",

  // Backend & Cloud
  database: "folder-database",
  db: "folder-database",
  sql: "folder-database",
  prisma: "folder-prisma",
  docker: "folder-docker",
  aws: "folder-aws",
  azure: "folder-azure",
  vercel: "folder-vercel",
  supabase: "folder-supabase",
  firebase: "folder-firebase",

  // Platforms
  android: "folder-android",
  ios: "folder-ios",
  app: "folder-app",

  // Documentation
  docs: "folder-documents",
  doc: "folder-documents",
  markdown: "folder-documents",

  // Misc
  temp: "folder-gray",
  tmp: "folder-gray",
  cache: "folder-gray",
  logs: "folder-gray",
  archive: "folder-gray",
};

/**
 * Returns the icon filename for a given file based on its name or extension.
 * @param {string} [filename] - The full filename or path segment.
 * @returns {string} The filename of the SVG icon.
 */
export function getFileIcon(filename) {
  if (!filename) return "document.svg";
  const lower = filename.toLowerCase();
  if (ICON_MAP[lower]) return ICON_MAP[lower];

  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "document.svg";
  const ext = filename.slice(dot + 1).toLowerCase();
  return ICON_MAP[ext] ?? "document.svg";
}

/**
 * Returns the folder icon filename for a given folder name and expanded state.
 * @param {string} [name] - Folder name.
 * @param {boolean} [open=false] - Whether the folder is expanded.
 * @returns {string} The filename of the folder SVG icon.
 */
export function getFolderIcon(name, open = false) {
  if (!name) return open ? "folder-open.svg" : "folder.svg";

  const lowerName = name.toLowerCase();
  const icon = FOLDER_MAP[lowerName];
  if (icon) return `${icon}.svg`;
  return open ? "folder-open.svg" : "folder.svg";
}

/**
 * Resolves the relative URL path to a file's SVG icon.
 * @param {string} filename - Target file name.
 * @returns {string} Relative path to the file SVG icon.
 */
export function getFileIconUrl(filename) {
  const icon = getFileIcon(filename);
  return `../assets/media/icons/symbols/files/${icon}`;
}

/**
 * Resolves the relative URL path to a directory's SVG icon based on open state.
 * @param {string} [name] - Target folder name.
 * @param {boolean} [open=false] - Folder open/expanded state.
 * @returns {string} Relative path to the folder SVG icon.
 */
export function getFolderIconUrl(name, open = false) {
  const icon = getFolderIcon(name, open);
  return `../assets/media/icons/symbols/folders/${icon}`;
}
