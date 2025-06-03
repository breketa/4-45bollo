"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

interface Seller {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
  rating: number;
  totalSales: number;
  verified: boolean;
  joinedDate: number;
  products: number;
  bio: string;
  location: string;
  responseTime: string;
  hasProducts: boolean;
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'withProducts' | 'topRated'>('all');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        // Get all products to track who has listings
        const productsRef = collection(db, "products");
        const productsSnapshot = await getDocs(productsRef);
        
        // Create a map of seller IDs and their product counts
        const sellerProducts = new Map<string, number>();
        productsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.userId) {
            sellerProducts.set(data.userId, (sellerProducts.get(data.userId) || 0) + 1);
          }
        });

        // Get all users
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        
        const sellersList = await Promise.all(
          usersSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            
            return {
              id: doc.id,
              name: data.displayName || data.name || data.email?.split('@')[0] || 'Anonymous',
              email: data.email || '',
              photoURL: data.photoURL || null,
              rating: data.profileRating || 0,
              totalSales: data.totalSales || 0,
              verified: data.verified || false,
              joinedDate: data.createdAt || Date.now(),
              products: sellerProducts.get(doc.id) || 0,
              bio: data.bio || '',
              location: data.location || '',
              responseTime: data.averageResponseTime || 'N/A',
              hasProducts: sellerProducts.has(doc.id)
            };
          })
        );

        // Sort sellers by rating and then by whether they have products
        sellersList.sort((a, b) => {
          if (a.hasProducts !== b.hasProducts) {
            return b.hasProducts ? 1 : -1;
          }
          return b.rating - a.rating;
        });

        setSellers(sellersList);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching sellers:", error);
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, []);

  const handleContact = (sellerId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push(`/my-chats?sellerId=${sellerId}`);
  };

  const handleProfileClick = (sellerId: string) => {
    router.push(`/profile/${sellerId}`);
  };

  const filteredSellers = sellers.filter(seller => {
    if (filter === 'withProducts') {
      return seller.hasProducts;
    }
    if (filter === 'topRated') {
      return seller.rating >= 4.5; // Show sellers with rating 4.5 or higher
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--dark))] text-gray-100 font-inter">
      {/* Header */}
      <header className="bg-[hsl(var(--dark-lighter))] shadow-md">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <Link href="/">
              <h1 className="text-2xl font-bold text-white mr-2 cursor-pointer">
                SWAPD<span className="text-[hsl(var(--primary))]">MARKET</span>
              </h1>
            </Link>
            <span className="bg-[hsl(var(--secondary))] text-white text-xs px-2 py-1 rounded">BETA</span>
          </div>

          <nav className="hidden md:flex items-center space-x-6 ml-8">
            <Link href="/" className="text-gray-300 hover:text-orange-500 transition-colors">
              Explore
            </Link>
            <a href="/#how-it-works" className="text-gray-300 hover:text-orange-500 transition-colors">How It Works</a>
            <Link href="/sellers" className="text-gray-300 hover:text-orange-500 transition-colors">
              Sellers
            </Link>
            {user ? (
              <Link href="/products/new" className="text-gray-300 hover:text-orange-500 transition-colors">
                Sell Channel
              </Link>
            ) : (
              <Link href="/login" className="text-gray-300 hover:text-orange-500 transition-colors">
                Sell Channel
              </Link>
            )}
            <Link href="/my-chats" className="text-gray-300 hover:text-orange-500 transition-colors flex items-center">
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Messages
            </Link>

            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white p-0"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name || 'User'} className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                      <span className="text-white font-bold">{user.email?.charAt(0).toUpperCase() || user.name?.charAt(0).toUpperCase() || "U"}</span>
                    </div>
                  )}
                  <span>{user.name || user.email?.split('@')[0]}</span>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"></path>
                  </svg>
                </button>
              </div>
            ) : (
              <Link href="/login" className="bg-[hsl(var(--primary))] hover:bg-opacity-90 text-white px-4 py-2 rounded-md">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white mb-6">All Sellers</h1>
        
        {/* Filter Buttons */}
        <div className="flex justify-center space-x-4 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 ${
              filter === 'all'
                ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                : 'bg-[hsl(var(--dark-card))] text-gray-300 hover:bg-[hsl(var(--dark-lighter))] hover:shadow-lg'
            }`}
          >
            All Sellers
          </button>
          <button
            onClick={() => setFilter('withProducts')}
            className={`px-4 py-2 rounded-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 ${
              filter === 'withProducts'
                ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                : 'bg-[hsl(var(--dark-card))] text-gray-300 hover:bg-[hsl(var(--dark-lighter))] hover:shadow-lg'
            }`}
          >
            With Products
          </button>
          <button
            onClick={() => setFilter('topRated')}
            className={`px-4 py-2 rounded-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 ${
              filter === 'topRated'
                ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                : 'bg-[hsl(var(--dark-card))] text-gray-300 hover:bg-[hsl(var(--dark-lighter))] hover:shadow-lg'
            }`}
          >
            Top Rated
          </button>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-[hsl(var(--dark-card))] rounded-lg p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSellers.map((seller) => (
              <div 
                key={seller.id} 
                className="bg-[hsl(var(--dark-card))] rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer"
                style={{
                  transition: 'all 300ms ease-in-out',
                  transform: 'translateY(0)',
                  willChange: 'transform, box-shadow'
                }}
                onClick={() => handleProfileClick(seller.id)}
              >
                <div className="flex items-center space-x-4 mb-4">
                  {seller.photoURL ? (
                    <img src={seller.photoURL} alt={seller.name} className="h-12 w-12 rounded-full" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{seller.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 
                        className="text-lg font-semibold text-white hover:text-[hsl(var(--primary))] transition-colors duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProfileClick(seller.id);
                        }}
                      >
                        {seller.name}
                      </h3>
                      {seller.verified && (
                        <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span>Rating: {seller.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>{seller.totalSales} sales</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    <p>{seller.products} active listings</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContact(seller.id);
                    }}
                    className="bg-[hsl(var(--primary))] hover:bg-opacity-90 text-white px-4 py-2 rounded-md transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                  >
                    Contact
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        :root {
          --dark: 220 10% 10%;
          --dark-lighter: 220 10% 15%;
          --dark-card: 220 10% 18%;
          --primary: 270 70% 60%;
          --secondary: 250 70% 50%;
          --success: 120 60% 40%;
        }

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </div>
  );
} 