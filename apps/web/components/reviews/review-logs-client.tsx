'use client';

import { useState } from 'react';
import { ReviewDetailDrawer } from '@/components/reviews/review-detail-drawer';

type Item = {
  id: string;
  prNumber: number;
  prTitle?: string | null;
  prAuthor?: string | null;
  status: string;
  createdAt: string;
  record?: { verdict: string; durationMs: number } | null;
  project?: { name: string; repoFullName: string };
};

export function ReviewLogsClient({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="ui-table-wrap">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-4 py-3 font-medium">PR</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">结论</th>
              <th className="px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-t border-border transition duration-ui hover:bg-paper"
                onClick={() => setSelected(item.id)}
              >
                <td className="px-4 py-3">{item.project?.name ?? '-'}</td>
                <td className="px-4 py-3">
                  #{item.prNumber} {item.prTitle ?? ''}
                </td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">
                  {item.record ? (
                    <span className={`verdict-${item.record.verdict.toLowerCase()}`}>
                      {item.record.verdict}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  暂无审查记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <ReviewDetailDrawer taskId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
