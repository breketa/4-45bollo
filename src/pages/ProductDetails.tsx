import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import LeftSidebar from '../components/layout/LeftSidebar';
import RightSidebar from '../components/layout/RightSidebar';
import { Product } from '../types/product';

export default function ProductDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || !user) return;

      try {
        const productRef = doc(db, 'products', id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          setError('პროდუქტი ვერ მოიძებნა');
          return;
        }

        const productData = productSnap.data() as Product;
        setProduct(productData);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('შეცდომა პროდუქტის ჩვენებისას');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, user]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
      );
    }

    if (error || !product) {
      return (
        <>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500">
            {error || 'პროდუქტი ვერ მოიძებნა'}
          </div>
          <button
            onClick={() => router.push('/products')}
            className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md hover:bg-[hsl(var(--primary-dark))] transition-colors"
          >
            დაბრუნება პროდუქტების სიაში
          </button>
        </>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
          <button
            onClick={() => router.push('/products')}
            className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md hover:bg-[hsl(var(--primary-dark))] transition-colors"
          >
            დაბრუნება
          </button>
        </div>

        <div className="bg-[hsl(var(--dark-lighter))] rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* პროდუქტის სურათი */}
            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  სურათი არ არის
                </div>
              )}
            </div>

            {/* პროდუქტის დეტალები */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">აღწერა</h2>
                <p className="text-gray-300">{product.description}</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white mb-2">ფასი</h2>
                <p className="text-2xl font-bold text-[hsl(var(--primary))]">
                  {product.price}₾
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white mb-2">კატეგორია</h2>
                <p className="text-gray-300">{product.category}</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white mb-2">სტატუსი</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                  product.status === 'active'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {product.status === 'active' ? 'აქტიური' : 'არააქტიური'}
                </span>
              </div>

              {product.channelId && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">არხის ინფორმაცია</h2>
                  <div className="flex items-center space-x-3">
                    {product.channelLogo && (
                      <img
                        src={product.channelLogo}
                        alt={product.channelName || 'Channel logo'}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="text-white font-medium">{product.channelName}</p>
                      <p className="text-gray-400 text-sm">
                        {product.subscribers?.toLocaleString()} გამომწერი
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--dark))]">
      <LeftSidebar />
      <RightSidebar />
      <main className="ml-80 mr-80 p-8">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
} 