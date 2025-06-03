"use client";

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import notificationService from '@/services/notifications';

interface Notification {
  id: string;
  senderName: string;
  message: string;
  timestamp: number;
  chatId: string;
}

export function useMessageNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) {
      console.log('No user ID provided, skipping notification setup');
      return;
    }

    console.log('Setting up notifications for user:', userId);

    try {
      const messagesRef = collection(db, 'messages');
      console.log('Messages collection reference created');

      const q = query(
        messagesRef,
        where('recipientId', '==', userId),
        where('read', '==', false),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      console.log('Query created with filters:', {
        recipientId: userId,
        read: false
      });

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          console.log('Received message snapshot:', {
            totalDocs: snapshot.docs.length,
            changes: snapshot.docChanges().length
          });
          
          snapshot.docChanges().forEach((change) => {
            console.log('Document change:', {
              type: change.type,
              docId: change.doc.id,
              data: change.doc.data()
            });

            if (change.type === 'added') {
              const message = change.doc.data();
              console.log('Processing new message:', message);

              // Validate required fields
              if (!message.senderName || !message.text || !message.timestamp || !message.chatId) {
                console.error('Invalid message data:', message);
                return;
              }

              const notification: Notification = {
                id: change.doc.id,
                senderName: message.senderName,
                message: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : ''),
                timestamp: message.timestamp,
                chatId: message.chatId,
              };

              console.log('Creating notification:', notification);
              notificationService.showNotification(notification);

              setNotifications(prev => [notification, ...prev].slice(0, 10));
            }
          });
        },
        (error) => {
          console.error('Error in message listener:', error);
        }
      );

      return () => {
        console.log('Cleaning up notification listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  }, [userId]);

  return {
    notifications,
    enableSound: () => notificationService.enableSound(),
    disableSound: () => notificationService.disableSound(),
  };
} 