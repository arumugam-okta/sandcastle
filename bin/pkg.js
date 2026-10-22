#!/usr/bin/env node
// Usage: npm run pkg -- add <pkg[@version]> | remove <pkg> | list
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const file = new URL('../deps.json', import.meta.url);
const deps = JSON.parse(fs.readFileSync(file, 'utf8'));
const [cmd, ...args] = process.argv.slice(2);
const save = () => fs.writeFileSync(file, JSON.stringify(deps, null, 2) + '\n');

// "@scope/name@1.2.3" -> ["@scope/name", "1.2.3"]
const parse = (s) => {
  const i = s.lastIndexOf('@');
  return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, 'latest'];
};

if (cmd === 'add' && args.length) {
  for (const arg of args) {
    const [name, range] = parse(arg);
    try {
      const v = execSync(`npm view ${name}@${range} version`, { stdio: ['ignore', 'pipe', 'pipe'] })
        .toString().trim().split('\n').pop().split(' ').pop().replace(/['"]/g, '');
      deps[name] = range === 'latest' ? `^${v}` : range;
      console.log(`added ${name}@${deps[name]}`);
    } catch {
      console.error(`could not resolve ${arg} on npm`);
      process.exitCode = 1;
    }
  }
  save();
} else if (cmd === 'remove' && args.length) {
  for (const n of args) { delete deps[n]; console.log(`removed ${n}`); }
  save();
} else if (cmd === 'list') {
  console.log(deps);
} else {
  console.log('usage: npm run pkg -- add <pkg[@version]> | remove <pkg> | list');
}
