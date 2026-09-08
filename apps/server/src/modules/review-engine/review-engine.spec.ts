import { computeVerdict, ReviewIssueItem } from './review-state';
import { batchDiffFiles, buildQueryFromDiff, prioritizeFiles } from './diff-batch.util';
import { PrDiffFile } from '../git-client/git-provider.interface';
import { truncateDiffFiles } from '../git-client/diff.util';

function issue(
  partial: Partial<ReviewIssueItem> & Pick<ReviewIssueItem, 'severity'>,
): ReviewIssueItem {
  return {
    category: 'SECURITY',
    filePath: 'a.ts',
    line: 1,
    ruleTitle: null,
    description: 'x',
    suggestion: null,
    patch: null,
    ...partial,
  };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function testVerdict() {
  assert(computeVerdict([]) === 'PASSED', 'empty => PASSED');
  assert(computeVerdict([issue({ severity: 'INFO' })]) === 'PASSED', 'info => PASSED');
  assert(computeVerdict([issue({ severity: 'WARNING' })]) === 'WARNING', 'warning');
  assert(
    computeVerdict([issue({ severity: 'WARNING' }), issue({ severity: 'CRITICAL' })]) ===
      'REJECTED',
    'critical => REJECTED',
  );
  console.log('ok: computeVerdict');
}

function testBatching() {
  const files: PrDiffFile[] = Array.from({ length: 5 }, (_, i) => ({
    filePath: `src/f${i}.ts`,
    status: 'modified',
    language: 'typescript',
    patch: ('+' + 'a'.repeat(100) + '\n').repeat(20),
  }));
  files.push({
    filePath: 'src/f.test.ts',
    status: 'modified',
    language: 'typescript',
    patch: '+test\n',
  });
  const prioritized = prioritizeFiles(files);
  assert(prioritized[prioritized.length - 1].filePath.includes('test'), 'tests last');
  const batches = batchDiffFiles(files);
  assert(batches.length >= 1, 'has batches');
  const q = buildQueryFromDiff(files);
  assert(q.includes('typescript'), 'query has language');
  console.log('ok: batchDiffFiles / buildQueryFromDiff');
}

function testTruncate() {
  const many: PrDiffFile[] = Array.from({ length: 40 }, (_, i) => ({
    filePath: `src/${i}.ts`,
    status: 'modified' as const,
    language: 'typescript',
    patch: '+x\n',
  }));
  many.push({
    filePath: 'package-lock.json',
    status: 'modified',
    language: 'json',
    patch: '+lock\n',
  });
  const { files, truncated } = truncateDiffFiles(many, 30, 60_000);
  assert(truncated, 'should truncate');
  assert(files.length <= 30, 'max 30');
  assert(!files.some((f) => f.filePath.includes('package-lock')), 'skip lockfile');
  console.log('ok: truncateDiffFiles');
}

testVerdict();
testBatching();
testTruncate();
console.log('All review-engine unit checks passed');
