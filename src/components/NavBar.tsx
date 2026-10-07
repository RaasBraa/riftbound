import Link from 'next/link';

interface NavBarProps {
  currentPage: string;
}

export function NavBar({ currentPage }: NavBarProps) {
  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Collection', href: '/collection' },
    { name: 'Inventory', href: '/inventory' },
    { name: 'Purchases', href: '/purchases' },
    { name: 'Deals', href: '/deals' },
    { name: 'Sold', href: '/sold' },
    { name: 'Settings', href: '/settings' },
    { name: 'Gallery', href: '/gallery' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                Riftbound Business
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    currentPage === item.name
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
