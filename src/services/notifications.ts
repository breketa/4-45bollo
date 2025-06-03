"use client";

import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  senderName: string;
  message: string;
  timestamp: number;
  chatId: string;
}

interface NotificationOptions {
  soundEnabled: boolean;
  duration: number;
}

class NotificationService {
  private static instance: NotificationService;
  private notificationSound: HTMLAudioElement | null = null;
  private options: NotificationOptions = {
    soundEnabled: false,
    duration: 4000, // 4 seconds
  };

  private constructor() {
    try {
      // Initialize notification sound only if sound is enabled
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        this.notificationSound = new Audio();
        this.notificationSound.preload = 'none'; // Don't preload the audio
      }
    } catch (error) {
      console.error('Error initializing notification sound:', error);
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public setOptions(options: Partial<NotificationOptions>) {
    this.options = { ...this.options, ...options };
  }

  public enableSound() {
    console.log('Enabling notification sound');
    this.options.soundEnabled = true;
  }

  public disableSound() {
    console.log('Disabling notification sound');
    this.options.soundEnabled = false;
  }

  private playNotificationSound() {
    if (!this.options.soundEnabled || !this.notificationSound) {
      return;
    }

    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  private createNotificationElement(notification: Notification): HTMLDivElement {
    console.log('Creating notification element:', notification);
    
    if (!document.body) {
      console.error('Document body not found');
      throw new Error('Document body not found');
    }

    const notificationEl = document.createElement('div');
    notificationEl.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm w-full transform transition-all duration-300 ease-in-out';
    notificationEl.style.zIndex = '9999';
    notificationEl.style.opacity = '1';
    notificationEl.style.transform = 'translateY(0)';

    const progressBar = document.createElement('div');
    progressBar.className = 'absolute bottom-0 left-0 h-1 bg-blue-500';
    progressBar.style.width = '100%';
    progressBar.style.transition = `width ${this.options.duration}ms linear`;

    const content = `
      <div class="flex items-start">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900">${notification.senderName}</h4>
          <p class="text-sm text-gray-600 mt-1">${notification.message}</p>
          <p class="text-xs text-gray-500 mt-2">${new Date(notification.timestamp).toLocaleTimeString()}</p>
        </div>
        <button class="ml-2 text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;

    notificationEl.innerHTML = content;
    notificationEl.appendChild(progressBar);

    // Add click handler to close notification
    const closeButton = notificationEl.querySelector('button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        console.log('Notification closed by user');
        notificationEl.remove();
      });
    }

    return notificationEl;
  }

  public showNotification(notification: Notification) {
    console.log('Showing notification:', notification);
    
    try {
      const notificationEl = this.createNotificationElement(notification);
      document.body.appendChild(notificationEl);
      console.log('Notification element added to DOM');

      // Start progress bar animation
      requestAnimationFrame(() => {
        const progressBar = notificationEl.querySelector('div[class*="bg-blue-500"]') as HTMLDivElement;
        if (progressBar) {
          progressBar.style.width = '0%';
          console.log('Progress bar animation started');
        }
      });

      // Play sound if enabled
      this.playNotificationSound();

      // Auto-dismiss after duration
      setTimeout(() => {
        console.log('Auto-dismissing notification');
        notificationEl.style.opacity = '0';
        notificationEl.style.transform = 'translateY(1rem)';
        setTimeout(() => {
          notificationEl.remove();
          console.log('Notification element removed from DOM');
        }, 300);
      }, this.options.duration);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
}

// React hook for real-time message notifications
export function useMessageNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'messages'),
      where('recipientId', '==', userId),
      where('read', '==', false),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const message = change.doc.data();
          const notification: Notification = {
            id: change.doc.id,
            senderName: message.senderName,
            message: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : ''),
            timestamp: message.timestamp,
            chatId: message.chatId,
          };

          // Show notification
          notificationService.showNotification(notification);

          // Update notifications state
          setNotifications(prev => [notification, ...prev].slice(0, 10));
        }
      });
    });

    return () => unsubscribe();
  }, [userId]);

  return {
    notifications,
    enableSound: () => notificationService.enableSound(),
    disableSound: () => notificationService.disableSound(),
  };
}

export default NotificationService.getInstance(); 