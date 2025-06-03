import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BellIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

export default function RightSidebar() {
  const { user } = useAuth();
  const [notifications] = useState([
    {
      id: 1,
      title: 'ახალი შეკვეთა',
      message: 'თქვენ გაქვთ ახალი შეკვეთა #1234',
      time: '5 წუთის წინ',
      read: false,
    },
    {
      id: 2,
      title: 'პროდუქტის განახლება',
      message: 'პროდუქტი "iPhone 13" განახლდა',
      time: '1 საათის წინ',
      read: true,
    },
  ]);

  const [messages] = useState([
    {
      id: 1,
      sender: 'გიორგი',
      message: 'გამარჯობა, როგორ ხარ?',
      time: '10 წუთის წინ',
      unread: true,
    },
    {
      id: 2,
      sender: 'ნინო',
      message: 'დაგვიკავშირდი დეტალებისთვის',
      time: '30 წუთის წინ',
      unread: false,
    },
  ]);

  return (
    <div className="w-80 h-screen bg-[hsl(var(--dark))] border-l border-gray-700/50 fixed right-0 top-0">
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">შეტყობინებები</h2>
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg ${
                  notification.read
                    ? 'bg-[hsl(var(--dark-lighter))]'
                    : 'bg-[hsl(var(--primary))]/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{notification.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{notification.message}</p>
                  </div>
                  <span className="text-gray-500 text-xs">{notification.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-4">შეტყობინებები</h2>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg ${
                  message.unread
                    ? 'bg-[hsl(var(--primary))]/10'
                    : 'bg-[hsl(var(--dark-lighter))]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{message.sender}</h3>
                    <p className="text-gray-400 text-sm mt-1">{message.message}</p>
                  </div>
                  <span className="text-gray-500 text-xs">{message.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 