"use client";

import { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMessageNotifications } from '@/hooks/useNotifications';

interface NotificationProviderProps {
  children: ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  
  // Initialize notifications for the current user
  useMessageNotifications(user?.uid);

  return <>{children}</>;
} 