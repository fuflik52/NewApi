import React from 'react';

const StarBackground = () => {
  // Generates random stars for inline styles to avoid heavy css files
  // In a real app, canvas is better for performance, but this is quick and React-y
  const generateStars = (count) => {
    let stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        opacity: Math.random(),
        duration: Math.random() * 3 + 2
      });
    }
    return stars;
  };

  const stars = React.useMemo(() => generateStars(50), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-space-900">
       {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-space-900/50 to-space-900"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-space-900 to-black"></div>
      
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`
          }}
        />
      ))}
    </div>
  );
};

export default StarBackground;

