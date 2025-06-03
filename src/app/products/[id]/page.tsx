"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/firebase/config";
import { doc, getDoc, addDoc, collection, query, where, getDocs, deleteDoc, setDoc, updateDoc } from "firebase/firestore";
import { Product } from "@/types/product";
import { ref, push, get } from "firebase/database";
import { rtdb } from "@/firebase/config";
import { getChannelLogo, extractChannelIdFromUrl } from "@/firebase/channelLogos";
import { getAuth, signOut } from "firebase/auth";

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

interface ProductPageProps {
  params: {
    id: string;
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const pathname = usePathname();
  const productId = pathname ? pathname.split('/').pop() || '' : '';
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [youtubeDataLoaded, setYoutubeDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topContactLoading, setTopContactLoading] = useState(false);
  const [bottomContactLoading, setBottomContactLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        setYoutubeDataLoaded(false);

        const productDocRef = doc(db, "products", productId);
        const productDoc = await getDoc(productDocRef);

        if (productDoc.exists()) {
          const productData = productDoc.data();
          const productWithId = {
            id: productDoc.id,
            ...productData
          } as Product;
          
          // დამატებით, მოვიძიოთ გამყიდველის ინფორმაცია
          if (productData.userId) {
            try {
              const sellerDocRef = doc(db, "users", productData.userId);
              const sellerDoc = await getDoc(sellerDocRef);
              if (sellerDoc.exists()) {
                const sellerData = sellerDoc.data();
                setSellerInfo({
                  photoURL: sellerData.photoURL || '/images/default-avatar.png',
                  displayName: sellerData.name || sellerData.displayName || 'Seller',
                  rating: sellerData.rating || 0,
                  positiveRatings: sellerData.positiveRatings || 0,
                  negativeRatings: sellerData.negativeRatings || 0
                });
                
                // გამყიდველის შეფასებების წამოღება
                const sellerReviewsQuery = query(
                  collection(db, 'reviews'),
                  where('sellerId', '==', productData.userId)
                );
                const reviewsSnapshot = await getDocs(sellerReviewsQuery);
                const reviewsData = reviewsSnapshot.docs.map(doc => {
                  const data = doc.data();
                  
                  return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate() || new Date()
                  };
                }) as Review[];
                
                // დავლოგოთ შეფასებების მონაცემები დებაგისთვის
                console.log('Seller reviews from Firebase:', reviewsData);
                
                // პოზიტიური და ნეგატიური შეფასებების განსაზღვრა
                const processedReviews = reviewsData.map(review => {
                  // თუ sentiment უკვე განსაზღვრულია, დავტოვოთ როგორც არის
                  if (review.sentiment) {
                    return review;
                  }
                  
                  // თუ არ არის განსაზღვრული, შევეცადოთ დავადგინოთ rating-ის მიხედვით ან სხვა მეთოდით
                  if (review.rating && typeof review.rating === 'number') {
                    // რეიტინგი 3-ზე მეტი ან ტოლი - პოზიტიური, ნაკლები - ნეგატიური
                    review.sentiment = review.rating >= 3 ? 'positive' : 'negative';
                  }
                  
                  return review;
                });
                
                // დავალაგოთ შეფასებები თარიღის მიხედვით, უახლესი პირველი
                processedReviews.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                
                setSellerReviews(processedReviews);
              }
            } catch (sellerErr) {
              console.error("Error fetching seller info:", sellerErr);
            }
          }
          
          // თუ ეს YouTube არხია და არსებობს არხის ID, შევამოწმოთ channelLogos კოლექციაში
          if (productData.platform === "YouTube") {
            // თუ არხის ID უკვე არის პროდუქტის მონაცემებში
            if (productData.channelId) {
              try {
                // First check if we have a direct URL
                if (productData.channelLogo && !productData.channelLogo.startsWith('channelLogos/')) {
                  productWithId.channelLogo = productData.channelLogo;
                } else {
                  // Try to get from channelLogos collection
                const logoData = await getChannelLogo(productData.channelId);
                if (logoData && logoData.logoUrl) {
                  productWithId.channelLogo = logoData.logoUrl;
                  
                    // Update in database if needed
                  if (productData.channelLogo !== logoData.logoUrl) {
                    await updateDoc(productDocRef, {
                      channelLogo: logoData.logoUrl
                    });
                    }
                  } else if (productData.channelLogo && productData.channelLogo.startsWith('channelLogos/')) {
                    // If we have a storage path but no Firestore entry, try to get from storage
                    try {
                      const response = await fetch(`/api/channel-logo?path=${encodeURIComponent(productData.channelLogo)}`);
                      if (response.ok) {
                        const data = await response.json();
                        if (data.url) {
                          productWithId.channelLogo = data.url;
                          // Update in database
                          await updateDoc(productDocRef, {
                            channelLogo: data.url
                          });
                        }
                      }
                    } catch (storageErr) {
                      console.error("Error fetching logo from storage:", storageErr);
                    }
                  }
                }
              } catch (logoErr) {
                console.error("Error fetching channel logo:", logoErr);
              }
            } 
            // თუ არხის ID არაა პროდუქტში, მაგრამ არის ლინკი
            else if (productData.accountLink) {
              const channelId = extractChannelIdFromUrl(productData.accountLink);
              if (channelId) {
                try {
                  // First check if we have a direct URL
                  if (productData.channelLogo && !productData.channelLogo.startsWith('channelLogos/')) {
                    productWithId.channelLogo = productData.channelLogo;
                  } else {
                    // Try to get from channelLogos collection
                  const logoData = await getChannelLogo(channelId);
                  if (logoData && logoData.logoUrl) {
                    productWithId.channelLogo = logoData.logoUrl;
                    
                      // Update in database
                    await updateDoc(productDocRef, {
                      channelLogo: logoData.logoUrl,
                        channelId: channelId
                      });
                    } else if (productData.channelLogo && productData.channelLogo.startsWith('channelLogos/')) {
                      // If we have a storage path but no Firestore entry, try to get from storage
                      try {
                        const response = await fetch(`/api/channel-logo?path=${encodeURIComponent(productData.channelLogo)}`);
                        if (response.ok) {
                          const data = await response.json();
                          if (data.url) {
                            productWithId.channelLogo = data.url;
                            // Update in database
                            await updateDoc(productDocRef, {
                              channelLogo: data.url,
                      channelId: channelId
                    });
                          }
                        }
                      } catch (storageErr) {
                        console.error("Error fetching logo from storage:", storageErr);
                      }
                    }
                  }
                } catch (logoErr) {
                  console.error("Error fetching channel logo:", logoErr);
                }
              }
            }
          }
          
          setProduct(productWithId);
          
          // Check if essential YouTube data is loaded
          const hasLogo = !!productWithId.channelLogo || (productWithId.imageUrls && productWithId.imageUrls.length > 0);
          const hasSubscribers = productWithId.subscribers !== undefined;
          const hasName = !!productWithId.displayName;
          
          setYoutubeDataLoaded(!!(hasLogo && hasSubscribers && hasName));
        } else {
          setError("Product not found");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product details");
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  useEffect(() => {
    const checkIfFavorite = async () => {
      if (!user || !productId) return;
      setFavoriteLoading(true);
      try {
        const favoriteDocRef = doc(db, "users", user.id, "favorites", productId);
        const favoriteDoc = await getDoc(favoriteDocRef);
        setIsFavorite(favoriteDoc.exists());
      } catch (err) {
        console.error("Error checking favorite status:", err);
        // Optionally set an error state here
      } finally {
        setFavoriteLoading(false);
      }
    };

    checkIfFavorite();
  }, [user, productId]);

  const handleToggleFavorite = async () => {
    if (!user) {
      // alert("Please log in to manage your favorites.");
      router.push('/login');
      return;
    }
    if (!product) return;

    setFavoriteLoading(true);
    const favoriteDocRef = doc(db, "users", user.id, "favorites", product.id);

    try {
      if (isFavorite) {
        await deleteDoc(favoriteDocRef);
        setIsFavorite(false);
        // alert("Removed from favorites!");
      } else {
        await setDoc(favoriteDocRef, { 
          productId: product.id, 
          addedAt: Date.now(),
          // Storing some basic product info for easier display on favorites page
          productName: product.displayName,
          productPrice: product.price,
          productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : ""
        });
        setIsFavorite(true);
        // alert("Added to favorites!");
      }
    } catch (err) {
      console.error("Error updating favorite status:", err);
      // alert("Failed to update favorites. Please try again.");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleContactSeller = async (buttonPosition: 'top' | 'bottom' = 'top') => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!product) return;

    // Don't allow contacting yourself
    if (user.id === product.userId) {
      return;
    }

    try {
      // Check if there's an existing chat
      const existingChatQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.id),
        where("productId", "==", product.id)
      );

      const existingChatSnapshot = await getDocs(existingChatQuery);
      let chatId;
      
      if (!existingChatSnapshot.empty) {
        const existingChat = existingChatSnapshot.docs[0];
        chatId = existingChat.id;
        console.log("Found existing chat:", chatId);
      } else {
        console.log("Creating new chat...");
            
        // Generate transaction ID
            const transactionId = Math.floor(1000000 + Math.random() * 9000000);
        
        // Create chat data
        const chatData = {
          productId: product.id,
          productName: product.displayName,
          productImage: product.channelLogo || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : ""),
          participants: [user.id, product.userId],
          participantNames: {
            [user.id]: user.name || user.email?.split('@')[0] || "User",
            [product.userId]: product.userEmail?.split('@')[0] || "Seller"
          },
          participantPhotos: {
            [user.id]: user.photoURL || "",
            [product.userId]: "" // Assuming no photo available
          },
          productPrice: product.price,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'pending',
          transactionId: transactionId,
          sellerId: product.userId,
          buyerId: user.id,
          paymentStatus: 'pending'
        };

        // Create the chat document
        const chatRef = await addDoc(collection(db, "chats"), chatData);
          chatId = chatRef.id;
        console.log("New chat created with ID:", chatId);
          
        // Create the initial transaction message
        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const purchaseMessage = {
          text: `🔒 Request to Purchase ${product.displayName}
Transaction ID: ${transactionId}
Transaction Amount: $${product.price}
Payment Method: Stripe
The buyer pays the cost of the channel + 8% ($3 minimum) service fee.

The seller confirms and agrees to use the escrow service.

The escrow agent verifies everything and assigns manager rights to the buyer.

After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.

The funds are then released to the seller. Payments are sent instantly via all major payment methods.`,
          senderId: user.id,
          senderName: user.name || user.email?.split('@')[0] || "User",
          senderPhotoURL: user.photoURL || null,
            timestamp: Date.now(),
          isRequest: true,
          isEscrowRequest: true,
          transactionData: {
              productId: product.id,
            productName: product.displayName,
            price: product.price,
            useEscrow: true,
            paymentMethod: 'stripe',
            transactionId: transactionId
          }
        };

        // Add the message to RTDB
        await push(messagesRef, purchaseMessage);

        // Update chat with last message
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: {
            text: `🔒 Request to Purchase ${product.displayName}`,
              timestamp: Date.now(),
            senderId: user.id
          }
        });

        // Update buyer's chat list
        const buyerChatListRef = doc(db, "users", user.id, "chatList", chatId);
        await setDoc(buyerChatListRef, {
              chatId: chatId,
              productId: product.id,
              productName: product.displayName,
          productImage: product.channelLogo || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : ""),
          otherUserId: product.userId,
              otherUserName: product.userEmail?.split('@')[0] || "Seller",
          lastMessage: `🔒 Request to Purchase ${product.displayName}`,
              lastMessageTimestamp: Date.now(),
              unreadCount: 0,
              updatedAt: Date.now()
        });

        // Update seller's chat list
        const sellerChatListRef = doc(db, "users", product.userId, "chatList", chatId);
        await setDoc(sellerChatListRef, {
              chatId: chatId,
              productId: product.id,
              productName: product.displayName,
          productImage: product.channelLogo || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : ""),
          otherUserId: user.id,
              otherUserName: user.name || user.email?.split('@')[0] || "User",
          lastMessage: `🔒 Request to Purchase ${product.displayName}`,
              lastMessageTimestamp: Date.now(),
              unreadCount: 1,
            updatedAt: Date.now()
          });
      }
      
      // Store the chat ID in localStorage
      localStorage.setItem('lastChatId', chatId);
      
      // Redirect to the chat
      router.push(`/my-chats?chatId=${chatId}`);
    } catch (err) {
      console.error("Error in contact seller function:", err);
      if (err instanceof Error) {
        console.error("Error details:", err.message, err.stack);
      }
      alert("Failed to create chat. Please try again later.");
    }
  };
  
  const handleDeleteListing = async () => {
    if (!user || !product) return;
    
    if (user.id !== product.userId && !user.isAdmin) {
      // მხოლოდ მფლობელს ან ადმინს შეუძლია წაშლა
      alert("მხოლოდ პროდუქტის მფლობელს ან ადმინისტრატორს შეუძლია წაშლა");
      return;
    }
    
    const confirmDelete = window.confirm("ნამდვილად გსურთ ამ პროდუქტის წაშლა?");
    if (!confirmDelete) return;
    
    try {
      setDeleteLoading(true);
      
      // 1. ჯერ ვშლით პროდუქტს Firestore-დან
      await deleteDoc(doc(db, "products", product.id));
      
      // 2. ვშლით ყველა ფავორიტს, რომელიც ამ პროდუქტზე მიუთითებს
      const favoritesQuery = query(
        collection(db, "favorites"),
        where("productId", "==", product.id)
      );
      
      const favoritesSnapshot = await getDocs(favoritesQuery);
      const deletePromises: Promise<any>[] = [];
      
      favoritesSnapshot.forEach(doc => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      // 3. ვშლით ყველა მომხმარებლის ფავორიტებიდან
      const userFavoritesQuery = query(
        collection(db, "users")
      );
      
      const usersSnapshot = await getDocs(userFavoritesQuery);
      usersSnapshot.forEach(userDoc => {
        const userFavoriteRef = doc(db, "users", userDoc.id, "favorites", product.id);
        deletePromises.push(getDoc(userFavoriteRef).then(favoriteDoc => {
          if (favoriteDoc.exists()) {
            return deleteDoc(userFavoriteRef);
          }
          return Promise.resolve();
        }));
      });
      
      await Promise.all(deletePromises);
      
      // alert("ჩანაწერი წაიშალა წარმატებით");
      router.push("/");
    } catch (err) {
      console.error("Error deleting listing:", err);
      alert("პროდუქტის წაშლის დროს მოხდა შეცდომა. გთხოვთ სცადოთ თავიდან.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ტოგლ მენიუს ფუნქცია
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold mb-4">{error}</h2>
          <p className="mb-4">We couldn't find the product you're looking for.</p>
          <Link href="/products" className="inline-block px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

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
              <>
                <Link href="/products/new" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Sell Channel
                </Link>
                <Link href="/my-chats" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Messages
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-gray-300 hover:text-orange-500 transition-colors">
                Sell Channel
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {user ? (
          <div className="relative">
            <button 
              onClick={toggleMenu}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-[hsl(var(--dark-card))] text-white border-2 border-[hsl(var(--primary))] hover:bg-[hsl(var(--dark-lighter))] transition-colors"
            >
                  {user.photoURL ? (
                <Image src={user.photoURL} alt={user.name || user.email || 'User'} width={40} height={40} className="h-full w-full rounded-full object-cover" />
              ) : (
                    <span className="font-bold text-lg">{user.email?.charAt(0).toUpperCase() || user.name?.charAt(0).toUpperCase() || "U"}</span>
              )}
            </button>
            
            {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[hsl(var(--dark-card))] rounded-lg shadow-xl overflow-hidden border border-gray-700 transition-all duration-200 transform origin-top-right z-10">
                {user && (
                      <div className="bg-[hsl(var(--primary))] px-4 py-3 text-white">
                    <p className="font-medium truncate">{user.email || user.name}</p>
                  </div>
                )}
                <div className="p-2">
                      <Link href="/transactions" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-lighter))] rounded">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-green-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                      </svg>
                      My Transactions
                    </div>
                  </Link>
                  {user && (
                    <>
                          <Link href="/profile" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-lighter))] rounded">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-blue-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          My profile
                        </div>
                      </Link>
                          <Link href="/my-favorites" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-lighter))] rounded">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-pink-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                          My Favorites
                        </div>
                      </Link>
                      {user.isAdmin && (
                            <Link href="/admin" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-lighter))] rounded">
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-indigo-500">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.781-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Administrator
                          </div>
                        </Link>
                      )}
                          <hr className="my-2 border-gray-700" />
                      <button
                        onClick={() => {
                          const auth = getAuth();
                          signOut(auth).then(() => {
                            router.push('/');
                            document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                            localStorage.removeItem('lastChatId');
                          }).catch((error) => {
                            console.error("Logout error:", error);
                          });
                        }}
                            className="w-full mt-2 block px-4 py-2 text-left text-red-400 hover:bg-[hsl(var(--dark-lighter))] rounded"
                      >
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-red-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                          </svg>
                          Logout
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
            ) : (
              <Link href="/login" className="bg-[hsl(var(--primary))] hover:bg-opacity-90 text-white px-4 py-2 rounded-md">
                Sign In
              </Link>
            )}
        </div>
      </div>
      </header>

      <div className="w-full px-0 py-0 pb-20">
        <div className="w-full min-h-screen flex flex-col px-0">
          <div className="w-full px-0 py-4 flex-grow">
            <div className="flex justify-between items-center mb-3 text-xs text-gray-400 px-4">
              <div className="flex items-center space-x-2">
                <span>Listed: {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'Recently'}</span>
                <span>|</span>
                <span>Updated: {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'Recently'}</span>
                <span>|</span>
              </div>
              
              {user && user.id === product.userId && (
                <button 
                  onClick={handleDeleteListing}
                  disabled={deleteLoading}
                  className="text-gray-400 hover:text-red-500 flex items-center text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  This channel is mine, delete listing!
                </button>
              )}
            </div>
            
            <div className="w-full px-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-5 w-full">
                <div className="lg:w-1/3 lg:pl-8">
                  <div className="rounded-full overflow-hidden w-48 h-48 mx-auto mb-6 border-4 border-[hsl(var(--dark-card))]">
                    {product.channelLogo ? (
                      <Image 
                        src={product.channelLogo} 
                        alt={`${product.displayName} logo`}
                        width={192}
                        height={192}
                        className="w-full h-full object-cover"
                      />
                    ) : product.imageUrls && product.imageUrls.length > 0 ? (
                      <Image 
                        src={product.imageUrls[0]} 
                        alt={product.displayName}
                        width={192}
                        height={192}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[hsl(var(--dark-card))] flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={() => handleContactSeller('top')}
                      disabled={topContactLoading || !product || !youtubeDataLoaded}
                      className={`flex-1 py-1.5 px-2 ${youtubeDataLoaded ? 'bg-[hsl(var(--primary))] hover:bg-opacity-90' : 'bg-gray-600 cursor-not-allowed'} text-white font-medium rounded-full text-sm transition-colors`}
                    >
                      {topContactLoading ? 'Processing...' : !youtubeDataLoaded ? 'Loading data...' : 'Purchase Channel'}
                    </button>
                    <button 
                      onClick={handleToggleFavorite}
                      disabled={favoriteLoading || !product || !youtubeDataLoaded}
                      className={`flex-1 py-1.5 px-2 border font-medium rounded-full text-sm transition-colors ${
                        !youtubeDataLoaded 
                          ? 'border-gray-600 bg-[hsl(var(--dark-card))] text-gray-500 cursor-not-allowed'
                          : isFavorite 
                          ? 'bg-pink-500 text-white border-pink-500 hover:bg-pink-600' 
                          : 'border-gray-600 text-gray-300 hover:bg-[hsl(var(--dark-lighter))]'
                      }`}
                    >
                      {favoriteLoading ? '...' : isFavorite ? 'Favorited' : 'Add to Favorites'}
                    </button>
                  </div>
                </div>
                
                <div className="lg:w-2/5 lg:pl-12">
                  <div className="flex flex-col xl:flex-row xl:justify-between">
                    <div className="mb-4 xl:mb-0">
                      <h1 className="text-3xl font-bold text-white mb-1">{product.displayName}</h1>
                      <div className="text-gray-400 mb-4 text-base">
                        {product.category} / <a href={product.accountLink} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline">{product.accountLink}</a>
                      </div>
                      
                      <div className="border-l-4 border-[hsl(var(--primary))] pl-4 space-y-1 mb-6">
                        <div className="text-gray-300 text-base">{product.subscribers?.toLocaleString() || 0} — subscribers</div>
                        <div className="text-gray-300 text-base">${product.monthlyIncome || 0} — income (month)</div>
                        <div className="text-gray-300 text-base">${product.monthlyExpenses || 0} — expense (month)</div>
                      </div>
                      
                      <div className="text-4xl font-bold text-white mb-4">$ {product.price}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center space-x-2">
                    {(product as any).isVerified && (
                      <div className="bg-[hsl(var(--dark-card))] text-gray-300 px-2 py-0.5 rounded-full font-medium flex items-center text-xs">
                        <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                        </svg>
                        PASS
                      </div>
                    )}
                    {(product as any).isVIP && (
                      <div className="bg-[hsl(var(--dark-card))] text-white px-2 py-0.5 rounded-full font-medium text-xs">VIP</div>
                    )}
                    {(product as any).discount && (
                      <div className="bg-[hsl(var(--dark-card))] text-white px-2 py-0.5 rounded-full font-medium text-xs">-{(product as any).discount}%</div>
                    )}
                  </div>
                </div>

                <div className="lg:w-1/4 flex flex-col items-end justify-end mr-4">
                  <div 
                    className="p-3 border border-gray-700 rounded-2xl rounded-br-none shadow-sm max-w-sm w-full cursor-pointer bg-[hsl(var(--dark-card))]"
                    onClick={() => product?.userId && router.push(`/profile/${product.userId}`)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full overflow-hidden mr-3 flex-shrink-0">
                          <Image 
                            src={sellerInfo?.photoURL || '/images/default-avatar.png'} 
                            alt="Seller avatar"
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="w-full">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              product?.userId && router.push(`/profile/${product.userId}`);
                            }}
                            className="font-medium text-md cursor-pointer hover:text-[hsl(var(--primary))] text-white"
                          >
                            {sellerInfo?.displayName || 'Seller'}
                          </div>
                                                      <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              Rating
                            </span>
                            <div className="flex">
                              <span className="text-green-500 font-medium mr-2 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {sellerReviews.filter(review => review.sentiment === 'positive').length}
                              </span>
                              <span className="text-red-500 font-medium flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {sellerReviews.filter(review => review.sentiment === 'negative').length}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex w-full">
                    <button 
                      onClick={() => handleContactSeller('bottom')}
                      disabled={bottomContactLoading || !product || !youtubeDataLoaded}
                      className="w-1/2 ml-auto py-1.5 px-3 bg-[hsl(var(--primary))] hover:bg-opacity-90 text-white font-medium rounded-b-xl text-sm transition-colors"
                    >
                      {bottomContactLoading ? 'Processing...' : 'Contact'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full mt-6 flex flex-col relative px-4">
              <div className="w-full pr-40">
                <h2 className="text-xl font-bold text-white mb-3">Description:</h2>
                <div className="text-gray-300">
                  {product.description && (
                    <>
                      {!product.description.includes("Monetization:") ? (
                        <p className="whitespace-pre-wrap">{product.description}</p>
                      ) : (
                        <>
                          {product.description.split("Monetization:")[0]?.trim() && (
                            <p className="mb-3 whitespace-pre-wrap">{product.description.split("Monetization:")[0]?.trim()}</p>
                          )}
                          
                          <p className="mb-1.5"><strong>Monetization:</strong> <span className="whitespace-pre-wrap">{product.description.split("Monetization:")[1]?.split("Ways of promotion:")[0]?.trim() || "N/A"}</span></p>
                          
                          {product.description.includes("Ways of promotion:") && (
                            <p className="mb-1.5"><strong>Ways of promotion:</strong> <span className="whitespace-pre-wrap">{product.description.split("Ways of promotion:")[1]?.split("Sources of expense:")[0]?.trim() || "N/A"}</span></p>
                          )}
                          
                          {product.description.includes("Sources of expense:") && (
                            <p className="mb-1.5"><strong>Sources of expense:</strong> <span className="whitespace-pre-wrap">{product.description.split("Sources of expense:")[1]?.split("Sources of income:")[0]?.trim() || "N/A"}</span></p>
                          )}
                          
                          {product.description.includes("Sources of income:") && (
                            <p className="mb-1.5"><strong>Sources of income:</strong> <span className="whitespace-pre-wrap">{product.description.split("Sources of income:")[1]?.split("To support the channel, you need:")[0]?.trim() || "N/A"}</span></p>
                          )}
                          
                          {product.description.includes("To support the channel, you need:") && (
                            <p className="mb-1.5"><strong>To support the channel, you need:</strong> <span className="whitespace-pre-wrap">{product.description.split("To support the channel, you need:")[1]?.split("Content:")[0]?.trim() || "N/A"}</span></p>
                          )}
                          
                          {product.description.includes("Content:") && (
                            <p className="mb-1.5"><strong>Content:</strong> <span className="whitespace-pre-wrap">{product.description.split("Content:")[1]?.split("$").pop()?.trim() || "N/A"}</span></p>
                          )}
                          
                          {product.description.includes("income (month)") && !product.monthlyIncome && (
                            <p><strong>Income (month):</strong> ${product.description.split("income (month)")[0]?.split("$").pop()?.trim() || "N/A"}</p>
                          )}
                          
                          {product.description.includes("expense (month)") && !product.monthlyExpenses && (
                            <p><strong>Expense (month):</strong> ${product.description.split("expense (month)")[0]?.split("$").pop()?.trim() || "N/A"}</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                  
                  {(product as any).additionalDetails && (
                    <div className="mt-3">
                      {Object.entries((product as any).additionalDetails).map(([key, value]) => (
                        <p key={key}><strong>{key}:</strong> {String(value)}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-1/3 max-w-xs mt-8 absolute right-4 top-0">
                <h2 className="text-xl font-bold text-white mb-3">Attached images:</h2>
                {product.imageUrls && product.imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {product.imageUrls.map((url, index) => (
                      <div 
                        key={index} 
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-700 bg-[hsl(var(--dark-card))] cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedImage(url)}
                      >
                        <Image
                          src={url}
                          alt={`Product image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No images attached</p>
                )}
              </div>
            </div>
              </div>
            </div>
          </div>

      {/* Image Popup Modal */}
          {selectedImage && (
            <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-lg transition-all duration-300 ease-in-out animate-fadeIn"
              onClick={() => setSelectedImage(null)}
            >
          <div className="relative max-w-[90vw] max-h-[90vh] animate-scaleIn">
                <button 
              className="absolute -top-12 right-0 w-10 h-10 bg-[hsl(var(--dark-card))] rounded-full flex items-center justify-center text-white hover:bg-[hsl(var(--dark-lighter))] transition-colors z-10"
                  onClick={() => setSelectedImage(null)}
              title="Close image"
                >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
            <div className="relative w-full h-full">
                <Image
                  src={selectedImage}
                  alt="Enlarged product image"
                  width={1200}
                  height={900}
                className="max-h-[90vh] w-auto h-auto object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
                />
            </div>
              </div>
            </div>
          )}
          
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}