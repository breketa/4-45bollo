"use client";

import { useState, useEffect } from 'react';
import notificationService from '@/services/notifications';

export default function NotificationSettings() {
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    // Load saved preference
    const savedPreference = localStorage.getItem('notificationSoundEnabled');
    const enabled = savedPreference === 'true';
    setSoundEnabled(enabled);
    if (enabled) {
      notificationService.enableSound();
    }
  }, []);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('notificationSoundEnabled', String(newState));
    
    if (newState) {
      notificationService.enableSound();
    } else {
      notificationService.disableSound();
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="notificationSound"
        checked={soundEnabled}
        onChange={toggleSound}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <label htmlFor="notificationSound" className="text-sm text-gray-700">
        Enable notification sound
      </label>
    </div>
  );
} 