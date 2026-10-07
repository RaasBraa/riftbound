export function Spinner({ label }: { label?: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      {label && <p className="mt-2 text-muted">{label}</p>}
    </div>
  );
}
