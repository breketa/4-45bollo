'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// ახალი იმპორტები
import Footer from '@/components/layout/Footer';
import UserMenu from '@/components/auth/UserMenu';
import { useAuth } from '@/components/auth/AuthProvider';

interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  productId: string;
  productName?: string;
  rating: number;
  comment: string;
  timestamp: Date;
  reviewerPhotoURL?: string;
  youtube?: string;
  channelName?: string;
  price?: string | number;
  sellerId?: string;
  sellerName?: string;
  sentiment?: 'positive' | 'negative';
  paymentAmount?: string | number;
  buyerId?: string;
  buyerName?: string;
  reviewerRole?: 'buyer' | 'seller';
  transactionComplete?: boolean;
  transactionDate?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  platform: string;
  imageUrl: string;
  imageUrls?: string[];
  userId: string;
  status: string;
  subscriberCount?: number;
  subscribers?: number;
  income?: number;
  monetization?: boolean;
  category?: string;
  youtube?: string;
  channelName?: string;
  displayName?: string;
}

interface User {
  id: string;
  name: string;
  email?: string; // არ ვაჩვენებთ საჯაროდ
  photoURL: string;
  rating: number;
  ratingCount: number;
  registeredDate: Date;
  lastOnline: Date;
  points: number;
  score: number;
  isAdmin: boolean;
}

export default function PublicProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  
  // მოვიპოვოთ მომხმარებლის ID URL-დან
  const pathname = usePathname();
  const userId = pathname ? pathname.split('/').pop() || '' : '';

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError("User ID not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // მომხმარებლის მონაცემების წამოღება
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          // დებაგისთვის შევინახოთ მთლიანი userData ობიექტი
          console.log('User data from Firebase:', userData);
          
          setUser({
            id: userId,
            name: userData.name || userData.displayName || 'User',
            photoURL: userData.photoURL || '/images/default-avatar.png',
            rating: userData.rating || 0,
            ratingCount: userData.ratingCount || 0,
            registeredDate: userData.createdAt?.toDate() || new Date(),
            lastOnline: userData.lastLogin?.toDate() || userData.lastOnline?.toDate() || new Date(),
            points: Number(userData.points) || 0,
            score: Number(userData.score) || 0,
            isAdmin: Boolean(userData.isAdmin) || Boolean(userData.roles?.admin) || false,
          });
          
          // პროდუქტების წამოღება
          const productsQuery = query(
            collection(db, 'products'),
            where('userId', '==', userId)
          );
          const productsSnapshot = await getDocs(productsQuery);
          const productsData = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          
          // დამატებითი ლოგირება პროდუქტის სურათების გასარკვევად
          console.log('Loaded products:', productsData);
          
          setProducts(productsData);
          
          // შევქმნათ პროდუქტების მეპი გასაადვილებლად
          const productsMap: Record<string, Product> = {};
          productsData.forEach(product => {
            productsMap[product.id] = product;
          });
          setProductMap(productsMap);
          
          // შეფასებების წამოღება
          const reviewsQuery = query(
            collection(db, 'reviews'),
            where('sellerId', '==', userId)
          );
          const reviewsSnapshot = await getDocs(reviewsQuery);
          const reviewsData = reviewsSnapshot.docs.map(doc => {
            const data = doc.data();
            // თუ არ გვაქვს productName, შევეცადოთ მისი მიღება productMap-იდან
            if (data.productId && !data.productName && productsMap[data.productId]) {
              data.productName = productsMap[data.productId].name;
            }
            // თუ არ გვაქვს channelName, შევეცადოთ მისი მიღება productMap-იდან
            if (data.productId && !data.channelName && productsMap[data.productId] && productsMap[data.productId].channelName) {
              data.channelName = productsMap[data.productId].channelName;
            }
            
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            };
          }) as Review[];
          
          // დავალაგოთ შეფასებები თარიღის მიხედვით, უახლესი პირველი
          reviewsData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          
          setReviews(reviewsData);
        } else {
          setError("User not found");
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        setError("Error loading profile data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [userId]);

  // თარიღის ფორმატირება
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // რეიტინგის გენერირება
  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg 
            key={star}
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill={star <= rating ? "currentColor" : "none"}
            stroke={star <= rating ? "currentColor" : "currentColor"}
            className={`w-5 h-5 ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        ))}
        <span className="ml-2 text-gray-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  // პლატფორმის ტიპის განსაზღვრა
  const getPlatformLabel = (review: Review, productMap: Record<string, Product>) => {
    if (review.youtube) return 'YouTube';
    
    if (review.channelName) {
      const channelNameLower = review.channelName.toLowerCase();
      if (channelNameLower.includes('youtube') || channelNameLower.includes('yt')) return 'YouTube';
      if (channelNameLower.includes('facebook') || channelNameLower.includes('fb')) return 'Facebook';
      if (channelNameLower.includes('instagram') || channelNameLower.includes('insta')) return 'Instagram';
      if (channelNameLower.includes('tiktok')) return 'TikTok';
      if (channelNameLower.includes('twitter') || channelNameLower.includes('x.com')) return 'Twitter';
    }
    
    if (review.productId && productMap[review.productId]) {
      const product = productMap[review.productId];
      
      if (product.platform) {
        const platform = product.platform.toLowerCase();
        if (platform.includes('youtube')) return 'YouTube';
        if (platform.includes('twitter') || platform.includes('x')) return 'Twitter';
        if (platform.includes('facebook') || platform.includes('fb')) return 'Facebook';
        if (platform.includes('tiktok')) return 'TikTok';
        if (platform.includes('instagram') || platform.includes('insta')) return 'Instagram';
        return capitalizeFirstLetter(product.platform);
      }
      
      if (product.youtube) return 'YouTube';
      
      if (product.category) {
        const category = product.category.toLowerCase();
        if (category.includes('youtube')) return 'YouTube';
        if (category.includes('twitter') || category.includes('x')) return 'Twitter';
        if (category.includes('facebook') || category.includes('fb')) return 'Facebook';
        if (category.includes('tiktok')) return 'TikTok';
        if (category.includes('instagram') || category.includes('insta')) return 'Instagram';
      }
    }
    
    return 'YouTube';
  };

  // დამხმარე ფუნქცია სტრინგის პირველი ასოს დასაკაპიტალიზებლად
  const capitalizeFirstLetter = (string: string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // პლატფორმის ფერის კლასი
  const getPlatformColor = (platform: string) => {
    switch(platform) {
      case 'YouTube':
        return 'bg-red-100 text-red-800';
      case 'Twitter':
        return 'bg-blue-100 text-blue-800';
      case 'Facebook':
        return 'bg-indigo-100 text-indigo-800';
      case 'TikTok':
        return 'bg-gray-100 text-gray-800';
      case 'Instagram':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  // რიცხვის ფორმატირება (1000 -> 1k)
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toString();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full">
        <div className="w-full">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full">
        <div className="w-full">
          <div className="p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-700">{error}</p>
            <div className="mt-6">
              <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
                &larr; Back to Homepage
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      {/* ახალი ჰედერი */}
      <header className="relative shadow-md">
        <div className="absolute inset-0 z-0 bg-[#212121]"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* მარცხენა მხარე - ლოგო */}
            <Link href="/" className="flex items-center">
              <span className="text-white font-bold text-2xl">
                <span className="text-white">SWAPD</span>
                <span className="text-[#9952E0]">MARKET</span>
              </span>
              <span className="ml-2 px-2 py-0.5 bg-white/10 rounded text-xs text-white">BETA</span>
            </Link>

            {/* შუა ნაწილი - ძებნა */}
            <div className="hidden md:flex items-center flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search channels..."
                  className="w-full px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* მარჯვენა მხარე - ნავიგაცია */}
            <div className="flex items-center space-x-6">
              <Link href="/explore" className="text-white hover:text-orange-400 transition-colors">
                Explore
              </Link>
              <Link href="/how-it-works" className="text-white hover:text-orange-400 transition-colors">
                How It Works
              </Link>
              <Link href="/sellers" className="text-white hover:text-orange-400 transition-colors">
                Sellers
              </Link>
              <Link href="/sell" className="text-white hover:text-orange-400 transition-colors">
                Sell Channel
              </Link>
              <Link href="/messages" className="text-white hover:text-orange-400 transition-colors">
                Messages
              </Link>
              <div className="relative">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full pb-16 bg-[#212121]">
        {user && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* პროფილის ზედა ნაწილი */}
            <div className="bg-[#1f1f1f] rounded-xl shadow-sm p-6 mb-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden mr-6 border-4 border-white shadow-md">
                    <Image 
                      src={user.photoURL} 
                      alt={user.name} 
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                      {user.isAdmin && (
                        <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          ადმინი
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">Last online: {formatDate(user.lastOnline)}</p>
                  </div>
                </div>

                {/* რეიტინგის ბლოკი */}
                <div className="bg-gradient-to-r from-[#9952E0] to-[#4A90E2] px-8 py-3 rounded-lg text-white shadow-md">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="font-bold text-3xl">{user.rating || 0}</span>
                      <p className="font-medium">Rating</p>
                    </div>
                    <div className="h-12 w-px bg-white/20"></div>
                    <div className="text-center">
                      <span className="font-bold text-3xl">{user.ratingCount || 0}</span>
                      <p className="font-medium">Reviews</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* არხების სექცია */}
              <div className="md:w-2/3">
                <div className="bg-[#1f1f1f] rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Channels ({products.length})
                  </h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((product) => (
                      <div key={product.id} className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
                        <div className="flex flex-col items-center text-center">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden mb-3">
                            <Image
                              src={product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : product.imageUrl}
                              alt={product.displayName || product.channelName || product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">
                            {product.displayName || product.channelName || product.name}
                          </h3>
                          <div className="flex items-center text-xs text-gray-300 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {formatNumber(product.subscribers || product.subscriberCount || 0)}
                          </div>
                          <span className="text-indigo-400 font-bold">${product.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* შეფასებების სექცია */}
              <div className="md:w-1/3">
                <div className="bg-[#1f1f1f] rounded-xl shadow-sm p-6 sticky top-4">
                  <h2 className="text-xl font-bold text-white mb-6">
                    Reviews ({reviews.length})
                  </h2>
                  
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-700 pb-6 last:border-0 last:pb-0">
                        <div className="flex items-start gap-4">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={review.reviewerPhotoURL}
                              alt={review.reviewerName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-white">{review.reviewerName}</h3>
                              <span className="text-sm text-gray-300">{formatDate(review.timestamp)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {review.sentiment === 'positive' ? (
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : review.sentiment === 'negative' ? (
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              ) : null}
                              <p className="text-gray-300">{review.comment}</p>
                            </div>
                            <div className="mt-2 text-sm text-gray-300">
                              <span className="font-medium text-white">{review.channelName || review.productName}</span>
                              {review.price && (
                                <span className="ml-2 text-indigo-400 font-medium">${review.price}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {reviews.length === 0 && (
                      <div className="text-center py-8 text-gray-300">
                        No reviews yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <footer className="bg-gray-900 text-white py-3 px-4 fixed bottom-0 left-0 right-0 w-full z-10 text-sm">
        <div className="w-full flex flex-col md:flex-row justify-between items-center">
          <div className="mb-2 md:mb-0">
            <div className="text-xs">MateSwap LP</div>
            <div className="text-xs text-gray-400">Address: 85 First Floor Great Portland Street, London, England, W1W 7LT</div>
          </div>
          <div className="flex space-x-4">
            <Link href="/terms" className="text-xs hover:text-gray-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-xs hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
} 