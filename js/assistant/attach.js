// Files a user attaches to a message. Images are shrunk in the browser before upload (they are
// sent once, with that message); PDFs go as they are; text and code files are read as text.
const MAX_SIDE = 1568;
const MAX_PDF_BYTES = 3_000_000;
const MAX_TEXT_BYTES = 400_000;
const MAX_TEXT_CHARS = 20_000;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|toml|ini|conf|log|html?|css|scss|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|bash|sql|swift|r|lua|pl|dockerfile|env)$/i;

export const ACCEPT = 'image/*,application/pdf,.txt,.md,.csv,.json,.yaml,.yml,.log,.html,.css,.js,.ts,.py,.java,.go,.rs,.c,.cpp,.cs,.php,.sh,.sql,.xml';

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(new Error(`Couldn't read ${blob.name ?? 'the file'}.`));
  r.readAsDataURL(blob);
});

async function shrink(file, side, quality) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

export async function readAttachment(file) {
  if (file.type.startsWith('image/')) {
    let full;
    try { full = await shrink(file, MAX_SIDE, 0.85); } catch { throw new Error(`${file.name} isn't an image this browser can open.`); }
    return { kind: 'image', name: file.name, mediaType: 'image/jpeg', data: full.split(',')[1], thumb: await shrink(file, 240, 0.7) };
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is over 3 MB. Try a smaller PDF.`);
    return { kind: 'pdf', name: file.name, mediaType: 'application/pdf', data: await toBase64(file) };
  }
  if (file.type.startsWith('text/') || /json|xml|javascript|yaml/.test(file.type) || TEXT_EXT.test(file.name)) {
    if (file.size > MAX_TEXT_BYTES) throw new Error(`${file.name} is too large to read here.`);
    const text = await file.text();
    return { kind: 'text', name: file.name, text: text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n…(truncated)` : text };
  }
  throw new Error(`${file.name}: OMT AI can read images, PDFs and text or code files.`);
}

/** What the model sees for text files: the message followed by each file in a fenced block. */
export function withTextFiles(content, files) {
  if (!files?.length) return content;
  const ext = (n) => (n.match(/\.(\w+)$/)?.[1] ?? '').toLowerCase();
  return `${content}\n\n${files.map((f) => `Attached file: ${f.name}\n\`\`\`\`${ext(f.name)}\n${f.text}\n\`\`\`\``).join('\n\n')}`;
}
