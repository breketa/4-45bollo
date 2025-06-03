import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import LeftSidebar from '../components/layout/LeftSidebar';
import RightSidebar from '../components/layout/RightSidebar';
import ProductForm from '../components/forms/ProductForm';
import ProductList from '../components/products/ProductList';

export default function Products() {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[hsl(var(--dark))]">
      <LeftSidebar />
      <RightSidebar />
      
      <main className="ml-80 mr-80 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-white">პროდუქტები</h1>
            <button
              onClick={() => setShowAddProduct(true)}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md hover:bg-[hsl(var(--primary-dark))] transition-colors"
            >
              ახალი პროდუქტი
            </button>
          </div>

          {showAddProduct ? (
            <div className="bg-[hsl(var(--dark-lighter))] rounded-lg p-6 mb-8">
              <ProductForm onClose={() => setShowAddProduct(false)} />
            </div>
          ) : (
            <ProductList />
          )}
        </div>
      </main>
    </div>
  );
} 