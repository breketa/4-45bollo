"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Product } from "@/types/product";
import { createPortal } from "react-dom";

interface ProductCardProps {
  product: Product;
  onContactSeller: (productId: string, paymentMethod: string, useEscrow: boolean) => void;
  className?: string;
  hideLink?: boolean;
}

export default function ProductCard({ product, onContactSeller, className = "", hideLink = false }: ProductCardProps) {
  const { user } = useAuth();
  const [showContactModal, setShowContactModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("stripe");
  const [useEscrow, setUseEscrow] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Use effect to set mounted to true on component mount
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        if (product.channelLogo) {
          // If it's a storage path, fetch the URL
          if (product.channelLogo.startsWith('channelLogos/')) {
            const response = await fetch(`/api/channel-logo?path=${encodeURIComponent(product.channelLogo)}`);
            if (response.ok) {
              const data = await response.json();
              setLogoUrl(data.url);
            }
          } else {
            // If it's a direct URL, use it
            setLogoUrl(product.channelLogo);
          }
        }
      } catch (error) {
        console.error('Error fetching channel logo:', error);
      }
    };

    fetchLogo();
  }, [product.channelLogo]);

  const handleContactClick = () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setShowContactModal(true);
  };

  const handleSubmitContact = async () => {
    setIsSubmitting(true);
    try {
      await onContactSeller(product.id, paymentMethod, useEscrow);
      setShowContactModal(false);
    } catch (error) {
      console.error("Error contacting seller:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`bg-[#262727] rounded-lg overflow-hidden border border-gray-800 shadow-lg transition-all duration-300 card-hover ${className}`}
      onClick={(e) => {
        // Don't navigate if clicking on buttons or their children
        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        window.location.href = `/products/${product.id}`;
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="relative">
        <div className="relative h-40 bg-gray-900">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={product.displayName}
              fill
              className="object-cover"
              onError={() => setLogoUrl(null)}
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center mb-3">
          <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
          <h3 className="font-medium text-white text-lg">{product.displayName}</h3>
        </div>

        <div className="flex justify-between items-center mb-2">
          <span className="px-2 py-1 bg-gray-800 text-xs font-semibold rounded text-gray-300">{product.platform}</span>
          <span className="text-sm text-gray-400">{product.category}</span>
        </div>

        <div className="mb-4">
          <p className="text-3xl font-bold text-white">${product.price}</p>
        </div>

        <div className="flex flex-col space-y-1 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">{product.subscribers.toLocaleString()}</span>
            <span className="text-gray-300">subscribers</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">${product.monthlyIncome?.toLocaleString() || '0'}</span>
            <span className="text-gray-300">income</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {user?.id !== product.userId && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onContactSeller(product.id, 'stripe', true);
                }}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-md font-medium transition-colors"
                title="Buy this channel"
                aria-label="Buy this channel"
              >
                Buy Now
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleContactClick();
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-md font-medium transition-colors"
              >
                Message
              </button>
            </>
          )}
          {user?.id === product.userId && (
            <Link 
              href={`/products/${product.id}`}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-center px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
            >
              See Details
            </Link>
          )}
        </div>
      </div>

      {/* Contact Modal - rendered with portal */}
      {showContactModal && mounted && createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm bg-black/50">
          <div className="bg-[#262727] rounded-lg shadow-lg max-w-md w-full p-6 animate-fade-in border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Buy this channel</h3>
              <button 
                onClick={() => setShowContactModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6 p-3 bg-gray-800 rounded">
              <div className="flex justify-between">
                <div>
                  <h4 className="font-medium text-white">{product.displayName}</h4>
                  <div className="text-sm text-gray-400">{product.platform} • {product.subscribers.toLocaleString()} subscribers</div>
                </div>
                <div className="font-bold text-orange-500">${product.price}</div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-300">Payment Method</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("stripe")}
                  className={`flex-1 py-3 px-4 rounded-lg border ${
                    paymentMethod === "stripe" 
                      ? "border-orange-500 bg-orange-900/30 text-orange-400" 
                      : "border-gray-700 hover:border-gray-600 text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.479 9.883c-1.626-.604-2.512-.996-2.512-1.678 0-.583.567-.828 1.485-.828 1.729 0 3.5.716 4.716 1.346l.684-4.217C16.543 3.988 14.633 3.5 12.917 3.5 9.146 3.5 6.421 5.572 6.421 8.75c0 4.240 6.358 3.892 6.358 5.892 0 .776-.814 1.01-1.892 1.01-1.627 0-3.783-.73-5.327-1.7l-.73 4.246c1.304.604 3.697 1.157 5.9 1.157 3.922 0 6.38-1.954 6.38-5.364 0-4.595-6.631-4.124-6.631-6.106" fill="#635BFF" fillRule="nonzero" />
                    </svg>
                    <span>Stripe</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bitcoin")}
                  className={`flex-1 py-3 px-4 rounded-lg border ${
                    paymentMethod === "bitcoin" 
                      ? "border-orange-500 bg-orange-900/30 text-orange-400" 
                      : "border-gray-700 hover:border-gray-600 text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23.64 14.906c-1.734 6.953-8.876 11.188-15.834 9.454-6.965-1.734-11.2-8.88-9.46-15.833C0.086 1.563 7.222-2.67 14.185.066c6.96 1.733 11.196 8.88 9.456 15.84Zm-11.14-7.434c.1.72-.437 1.108-1.18 1.366l.242 1.71 1.223.26-.193 1.348-1.22-.26-.932-.197-.3 1.349-1.11-.24.193-1.348-.932-.198.03-.24c-.048-.01-.097-.01-.146-.02l-1.084-.24.222-1.37.582.12c.31.06.582 0 .65-.36l.398-3.135c.03-.298-.097-.626-.64-.735l-.582-.12.22-1.368 1.088.24h.01l.912.2.21-1.348 1.108.24-.202 1.344 1.11.248.205-1.348 1.113.24-.205 1.35c1.944.437 2.952 1.326 2.684 2.877-.212 1.25-.86 1.745-1.99 1.808.873.5 1.273 1.22 1.088 2.284-.274 1.575-1.574 2.222-3.64 1.64l-.207 1.37-1.11-.24.204-1.348-.933-.197-.205 1.348-1.11-.24.205-1.348-1.967-.407.524-1.144s.815.164.806.154c.31.068.447-.115.5-.262l.417-2.935.03-.038c.01 0-.01-.02-.03-.03l-.415-3.04c-.06-.298-.252-.63-.68-.532.02-.3-.805-.173-.805-.173l-.33-1.2 1.864.415.932.2.193-1.35 1.11.24-.193 1.35zm-.067 6.322c-.417-.097-1.735-.417-1.784-.426-.05-.05-.007-.105-.05-.126-.125-.02-.077-.05-1.066-.053-1.106-.005-.04.003-.09.024-.125.02-.038.077-.077.175-.058.098.02 1.368.29 1.407.3.04.01.09.02.116.058.028.04.053.086.048.135-.005.05-.212 1.067-.222 1.108-.01.038-.028.107-.068.145-.04.038-.108.078-.184.058-.077-.02.145.032-.145-.03h.813z" fill="#F7931A" />
                    </svg>
                    <span>Bitcoin</span>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="mb-8">
              <label className="flex items-center text-gray-300">
                <input
                  type="checkbox"
                  checked={useEscrow}
                  onChange={() => setUseEscrow(!useEscrow)}
                  className="w-4 h-4 text-orange-500 border-gray-600 rounded bg-gray-800"
                />
                <span className="ml-2 text-sm">Use Escrow Service</span>
              </label>
              {useEscrow && (
                <div className="mt-2 text-xs text-gray-400 pl-6 bg-gray-800 p-3 rounded-md border border-gray-700">
                  <p className="font-medium mb-2">Escrow helps ensure a secure payment and channel transfer process (+8% commission, minimum $3)</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li>The buyer pays the cost of the channel + 8% ($3 minimum) service fee.</li>
                    <li>The seller confirms and agrees to use the escrow service.</li>
                    <li>The escrow agent verifies everything and assigns manager rights to the buyer.</li>
                    <li>After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.</li>
                    <li>The funds are then released to the seller. Payments are sent instantly via all major payment methods.</li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitContact}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-orange-500 rounded-lg text-white hover:bg-orange-600 disabled:bg-orange-400 flex items-center justify-center transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </>
                ) : (
                  "Buy this channel"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
} 