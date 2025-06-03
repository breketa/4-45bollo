"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProductForm from "@/components/forms/ProductForm";
import Image from "next/image";
import Link from "next/link";
import { getAuth, signOut } from "firebase/auth";

export default function NewProductPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Toggle menu function
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect due to the useEffect
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

      <div className="bg-[hsl(var(--dark))] min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
      <div className="w-full">
        <ProductForm />
      </div>
      </div>

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
