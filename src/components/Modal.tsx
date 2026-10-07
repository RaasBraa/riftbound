'use client';

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/50" aria-label="Close modal" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="relative w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="modal-title" className="text-lg font-semibold text-text">{title}</h3>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
