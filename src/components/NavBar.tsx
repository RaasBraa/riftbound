'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';

interface NavBarProps {
  currentPage: string;
}

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/' },
  { name: 'Collection', href: '/collection' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Purchases', href: '/purchases' },
  { name: 'Deals', href: '/deals' },
  { name: 'Sold', href: '/sold' },
  { name: 'Settings', href: '/settings' },
  { name: 'Gallery', href: '/gallery' },
];

export function NavBar({ currentPage }: NavBarProps) {
  const { resolved, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex min-w-0">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-text truncate">
                Riftbound Business
              </Link>
            </div>
            <div className="hidden lg:ml-6 lg:flex lg:space-x-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    currentPage === item.name
                      ? 'border-accent text-text'
                      : 'border-transparent text-muted hover:border-border hover:text-text'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="btn-ghost"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              className="lg:hidden btn-ghost"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden pb-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`${
                  currentPage === item.name ? 'bg-background text-text' : 'text-muted hover:text-text'
                } block rounded-md px-3 py-2 text-sm font-medium`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
