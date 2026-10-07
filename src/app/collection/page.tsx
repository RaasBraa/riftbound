'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';

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
    <AppShell currentPage="Collection">
      <PageHeader
        title="Collection"
        subtitle={`${ownedCards.length} unique cards • ${totalCards} total copies`}
      />

      {loading ? (
        <Spinner label="Loading collection..." />
      ) : ownedCards.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted">No cards in your collection yet.</p>
          <p className="text-sm text-muted mt-2">
            Use the legacy <Link href="/gallery" className="text-accent underline">Gallery</Link> or intake tools to add cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {ownedCards.map((card) => (
            <div key={card.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-[2.5/3.5] relative bg-background">
                <img
                  src={card.image}
                  alt={card.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2">
                <h3 className="text-sm font-medium text-text truncate" title={card.name}>
                  {card.name}
                </h3>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted">{card.code}</span>
                  <span className="text-xs font-semibold text-accent">×{collection[card.id]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
