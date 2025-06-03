"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, getDocs, orderBy, limit, where, doc, getDoc, addDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { Product } from "@/types/product";
import FilterBar, { FilterOptions } from "@/components/products/FilterBar";
import ProductCard from "@/components/products/ProductCard";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ref, push, get } from "firebase/database";
import { rtdb } from "@/firebase/config";
import { getAuth, signOut } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";

// შენახული პროდუქტების მდგომარეობა გლობალურ მასშტაბში
let cachedProducts: Product[] = [];
let cachedFilters: FilterOptions = {};
let hasInitialLoad = false;

// კატეგორიების სია FilterBar კომპონენტიდან
const categories = [
  "Entertainment",
  "Gaming",
  "Education",
  "Technology",
  "Business",
  "Lifestyle",
  "Travel",
  "Sports",
  "Food",
  "Fashion",
  "Other"
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>(cachedProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(cachedProducts);
  const [isLoading, setIsLoading] = useState(!hasInitialLoad);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 48; // 4x12 grid

  // Check if Firebase is properly initialized
  useEffect(() => {
    if (!db || Object.keys(db).length === 0) {
      setError("Firebase is not properly initialized. Please check your configuration.");
      setIsLoading(false);
      return;
    }
  }, []);

  // Listen for unread messages
  useEffect(() => {
    if (!user || !db || Object.keys(db).length === 0) return;

    const fetchUnreadCount = async () => {
      try {
        // Get all chats where the user is a participant
        const chatsQuery = query(
          collection(db, "users", user.id, "chatList")
        );

        const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
          let totalUnread = 0;
          snapshot.forEach((doc) => {
            const chatData = doc.data();
            totalUnread += chatData.unreadCount || 0;
          });
          setUnreadCount(totalUnread);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();
  }, [user]);

  // აღარ ვანახლებთ scroll position-ს რეფრეშის შემდეგ
  useEffect(() => {
    // მხოლოდ ერთხელ აღვადგენთ მონაცემებს localStorage-დან
    if (typeof window !== 'undefined' && !hasInitialLoad) {
      // Restore filter state
      const savedFilters = localStorage.getItem('filters');
      if (savedFilters) {
        try {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters);
          cachedFilters = parsedFilters;
        } catch (e) {
          console.error('Error parsing saved filters', e);
        }
      }

      // Restore pagination state
      const savedPage = localStorage.getItem('currentPage');
      if (savedPage) {
        setCurrentPage(parseInt(savedPage, 10));
      }
      
      // ვაფიქსირებთ წინა სქროლის პოზიციას რეფრეშის შემდეგ
      const savedScrollPosition = localStorage.getItem('scrollPosition');
      if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
      }
    }
  }, []);

  // შევინახოთ scroll position windowStorage-ში რეფრეშის გარეშე
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // შევქმნათ იმის აღმომჩენი თუ როდის ტოვებს მომხმარებელი გვერდს
      const saveScrollPosition = () => {
        localStorage.setItem('scrollPosition', window.scrollY.toString());
      };

      // ვიყენებთ beforeunload event-ს რათა შევინახოთ სქროლის პოზიცია მაშინაც კი,
      // როდესაც მომხმარებელი ტოვებს გვერდს
      window.addEventListener('beforeunload', saveScrollPosition);
      
      // აგრეთვე პერიოდულად ვინახავთ სქროლის პოზიციას
      const scrollInterval = setInterval(saveScrollPosition, 1000);
      
      return () => {
        window.removeEventListener('beforeunload', saveScrollPosition);
        clearInterval(scrollInterval);
      };
    }
  }, []);

  // Save current page number in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentPage', currentPage.toString());
    }
  }, [currentPage]);

  // Save filters in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(filters).length > 0) {
      localStorage.setItem('filters', JSON.stringify(filters));
      cachedFilters = filters;
    }
  }, [filters]);

  // პროდუქტების ჩატვირთვა - მხოლოდ ერთხელ თუ ჯერ არ გვაქვს ჩატვირთული
  useEffect(() => {
    const fetchProducts = async () => {
      if (!db || Object.keys(db).length === 0) {
        setError("Firebase is not properly initialized. Please check your configuration.");
        setIsLoading(false);
        return;
      }

      // თუ უკვე გვაქვს ჩატვირთული პროდუქტები, აღარ ჩავტვირთავთ ხელახლა
      if (hasInitialLoad && cachedProducts.length > 0) {
        setIsLoading(false);
        setProducts(cachedProducts);
        applyFilters(cachedProducts, filters);
        return;
      }
      
      try {
        setError(null);
        setIsLoading(true);

        // Create the query with proper ordering and filtering
        const q = query(
          collection(db, "products"),
          orderBy("createdAt", "desc"),
          limit(1000)
        );

        // Execute the query
        const querySnapshot = await getDocs(q);
        const productsList = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            userEmail: data.userEmail || '',
            displayName: data.displayName || 'Untitled Channel',
            description: data.description || '',
            price: data.price || 0,
            subscribers: data.subscribers || 0,
            income: data.income || 0,
            monthlyIncome: data.monthlyIncome || 0,
            monthlyExpenses: data.monthlyExpenses || 0,
            incomeSource: data.incomeSource || '',
            expenseDetails: data.expenseDetails || '',
            platform: data.platform || 'Unknown',
            category: data.category || 'Other',
            monetization: data.monetization || false,
            verified: data.verified || false,
            createdAt: data.createdAt || Date.now(),
            channelLogo: data.channelLogo || null,
            channelId: data.channelId || null,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            accountLink: data.accountLink || '',
            allowComments: data.allowComments || false,
            status: data.status || 'active',
            views: data.views || 0,
            likes: data.likes || 0,
            comments: data.comments || [],
            tags: Array.isArray(data.tags) ? data.tags : [],
            location: data.location || '',
            language: data.language || 'en',
            engagementRate: data.engagementRate || 0,
            lastUpdated: data.lastUpdated || Date.now(),
            analytics: data.analytics || {},
            metrics: data.metrics || {},
            settings: data.settings || {},
            promotionStrategy: data.promotionStrategy || '',
            supportRequirements: data.supportRequirements || '',
            verificationCode: data.verificationCode || ''
          } as Product;
        });

        cachedProducts = productsList;
        hasInitialLoad = true;
        setProducts(productsList);
        applyFilters(productsList, filters);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Failed to load products. Please try again later.");
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // ფუნქცია სქროლის პოზიციის შესანახად
  const saveScrollPosition = () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    sessionStorage.setItem('currentPage', currentPage.toString());
  };

  // ცალკე ფუნქცია ფილტრაციისთვის
  const applyFilters = (productList: Product[], currentFilters: FilterOptions) => {
    let filtered = [...productList];

    // Filter by platform
    if (currentFilters.platform) {
      filtered = filtered.filter(product => 
        product.platform.toLowerCase() === currentFilters.platform?.toLowerCase()
      );
    }

    // Filter by category
    if (currentFilters.category) {
      filtered = filtered.filter(product => 
        product.category.toLowerCase() === currentFilters.category?.toLowerCase()
      );
    }

    // Filter by price range
    if (currentFilters.minPrice) {
      filtered = filtered.filter(product => product.price >= (currentFilters.minPrice || 0));
    }
    if (currentFilters.maxPrice) {
      filtered = filtered.filter(product => product.price <= (currentFilters.maxPrice || Infinity));
    }

    // Filter by subscribers
    if (currentFilters.minSubscribers) {
      filtered = filtered.filter(product => product.subscribers >= (currentFilters.minSubscribers || 0));
    }
    if (currentFilters.maxSubscribers) {
      filtered = filtered.filter(product => product.subscribers <= (currentFilters.maxSubscribers || Infinity));
    }

    // Filter by income
    if (currentFilters.minIncome) {
      filtered = filtered.filter(product => (product.income || 0) >= (currentFilters.minIncome || 0));
    }
    if (currentFilters.maxIncome) {
      filtered = filtered.filter(product => (product.income || 0) <= (currentFilters.maxIncome || Infinity));
    }

    // Filter by monetization
    if (currentFilters.monetization) {
      filtered = filtered.filter(product => product.monetization === true);
    }

    // Filter by search term
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      filtered = filtered.filter(product => 
        product.displayName?.toLowerCase().includes(searchLower) || 
        product.description?.toLowerCase().includes(searchLower) ||
        product.platform?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (currentFilters.sortBy) {
      switch (currentFilters.sortBy) {
        case 'createdAt':
          filtered.sort((a, b) => b.createdAt - a.createdAt);
          break;
        case 'price':
          filtered.sort((a, b) => b.price - a.price);
          break;
        case 'subscribers':
          filtered.sort((a, b) => b.subscribers - a.subscribers);
          break;
        case 'income':
          filtered.sort((a, b) => (b.monthlyIncome || 0) - (a.monthlyIncome || 0));
          break;
        case 'relevance':
        default:
          // Default sorting by creation date (newest first)
          filtered.sort((a, b) => b.createdAt - a.createdAt);
          break;
      }
    }

    setFilteredProducts(filtered);
  };

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    
    // Save the new page number
    localStorage.setItem('currentPage', pageNumber.toString());
    
    // Scroll to the top of the products grid or slightly higher
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
      const gridTop = productsGrid.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.max(0, gridTop - 80), // 80px above so navigation is visible
        behavior: 'smooth'
      });
    }
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    // When filters change, return to the first page
    setCurrentPage(1);
  };

  const handleContactSeller = async (productId: string, paymentMethod: string, useEscrow: boolean) => {
    if (!user) {
      // If user is not logged in, redirect to login page or show login modal
      // For simplicity, let's just alert for now
      alert("Authorization is required to contact the seller");
      router.push('/login');
      return;
    }

    try {
      console.log("Starting contact seller process...");
      console.log("Current user ID:", user.id);
      console.log("Product ID:", productId);

      // Get product details
      const productDocRef = doc(db, "products", productId);
      const productDoc = await getDoc(productDocRef);

      if (!productDoc.exists()) {
        alert("Product not found");
        return;
      }

      const product = {
        id: productDoc.id,
        ...productDoc.data()
      } as Product;

      console.log("Seller ID:", product.userId);

      // Don't allow contacting yourself
      if (user.id === product.userId) {
        alert("You cannot contact the seller for your own product");
        return;
      }

      // Check if a chat already exists
      const chatsQuery = query(
        collection(db, "chats"),
        where("productId", "==", product.id),
        where("participants", "array-contains", user.id)
      );

      console.log("Checking if chat exists for product:", product.id);
      const existingChats = await getDocs(chatsQuery);
      let chatId;
      
      if (!existingChats.empty) {
        // Chat already exists, use it
        chatId = existingChats.docs[0].id;
        console.log("Found existing chat:", chatId);
        
        // შევამოწმოთ არსებობს თუ არა შეტყობინებები ჩატში
        try {
          const rtdbMessagesRef = ref(rtdb, `messages/${chatId}`);
          const messagesSnapshot = await get(rtdbMessagesRef);
          
          if (!messagesSnapshot.exists()) {
            console.log("No messages found in existing chat. Adding initial purchase message.");
            
            // გავაგზავნოთ საწყისი შეტყობინება, თუ ჩატი ცარიელია
            const transactionId = Math.floor(1000000 + Math.random() * 9000000);
            
            await push(rtdbMessagesRef, {
              text: `🔒 Request to Purchase ${product.displayName}
Transaction ID: ${transactionId}
Transaction Amount: $${product.price}
Payment Method: ${paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}
The buyer pays the cost of the channel + 8% ($3 minimum) service fee.

The seller confirms and agrees to use the escrow service.

The escrow agent verifies everything and assigns manager rights to the buyer.

After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.

The funds are then released to the seller. Payments are sent instantly via all major payment methods.`,
              senderId: user.id,
              senderName: user.name,
              senderPhotoURL: user.photoURL || null,
              timestamp: Date.now(),
              isRequest: true,
              isEscrowRequest: true,
              transactionData: {
                productId: product.id,
                productName: product.displayName,
                price: product.price,
                useEscrow: useEscrow,
                paymentMethod: paymentMethod,
                transactionId: transactionId
              }
            });
            
            console.log("Initial message added to existing empty chat");
            
            // განვაახლოთ lastMessage ჩატში
            const chatDocRef = doc(db, "chats", chatId);
            await updateDoc(chatDocRef, {
              lastMessage: {
                text: `🔒 Request to Purchase ${product.displayName}`,
                timestamp: Date.now(),
                senderId: user.id
              }
            });
          } else {
            console.log("Existing chat already has messages, not adding initial message");
          }
        } catch (rtdbError) {
          console.error("Error checking for messages in RTDB:", rtdbError);
        }
      } else {
        console.log("No existing chat found, creating new one...");
        
        // Make sure we have valid user IDs
        const buyerId = user.id;
        const sellerId = product.userId;
        
        console.log("Verified buyer ID:", buyerId);
        console.log("Verified seller ID:", sellerId);
        
        if (!buyerId || !sellerId) {
          console.error("Missing user IDs", { buyerId, sellerId });
          throw new Error("Missing user IDs");
        }

        // Create a new chat
        const chatData = {
          productId: product.id,
          productName: product.displayName,
          productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
          participants: [buyerId, sellerId],
          participantNames: {
            [buyerId]: user.name || user.email?.split('@')[0] || "User",
            [sellerId]: product.userEmail?.split('@')[0] || "Seller"
          },
          participantPhotos: {
            [buyerId]: user.photoURL || "",
            [sellerId]: "" // Assuming no photo available
          },
          createdAt: Date.now(),
          adminJoined: false
        };

        try {
          // Explicitly create the chat document with a specific ID
          const chatRef = doc(collection(db, "chats"));
          chatId = chatRef.id;
          
          // Set the document with the ID
          await setDoc(chatRef, chatData);
          console.log("Created new chat with ID:", chatId);
          
          // Generate transaction ID
          const transactionId = Math.floor(1000000 + Math.random() * 9000000); // 7-digit random number
          
          // Create the first message with escrow request
          const purchaseMessage = {
            text: `🔒 Request to Purchase ${product.displayName}
Transaction ID: ${transactionId}
Transaction Amount: $${product.price}
Payment Method: ${paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}
The buyer pays the cost of the channel + 8% ($3 minimum) service fee.

The seller confirms and agrees to use the escrow service.

The escrow agent verifies everything and assigns manager rights to the buyer.

After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.

The funds are then released to the seller. Payments are sent instantly via all major payment methods.`,
            senderId: user.id,
            senderName: user.name,
            senderPhotoURL: user.photoURL || null,
            timestamp: Date.now(),
            isRequest: true,
            isEscrowRequest: true,
            transactionData: {
              productId: product.id,
              productName: product.displayName,
              price: product.price,
              useEscrow: useEscrow,
              paymentMethod: paymentMethod,
              transactionId: transactionId
            }
          };
          
          // დავამატოთ მესიჯი რეალური დროის ბაზაში
          console.log("Adding purchase message to RTDB...");
          const messagesRef = ref(rtdb, `messages/${chatId}`);
          await push(messagesRef, purchaseMessage);
          console.log("Purchase message added to RTDB successfully");
          
          // განვაახლოთ ჩატში lastMessage ველი
          await updateDoc(doc(db, "chats", chatId), {
            lastMessage: {
              text: `🔒 Request to Purchase ${product.displayName}`,
              timestamp: Date.now(),
              senderId: user.id
            }
          });
          
          // Update the buyer's chatList
          console.log("Adding chat to buyer's chat list");
          const buyerChatListRef = doc(db, "users", buyerId, "chatList", chatId);
          await setDoc(buyerChatListRef, {
            chatId: chatId,
            productId: product.id,
            productName: product.displayName,
            productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
            otherUserId: sellerId,
            otherUserName: product.userEmail?.split('@')[0] || "Seller",
            lastMessage: `🔒 Request to Purchase ${product.displayName}`,
            lastMessageTimestamp: Date.now(),
            unreadCount: 0,
            updatedAt: Date.now()
          });
          
          // Update the seller's chatList
          console.log("Adding chat to seller's chat list");
          const sellerChatListRef = doc(db, "users", sellerId, "chatList", chatId);
          await setDoc(sellerChatListRef, {
            chatId: chatId,
            productId: product.id,
            productName: product.displayName,
            productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
            otherUserId: buyerId,
            otherUserName: user.name || user.email?.split('@')[0] || "User",
            lastMessage: `🔒 Request to Purchase ${product.displayName}`,
            lastMessageTimestamp: Date.now(),
            unreadCount: 1,
            updatedAt: Date.now()
          });
          
        } catch (chatError) {
          console.error("Error in chat creation process:", chatError);
          throw chatError; // Re-throw to be caught by the outer catch
        }
      }
      
      // შევინახოთ ბოლო ჩატის ID ლოკალურ სტორიჯში
      localStorage.setItem('lastChatId', chatId);
      
      // Redirect to the chat
      router.push(`/my-chats?chatId=${chatId}`);
    } catch (err) {
      console.error("Error in contact seller function:", err);
      // დეტალური შეცდომის ლოგირება
      if (err instanceof Error) {
        console.error("Error details:", err.message, err.stack);
      }
      alert("Failed to create chat. Please try again later.");
    }
  };

  // სკელეტონის კომპონენტი - ზუსტად მიმზგავსებული ProductCard-ის
  const ProductCardSkeleton = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:shadow-lg w-full animate-pulse">
      {/* სურათის არეა - ზუსტად მიმზგავსებული Image ელემენტის */}
      <div className="relative aspect-[4/3] bg-gray-300">
        {/* წავშალოთ შავი წრეები */}
      </div>

      {/* კონტენტის არეა */}
      <div className="p-4">
        {/* პლატფორმა და კატეგორია */}
        <div className="flex justify-between items-center mb-2">
          <div className="px-2 py-1 bg-gray-200 rounded w-20 h-6"></div>
          <div className="w-24 h-4 bg-gray-200 rounded"></div>
        </div>

        {/* სათაური */}
        <div className="h-7 bg-gray-200 rounded w-3/4 mb-2"></div>

        {/* ფასი და გამომწერები */}
        <div className="flex justify-between items-center mb-3">
          <div className="h-7 w-16 bg-gray-200 rounded"></div>
          <div className="h-4 w-28 bg-gray-200 rounded"></div>
        </div>

        {/* ღილაკები */}
        <div className="flex justify-between gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  // სკელეტონების მასივის შექმნა - იმდენი რამდენიც პროდუქტია ერთ გვერდზე
  const renderSkeletons = () => {
    return Array.from({ length: productsPerPage }).map((_, index) => (
      <div key={`skeleton-${index}`} className="h-[500px] flex">
        <ProductCardSkeleton />
      </div>
    ));
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dark))] text-gray-100 font-inter relative overflow-hidden">
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

          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search channels..."
              className="w-full bg-[hsl(var(--dark-card))] border border-gray-700 rounded-full px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--secondary))] text-white"
              value={filters.search || ""}
              onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
            />
            <button 
              className="absolute right-0 top-0 bottom-0 px-4 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))] rounded-r-full"
              title="Search"
              aria-label="Search"
            >
              <svg className="h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>

          <nav className="hidden md:flex items-center space-x-6 ml-8">
            <Link href="/" className="text-gray-300 hover:text-orange-500 transition-colors">
              Explore
            </Link>
            <a href="#how-it-works" className="text-gray-300 hover:text-orange-500 transition-colors">How It Works</a>
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

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-700 bg-[hsl(var(--dark-lighter))] p-1 shadow-lg z-10">
                    <Link href="/profile" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-card))] rounded">
                      My Profile
                    </Link>
                    <Link href="/my-favorites" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-card))] rounded">
                      My Favorites
                    </Link>
                    <Link href="/transactions" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-card))] rounded">
                      My Transactions
                    </Link>
                    {user.isAdmin && (
                      <Link href="/admin" className="block px-4 py-2 text-gray-300 hover:bg-[hsl(var(--dark-card))] rounded">
                        Admin Panel
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
                      className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-500/10 rounded"
                    >
                      Logout
                    </button>
                  </div>
                )}
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
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-[hsl(var(--dark-lighter))] to-[hsl(var(--dark))] rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between mb-12 shadow-2xl">
          <div className="md:w-1/2 text-center md:text-left mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-white mb-4">
              Buy & Sell Social Media Accounts <span className="text-[hsl(var(--primary))]">Securely</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8">
              The first marketplace with verified accounts, secure payments, and escrow service.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button 
                onClick={() => {
                  const productsGrid = document.getElementById('productsGrid');
                  if (productsGrid) {
                    productsGrid.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="bg-[hsl(var(--primary))] hover:bg-orange-500 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Browse Accounts
              </button>
              <Link href="/products/new" className="bg-[hsl(var(--dark-card))] hover:bg-orange-500 hover:text-white text-gray-300 font-semibold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105">
                Sell Your Account
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center md:justify-end">
            <div className="relative w-full max-w-md aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-xl transform hover:scale-105 transition-transform duration-300">
              <img
                src="/background.jpeg"
                alt="Social Media Accounts"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                <svg
                  className="w-24 h-24 text-white opacity-80"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M21.409 6.002c-.22-.82-.875-1.475-1.695-1.695C18.067 4 12 4 12 4s-6.067 0-7.714.307c-.82.22-1.475.875-1.695 1.695C2 7.933 2 12 2 12s0 4.067.307 5.714c.22.82.875 1.475 1.695 1.695C5.933 20 12 20 12 20s6.067 0 7.714-.307c.82-.22 1.475-.875 1.695-1.695C22 16.067 22 12 22 12s0-4.067-.591-5.998zM9.545 15.594V8.406L15.818 12l-6.273 3.594z" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Channels Section */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4 flex-wrap justify-center">
              <span className="text-gray-400">Sort by:</span>
              <select 
                className="bg-[hsl(var(--dark-card))] text-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                value={filters.sortBy || "relevance"}
                onChange={(e) => handleFilterChange({ ...filters, sortBy: e.target.value })}
                aria-label="Sort by"
              >
                <option value="relevance">relevance</option>
                <option value="createdAt">creation date</option>
                <option value="price">price</option>
                <option value="subscribers">subscribers</option>
                <option value="income">income</option>
              </select>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => handleFilterChange({ ...filters, verified: !filters.verified })}
                className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                  filters.verified 
                    ? "bg-[hsl(var(--primary))] text-white" 
                    : "bg-[hsl(var(--dark-card))] text-gray-300 hover:bg-[hsl(var(--dark-lighter))]"
                }`}
              >
                Verified Sellers
              </button>
            </div>
          </div>

          <div id="productsGrid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {isLoading ? renderSkeletons() : currentProducts.map((product) => (
              <div key={product.id} className="h-[500px] flex">
                <ProductCard 
                  product={product} 
                  onContactSeller={handleContactSeller}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex justify-center mt-10 mb-6">
              <nav className="flex items-center space-x-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md bg-[hsl(var(--dark-card))] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--dark-lighter))] transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === page
                        ? "bg-[hsl(var(--primary))] text-white"
                        : "bg-[hsl(var(--dark-card))] text-white hover:bg-[hsl(var(--dark-lighter))]"
                    } transition-colors`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-md bg-[hsl(var(--dark-card))] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--dark-lighter))] transition-colors"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="bg-[hsl(var(--dark-lighter))] rounded-xl p-8 md:p-12 mb-12 shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* List Your Channel */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-[hsl(var(--dark-card))] shadow-lg card-hover">
              <div className="bg-[hsl(var(--primary))] rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">List Your Channel</h3>
              <p className="text-gray-400">Fill out the form with details about your YouTube channel, including subscriber count, niche, and asking price.</p>
            </div>
            {/* Secure Verification */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-[hsl(var(--dark-card))] shadow-lg card-hover">
              <div className="bg-[hsl(var(--secondary))] rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Secure Verification</h3>
              <p className="text-gray-400">We verify your channel metrics through the YouTube API to provide buyers with accurate information.</p>
            </div>
            {/* Escrow Payments */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-[hsl(var(--dark-card))] shadow-lg card-hover">
              <div className="bg-green-600 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Escrow Payments</h3>
              <p className="text-gray-400">When a buyer makes a purchase, the payment is held in escrow until the channel transfer is complete.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[hsl(var(--dark-lighter))] py-10 px-4">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl font-bold text-[hsl(var(--primary))]">SWAPD</span>
              <span className="text-2xl font-bold text-gray-100">MARKET</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              The most secure marketplace for buying and selling social media accounts with verification and escrow services.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-[hsl(var(--primary))] transition-colors duration-200">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33V22C17.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-[hsl(var(--primary))] transition-colors duration-200">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.007-.532A8.318 8.318 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 014 9.82c-.006.04-.006.08-.006.12 0 4.479 3.127 8.197 7.283 9.044A4.095 4.095 0 017.29 20.25c-1.173 0-2.29-.115-3.37-.318a11.63 11.63 0 003.87 1.029c9.29 0 14.36-7.68 14.36-14.37 0-.22-.005-.43-.01-.64A10.272 10.272 0 0022 4.618a.13.13 0 01-.013-.027z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/" className="hover:text-orange-500 transition-colors">Home</Link></li>
              <li><a href="#productsGrid" className="hover:text-orange-500 transition-colors">Browse Accounts</a></li>
              <li><Link href="/products/new" className="hover:text-orange-500 transition-colors">Sell Your Account</Link></li>
              <li><a href="#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/help" className="hover:text-orange-500 transition-colors">Help Centre</Link></li>
              <li><Link href="/faq" className="hover:text-orange-500 transition-colors">FAQs</Link></li>
              <li><Link href="/contact" className="hover:text-orange-500 transition-colors">Contact Us</Link></li>
              <li><Link href="/terms" className="hover:text-orange-500 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-orange-500 transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Newsletter</h4>
            <p className="text-gray-400 text-sm mb-4">
              Subscribe to get the latest updates and offers.
            </p>
            <form className="flex">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 bg-[hsl(var(--dark-card))] text-gray-300 rounded-l-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
              <button
                type="submit"
                className="bg-[hsl(var(--primary))] hover:bg-opacity-90 text-white py-2 px-5 rounded-r-full transition-colors duration-300"
                title="Subscribe to newsletter"
                aria-label="Subscribe to newsletter"
              >
                <svg
                  className="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.894 2.553a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 8H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </form>
          </div>
        </div>
        <div className="text-center text-gray-500 text-sm mt-10">
          &copy; 2024 SWAPDMARKET. All rights reserved.
        </div>
      </footer>

      {/* Fixed Chat Button */}
      <Link 
        href="/my-chats" 
        className="fixed bottom-8 right-8 w-16 h-16 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center shadow-lg card-hover z-50"
        title="Open Messages"
        aria-label="Open Messages"
      >
        <div className="relative">
          <svg 
            className="w-8 h-8 text-white" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
      </Link>

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

        body::-webkit-scrollbar {
          display: none;
        }

        body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .card-hover {
          transition: all 300ms;
        }

        .card-hover:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
}
