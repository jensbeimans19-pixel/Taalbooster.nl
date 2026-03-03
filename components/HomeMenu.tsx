import React, { useEffect, useState } from 'react';
import { AppMode } from '../types';
import { ToolCarousel } from './ui/ToolCarousel';

interface HomeMenuProps {
  onSelectMode: (mode: AppMode) => void;
  totalStars?: number;
  onSpendStars?: (amount: number) => boolean;
  accentColor?: string;
}

const HomeMenu: React.FC<HomeMenuProps> = ({ onSelectMode, totalStars = 0, onSpendStars, accentColor = '#8DBF45' }) => {
  const [streak, setStreak] = useState(0);
  
  useEffect(() => {
    // Check local storage for streak validity without modifying it
    try {
        const STORAGE_KEY_STREAK = 'nt2_daily_streak';
        const STORAGE_KEY_DATE = 'nt2_last_activity_date';

        const storedStreak = parseInt(localStorage.getItem(STORAGE_KEY_STREAK) || '0', 10);
        const lastDateStr = localStorage.getItem(STORAGE_KEY_DATE);

        if (lastDateStr && storedStreak > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastDate = new Date(lastDateStr);
            const lastDateMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

            const diffTime = today.getTime() - lastDateMidnight.getTime();
            const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

            let isValid = false;
            if (diffDays === 0) isValid = true; // Played today
            else if (diffDays === 1) isValid = true; // Played yesterday
            else if (today.getDay() === 1) { // Monday rule
                // Allow Fri (5), Sat (6), Sun (0)
                const dayOfWeekLast = lastDateMidnight.getDay();
                if (diffDays <= 3 && (dayOfWeekLast === 5 || dayOfWeekLast === 6 || dayOfWeekLast === 0)) {
                    isValid = true;
                }
            }

            if (isValid) {
                setStreak(storedStreak);
            } else {
                setStreak(0); 
            }
        }
    } catch (e) {
        console.error("Error reading streak", e);
    }
  }, []);

  const containerStyle = { '--accent': accentColor } as React.CSSProperties;

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up" style={containerStyle}>
      <div className="text-center mb-4">
        <h2 className="text-4xl sm:text-5xl font-heading text-[#005B8C] mb-4">
          Wat gaan we oefenen vandaag?
        </h2>
        <p className="text-xl text-gray-500 font-body">Kies een activiteit om te starten.</p>
      </div>

      <ToolCarousel onSelect={onSelectMode} />
    </div>
  );
};

export default HomeMenu;