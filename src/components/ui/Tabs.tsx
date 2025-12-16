'use client';

import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  return (
    <div className="mb-0">
      <nav 
        className="flex items-end" 
        aria-label="Tabs"
        style={{ 
          borderBottom: '1px solid #d1d5db',
          paddingTop: '8px',
          paddingLeft: '8px',
          minHeight: '40px',
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const isLast = index === tabs.length - 1;
          const isHovered = hoveredTab === tab.id && !isActive;
          
          return (
            <div key={tab.id} className="relative">
              <button
                onClick={() => onTabChange(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className="relative flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-150"
                style={{
                  marginRight: isLast ? '8px' : '8px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  borderBottom: 'none',
                  backgroundColor: isActive ? 'white' : isHovered ? '#e5e5e5' : '#f4f4f4',
                  marginBottom: isActive ? '-1px' : '0',
                  zIndex: isActive ? 10 : 1,
                  boxShadow: isActive ? '0 -2px 4px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {tab.icon && (
                  <span 
                    className="flex items-center"
                    style={{ 
                      fontSize: '14px', 
                      width: '16px', 
                      height: '16px',
                    }}
                  >
                    {tab.icon}
                  </span>
                )}
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className="ml-1.5 py-0.5 px-2 rounded-full text-xs font-semibold min-w-[20px] text-center leading-none"
                    style={{
                      backgroundColor: isActive ? '#880BDB' : '#f4f4f4',
                      color: isActive ? 'white' : 'black',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

