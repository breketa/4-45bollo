import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { 
  HomeIcon, 
  ShoppingBagIcon, 
  UserIcon, 
  ChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline';

export default function LeftSidebar() {
  const { user } = useAuth();
  const router = useRouter();

  const navigation = [
    { name: 'მთავარი', href: '/', icon: HomeIcon },
    { name: 'პროდუქტები', href: '/products', icon: ShoppingBagIcon },
    { name: 'პროფილი', href: '/profile', icon: UserIcon },
    { name: 'სტატისტიკა', href: '/analytics', icon: ChartBarIcon },
    { name: 'პარამეტრები', href: '/settings', icon: CogIcon },
  ];

  return (
    <div className="w-80 h-screen bg-[hsl(var(--dark))] border-r border-gray-700/50 fixed left-0 top-0">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
            <span className="text-white font-semibold text-lg">
              {user?.email?.[0].toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <p className="text-white font-medium">{user?.email}</p>
            <p className="text-gray-400 text-sm">მომხმარებელი</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center space-x-4 px-4 py-3 text-gray-300 hover:bg-[hsl(var(--dark-lighter))] rounded-md transition-colors"
            >
              <item.icon className="w-6 h-6" />
              <span className="text-base">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
} 