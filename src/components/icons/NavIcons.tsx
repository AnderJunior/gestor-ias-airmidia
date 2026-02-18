import { 
  LayoutDashboard, 
  MessageCircle, 
  LogOut, 
  BarChart3, 
  Unlock, 
  Settings, 
  Mail,
  Calendar,
  Users,
  TestTube,
  Rocket,
  Shield,
  Bot,
  Clock,
  UserCircle
} from 'lucide-react';
import React from 'react';

interface IconProps {
  className?: string;
  strokeWidth?: number;
  size?: number;
  color?: string;
}

export function DashboardIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <LayoutDashboard className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function ChatIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <MessageCircle className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function LogoutIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <LogOut className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function ChartIcon({ className = 'w-6 h-6', strokeWidth = 2, size, color }: IconProps) {
  return <BarChart3 className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function UnlockIcon({ className = 'w-6 h-6', strokeWidth = 2, size, color }: IconProps) {
  return <Unlock className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function SettingsIcon({ className = 'w-6 h-6', strokeWidth = 2, size, color }: IconProps) {
  return <Settings className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function MessageIcon({ className = 'w-6 h-6', strokeWidth = 2, size, color }: IconProps) {
  return <MessageCircle className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function CalendarIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Calendar className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function UsersIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Users className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function TestTubeIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <TestTube className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function RocketIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Rocket className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function ShieldIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Shield className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function BotIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Bot className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function ClockIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <Clock className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

export function UserCircleIcon({ className = 'w-5 h-5', strokeWidth = 2, size, color }: IconProps) {
  return <UserCircle className={className} strokeWidth={strokeWidth} size={size} color={color} />;
}

