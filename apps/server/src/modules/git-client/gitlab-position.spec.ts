import { buildGitlabInlinePosition } from './gitlab-position.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function testUsesDistinctDiffRefsShas() {
  const position = buildGitlabInlinePosition(
    {
      base_sha: 'base111',
      start_sha: 'start222',
      head_sha: 'head333',
    },
    { filePath: 'src/app.ts', line: 42 },
  );

  assert(position.baseSha === 'base111', 'baseSha from diff_refs.base_sha');
  assert(position.startSha === 'start222', 'startSha from diff_refs.start_sha');
  assert(position.headSha === 'head333', 'headSha from diff_refs.head_sha');
  assert(position.baseSha !== position.headSha, 'must not reuse head for base');
  assert(position.startSha !== position.headSha, 'must not reuse head for start');
  assert(position.positionType === 'text', 'positionType text');
  assert(position.newPath === 'src/app.ts', 'newPath');
  assert(position.oldPath === 'src/app.ts', 'oldPath');
  assert(position.newLine === 42, 'newLine');
  console.log('ok: buildGitlabInlinePosition uses distinct SHAs');
}

function testRejectsIncompleteDiffRefs() {
  let threw = false;
  try {
    buildGitlabInlinePosition(
      { base_sha: '', start_sha: 's', head_sha: 'h' },
      { filePath: 'a.ts', line: 1 },
    );
  } catch {
    threw = true;
  }
  assert(threw, 'incomplete diff_refs should throw');
  console.log('ok: buildGitlabInlinePosition rejects incomplete diff_refs');
}

testUsesDistinctDiffRefsShas();
testRejectsIncompleteDiffRefs();
