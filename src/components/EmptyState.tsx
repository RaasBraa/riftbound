import Link from 'next/link';

export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="card p-8 text-center">
      <p className="text-text font-medium">{title}</p>
      <p className="text-sm text-muted mt-2">{body}</p>
      {href && cta && (
        <Link href={href} className="btn-primary inline-flex mt-4">
          {cta}
        </Link>
      )}
    </div>
  );
}
