'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

type Issue = {
  id: string;
  category: string;
  severity: string;
  filePath: string;
  line: number | null;
  ruleTitle: string | null;
  description: string;
};

type Detail = {
  id: string;
  prNumber: number;
  status: string;
  record?: {
    verdict: string;
    finalMarkdown: string;
    issues: Issue[];
  } | null;
};

export function ReviewDetailDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!taskId) {
      setDetail(null);
      return;
    }
    fetch(`/api/proxy/reviews/${taskId}`)
      .then((r) => r.json())
      .then((json) => setDetail(json.data ?? json))
      .catch(() => setDetail(null));
  }, [taskId]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">审查详情</h2>
          <button onClick={onClose} className="text-sm text-slate-500">
            关闭
          </button>
        </div>
        {!detail ? (
          <p className="text-sm text-slate-400">加载中…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <p>
              PR #{detail.prNumber} · {detail.status}
              {detail.record ? (
                <span className={`ml-2 verdict-${detail.record.verdict.toLowerCase()}`}>
                  {detail.record.verdict}
                </span>
              ) : null}
            </p>
            {detail.record?.finalMarkdown ? (
              <div className="prose prose-sm max-w-none rounded-md bg-slate-50 p-4">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {detail.record.finalMarkdown}
                </ReactMarkdown>
              </div>
            ) : null}
            <ul className="space-y-2">
              {(detail.record?.issues ?? []).map((i) => (
                <li key={i.id} className="rounded-md border border-slate-100 p-3">
                  <p className="font-medium">
                    [{i.severity}/{i.category}] {i.filePath}:{i.line ?? '?'}
                  </p>
                  <p className="mt-1 text-slate-600">{i.description}</p>
                  {i.ruleTitle ? (
                    <p className="mt-1 text-xs text-brand">规范: {i.ruleTitle}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
