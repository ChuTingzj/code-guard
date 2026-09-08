'use client';

import { useEffect, useState } from 'react';

type Doc = {
  id: string;
  fileName: string;
  status: string;
  error?: string | null;
  _count?: { chunks: number };
};

export function DocumentListPoll({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Doc[];
}) {
  const [docs, setDocs] = useState(initial);

  useEffect(() => {
    setDocs(initial);
  }, [initial]);

  useEffect(() => {
    if (!projectId) return;
    const hasProcessing = docs.some((d) => d.status === 'PROCESSING');
    if (!hasProcessing) return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/proxy/knowledge/documents?projectId=${projectId}`);
      const json = await res.json();
      const data = (json.data ?? json) as Doc[];
      setDocs(data);
    }, 5000);

    return () => clearInterval(timer);
  }, [projectId, docs]);

  return (
    <ul className="divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div>
            <p className="font-medium">{d.fileName}</p>
            <p className="text-slate-500">
              {d.status}
              {d._count ? ` · ${d._count.chunks} chunks` : ''}
              {d.error ? ` · ${d.error}` : ''}
            </p>
          </div>
          <StatusPill status={d.status} />
        </li>
      ))}
      {!docs.length ? <li className="py-6 text-center text-slate-400">暂无文档</li> : null}
    </ul>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'READY'
      ? 'bg-emerald-50 text-passed'
      : status === 'FAILED'
        ? 'bg-red-50 text-rejected'
        : 'bg-amber-50 text-warning';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}
