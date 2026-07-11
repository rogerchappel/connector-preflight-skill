import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['pack', '--dry-run'], { encoding: 'utf8' });
const output = `${result.stdout || ''}\n${result.stderr || ''}`;

if (result.status !== 0) {
  process.stderr.write(output);
  process.exit(result.status || 1);
}

const required = [
  'bin/connector-preflight.js',
  'src/index.js',
  'fixtures/connectors.json',
  'fixtures/action.pass.json',
  'fixtures/action.needs-approval.json',
  'fixtures/action.missing-scope.json',
  'fixtures/action.blocked.json',
  'docs/EXAMPLES.md',
  'docs/RELEASE_CANDIDATE.md',
  'docs/SAFETY.md',
  'SKILL.md',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'scripts/package-smoke.js'
];

const missing = required.filter((entry) => !output.includes(entry));

if (missing.length > 0) {
  console.error(`package smoke missing entries:\n${missing.join('\n')}`);
  process.exit(1);
}

console.log('package smoke passed');
