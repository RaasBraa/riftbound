'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Card {
  id: string;
  name: string;
  code: string;
  set: string;
  rarity: string;
  image: string;
}

interface Collection {
  [cardId: string]: number;
}

export default function CollectionPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [collection, setCollection] = useState<Collection>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cardsRes, collectionRes] = await Promise.all([
          fetch('/data/cards.json'),
          fetch('/data/collection.json'),
        ]);
        const cardsData = await cardsRes.json();
        const collectionData = await collectionRes.json();
        setCards(cardsData.cards || []);
        setCollection(collectionData || {});
      } catch (error) {
        console.error('Failed to load collection:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const ownedCards = cards.filter((card) => collection[card.id] > 0);
  const totalCards = ownedCards.reduce((sum, card) => sum + (collection[card.id] || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">Riftbound Business</Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/collection" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Collection
                </Link>
                <Link href="/inventory" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Inventory
                </Link>
                <Link href="/purchases" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Purchases
                </Link>
                <Link href="/deals" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Deals
                </Link>
                <Link href="/gallery" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Gallery
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Collection</h2>
            <div className="text-sm text-gray-500">
              {ownedCards.length} unique cards • {totalCards} total copies
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading collection...</p>
            </div>
          ) : ownedCards.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">No cards in your collection yet.</p>
              <p className="text-sm text-gray-400 mt-2">Use the legacy <Link href="/gallery" className="text-indigo-600 hover:text-indigo-500">Gallery</Link> or intake tools to add cards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {ownedCards.map((card) => (
                <div key={card.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-[2.5/3.5] relative bg-gray-100">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate" title={card.name}>
                      {card.name}
                    </h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{card.code}</span>
                      <span className="text-xs font-semibold text-indigo-600">×{collection[card.id]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
