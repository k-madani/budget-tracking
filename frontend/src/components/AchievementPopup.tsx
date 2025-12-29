'use client';

import { useEffect, useState } from 'react';

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  points: number;
}

interface AchievementPopupProps {
  achievements: Achievement[];
  onClose: () => void;
}

export default function AchievementPopup({ achievements, onClose }: AchievementPopupProps) {
  const [show, setShow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (achievements.length > 0) {
      setShow(true);
      
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [achievements]);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };

  const handleNext = () => {
    if (currentIndex < achievements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleClose();
    }
  };

  if (achievements.length === 0 || !show) return null;

  const current = achievements[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-5%`,
              backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random()}s`
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative bg-card border-2 border-primary rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="text-8xl mb-4 animate-bounce-slow">{current.icon}</div>

          <div className="inline-block px-4 py-1 bg-primary/20 text-primary text-xs font-bold rounded-full mb-4">
            ACHIEVEMENT UNLOCKED
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-2">{current.name}</h2>
          <p className="text-muted-foreground mb-6">{current.description}</p>

          <div className="inline-flex items-center space-x-2 px-6 py-3 bg-primary/10 border border-primary/20 rounded-xl mb-6">
            <span className="font-bold text-primary text-xl">+{current.points} Points</span>
          </div>

          {achievements.length > 1 && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              {achievements.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === currentIndex ? 'bg-primary' : 'bg-muted'}`}
                />
              ))}
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold"
          >
            {currentIndex < achievements.length - 1 ? 'Next Achievement →' : 'Awesome! 🎉'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .animate-confetti {
          animation: confetti 3s linear;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}