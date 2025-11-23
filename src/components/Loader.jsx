import React from 'react';

const Loader = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-accent-primary/20 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-t-accent-primary rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

export default Loader;

