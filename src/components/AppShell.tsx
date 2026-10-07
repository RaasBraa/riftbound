'use client';

import { ApiBanner } from './ApiBanner';
import { NavBar } from './NavBar';

export function AppShell({
  currentPage,
  children,
}: {
  currentPage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-text">
      <NavBar currentPage={currentPage} />
      <ApiBanner />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
