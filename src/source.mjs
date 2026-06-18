// Source analysis engine: masking + position utilities.
//
// `maskSource` replaces the *contents* of strings and comments with spaces
// while preserving every byte offset and newline. That lets rules run plain
// regexes without matching inside string literals or comments. Template
// literals are special-cased so that `${ ... }` interpolation expressions stay
// visible as code (we still want to flag `process.env` inside a template).

import path from 'node:path';

export function maskSource(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  // Frame stack. 'code' frames track brace depth so we know when a `${ }`
  // interpolation closes and we should return to the surrounding template.
  const stack = [{ type: 'code', brace: 0 }];
  const top = () => stack[stack.length - 1];

  while (i < n) {
    const f = top();
    const c = src[i];
    const c2 = src[i + 1];

    if (f.type === 'code') {
      if (c === '/' && c2 === '/') {
        while (i < n && src[i] !== '\n') { out[i] = ' '; i++; }
        continue;
      }
      if (c === '/' && c2 === '*') {
        out[i] = out[i + 1] = ' '; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] !== '\n') out[i] = ' ';
          i++;
        }
        if (i < n) { out[i] = out[i + 1] = ' '; i += 2; }
        continue;
      }
      if (c === "'" || c === '"') {
        i++;
        while (i < n && src[i] !== c) {
          if (src[i] === '\\') { out[i] = ' '; if (i + 1 < n && src[i + 1] !== '\n') out[i + 1] = ' '; i += 2; continue; }
          if (src[i] !== '\n') out[i] = ' ';
          i++;
        }
        i++; // closing quote
        continue;
      }
      if (c === '`') { stack.push({ type: 'template' }); i++; continue; }
      if (c === '{') { f.brace++; i++; continue; }
      if (c === '}') {
        if (f.brace === 0 && stack.length > 1) { stack.pop(); i++; continue; } // close ${ }
        if (f.brace > 0) f.brace--;
        i++; continue;
      }
      i++; continue;
    }

    // template-literal text
    if (c === '\\') { out[i] = ' '; if (i + 1 < n && src[i + 1] !== '\n') out[i + 1] = ' '; i += 2; continue; }
    if (c === '`') { stack.pop(); i++; continue; }
    if (c === '$' && c2 === '{') { stack.push({ type: 'code', brace: 0 }); i += 2; continue; }
    if (c !== '\n') out[i] = ' ';
    i++;
  }
  return out.join('');
}

export function isServerFile(p) {
  return /\.server\.(t|j)sx?$/.test(p) || /(^|[\\/])server[\\/]/.test(p);
}

export function isTsx(p) {
  return /\.(t|j)sx$/.test(p);
}

// Files that can ship to the browser bundle: components, routes, hooks, plain
// modules. We treat everything that is not explicitly server-only as client
// reachable, since TanStack Start tree-shakes server code by file convention.
export function isClientReachable(p) {
  if (isServerFile(p)) return false;
  if (/\.config\.(t|j)sx?$/.test(p)) return false;
  if (/(^|[\\/])(env|start)\.(t|j)sx?$/.test(p)) return false;
  if (/\.functions\.(t|j)sx?$/.test(p)) return false; // server fn wrappers are RPC stubs on client
  return true;
}

export class SourceFile {
  constructor(absPath, relPath, source) {
    this.path = absPath;
    this.relPath = relPath;
    this.source = source;
    this.masked = maskSource(source);
    this.lines = source.split('\n');
    this.maskedLines = this.masked.split('\n');
    this.isTsx = isTsx(absPath);
    this.isServer = isServerFile(absPath);
    this.isClientReachable = isClientReachable(absPath);
    this.base = path.basename(absPath);

    this._lineStarts = [0];
    for (let k = 0; k < source.length; k++) {
      if (source[k] === '\n') this._lineStarts.push(k + 1);
    }
  }

  // 0-based char index -> { line, column } (1-based, human friendly)
  posAt(index) {
    const starts = this._lineStarts;
    let lo = 0, hi = starts.length - 1, line = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= index) { line = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return { line: line + 1, column: index - starts[line] + 1 };
  }

  rawLine(line1) {
    return this.lines[line1 - 1] ?? '';
  }
}
