const STYLES: Record<string, string> = {
  owned: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  listed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  sold: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STYLES[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
      {status}
    </span>
  );
}
