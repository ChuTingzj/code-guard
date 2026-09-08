const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  go: 'go',
  java: 'java',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  kt: 'kotlin',
  swift: 'swift',
  md: 'markdown',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
};

const SKIP_PATTERNS = [
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i,
  /dist\//,
  /node_modules\//,
];

export function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? 'text';
}

export function isCodeFile(filePath: string): boolean {
  return !SKIP_PATTERNS.some((re) => re.test(filePath));
}

export function truncateDiffFiles<T extends { filePath: string; patch: string }>(
  files: T[],
  maxFiles = 30,
  maxBytes = 60_000,
): { files: T[]; truncated: boolean } {
  const codeFiles = files.filter((f) => isCodeFile(f.filePath));
  const priority = (p: string) => {
    if (/\.(test|spec)\./.test(p)) return 2;
    if (/\.(json|ya?ml|toml|md)$/.test(p)) return 1;
    return 0;
  };
  codeFiles.sort((a, b) => priority(a.filePath) - priority(b.filePath));

  const selected: T[] = [];
  let bytes = 0;
  let truncated = codeFiles.length < files.length;

  for (const f of codeFiles) {
    if (selected.length >= maxFiles) {
      truncated = true;
      break;
    }
    const size = Buffer.byteLength(f.patch ?? '', 'utf8');
    if (bytes + size > maxBytes && selected.length > 0) {
      truncated = true;
      break;
    }
    selected.push(f);
    bytes += size;
  }

  if (selected.length < codeFiles.length) truncated = true;
  return { files: selected, truncated };
}
