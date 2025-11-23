import React, { useState, useEffect, useMemo } from 'react';
import { Search, Image as ImageIcon, HardDrive, Loader2, AlertCircle, X, Calendar, Copy, Check, Link as LinkIcon, ArrowUpDown, SortAsc, SortDesc, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';
import Loader from '../components/Loader';

const Gallery = () => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState(null);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [copied, setCopied] = useState(false);

  // Filtering & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'uploaded_at', direction: 'desc' });

  // Pre-fill API Key if user has one
  useEffect(() => {
      const loadKey = async () => {
          try {
              // Use fetch directly instead of mockDatabase to be consistent with new flow
              const token = localStorage.getItem('auth_token');
              if (!token) return;

              // Get user tokens
              const res = await fetch('/api/tokens', { headers: { 'Authorization': `Bearer ${token}` } });
              if (res.ok) {
                  const tokens = await res.json();
                  if (tokens && tokens.length > 0) {
                      setApiKey(tokens[0].token);
                      // Auto-load images
                      handleSearch(null, tokens[0].token);
                  }
              }
          } catch (e) { console.error(e); }
      };
      loadKey();
  }, []);

  const handleSearch = async (e, overrideKey = null) => {
    if (e) e.preventDefault();
    const keyToUse = overrideKey || apiKey;
    
    if (!keyToUse || !keyToUse.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      // Using direct API fetch
      const res = await fetch('/api/images/list', {
          headers: { 'Authorization': `Bearer ${keyToUse}` }
      });
      
      if (res.ok) {
          const result = await res.json();
          setImages(result);
          if (result.length === 0) {
            setError('Изображения не найдены.');
          }
      } else {
          setError('Неверный ключ или ошибка сервера.');
      }
    } catch (err) {
      setError('Ошибка при загрузке данных.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter and Sort Logic
  const filteredAndSortedImages = useMemo(() => {
      if (!images) return [];

      let result = [...images];

      // Filter
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          result = result.filter(img => 
              img.name.toLowerCase().includes(lowerTerm) || 
              img.id.includes(lowerTerm)
          );
      }

      // Sort
      result.sort((a, b) => {
          let aValue = a[sortConfig.key];
          let bValue = b[sortConfig.key];

          if (typeof aValue === 'string') aValue = aValue.toLowerCase();
          if (typeof bValue === 'string') bValue = bValue.toLowerCase();

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  }, [images, searchTerm, sortConfig]);

  const handleSort = (key) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const totalSize = images ? images.reduce((acc, img) => acc + img.size, 0).toFixed(1) : 0;
  const maxStorage = 1024; // 1GB in MB
  const percentage = Math.min((totalSize / maxStorage) * 100, 100);

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-text-main mb-2 flex items-center gap-3">
          <ImageIcon className="text-accent-primary" />
          Медиа Галерея
        </h1>
        <p className="text-text-muted">Просмотр загруженных файлов по API ключу</p>
      </header>

      {/* Search & Controls Section */}
      <div className="glass-panel p-6 rounded-2xl space-y-6">
        {/* API Key Input */}
        <form onSubmit={handleSearch} className="relative">
            <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
            <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Введите ваш API Key (sk_live_...)"
                className="w-full bg-bg-main border border-border-color rounded-xl pl-12 pr-32 py-4 text-text-main focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all font-mono"
            />
            <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 px-6 rounded-lg bg-accent-primary text-accent-secondary font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Обновить'}
            </button>
            </div>
        </form>
        
        {loading && <Loader />}

        {/* Toolbar (Sort/Filter) - Only show if images exist */}
        {images && images.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex flex-col md:flex-row gap-4 pt-4 border-t border-border-color"
            >
                <div className="relative flex-1">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Фильтр по имени..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-bg-main border border-border-color rounded-lg pl-9 pr-4 py-2 text-sm text-text-main focus:outline-none focus:border-accent-primary transition-colors"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleSort('uploaded_at')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            sortConfig.key === 'uploaded_at' 
                                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' 
                                : 'bg-bg-main border-border-color text-text-muted hover:text-text-main'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Дата
                        {sortConfig.key === 'uploaded_at' && (
                            sortConfig.direction === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                        )}
                    </button>
                    <button 
                        onClick={() => handleSort('size')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            sortConfig.key === 'size' 
                                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' 
                                : 'bg-bg-main border-border-color text-text-muted hover:text-text-main'
                        }`}
                    >
                        <HardDrive className="w-4 h-4" />
                        Размер
                        {sortConfig.key === 'size' && (
                            sortConfig.direction === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                        )}
                    </button>
                </div>
            </motion.div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 max-w-2xl mx-auto"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        {images && images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Storage Stats */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 rounded-full bg-accent-primary/10 text-accent-primary">
                <HardDrive className="w-8 h-8" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex justify-between mb-2">
                  <span className="text-text-main font-medium">Использовано места</span>
                  <span className="text-text-muted">
                    <span className="text-accent-primary font-bold">{totalSize} MB</span> / {maxStorage} MB
                  </span>
                </div>
                <div className="h-3 bg-bg-main rounded-full overflow-hidden border border-border-color">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-accent-primary rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Image Grid (Masonry-ish) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                  {filteredAndSortedImages.map((img, index) => (
                    <motion.div
                      layout
                      key={img.id}
                      onClick={() => setSelectedImage(img)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative aspect-square rounded-xl overflow-hidden glass-panel border border-border-color cursor-pointer hover:shadow-lg hover:border-accent-primary/50 transition-all"
                    >
                      <img 
                        src={img.url} 
                        alt={img.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                         <p className="text-white text-sm font-medium truncate">{img.name}</p>
                         <p className="text-white/60 text-xs">{img.size} MB</p>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
            
            {filteredAndSortedImages.length === 0 && (
                <div className="text-center py-12 text-text-muted">
                    Ничего не найдено по вашему запросу.
                </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Details Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-bg-panel border border-border-color rounded-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Image Preview Area */}
              <div className="w-full md:w-2/3 bg-black/50 flex items-center justify-center p-6 relative group">
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.name} 
                  className="max-h-[50vh] md:max-h-[70vh] w-auto object-contain rounded-lg shadow-lg" 
                />
                <a 
                  href={selectedImage.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Открыть в полном размере"
                >
                  <LinkIcon className="w-5 h-5" />
                </a>
              </div>
              
              {/* Details Sidebar */}
              <div className="w-full md:w-1/3 p-8 bg-bg-main flex flex-col overflow-y-auto border-l border-border-color">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-text-main mb-1 break-all leading-tight">{selectedImage.name}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-primary/10 text-accent-primary text-xs font-medium border border-accent-primary/20">
                      IMAGE
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="p-2 hover:bg-bg-panel rounded-lg text-text-muted hover:text-text-main transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                   {/* Info Grid */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-bg-panel border border-border-color">
                        <div className="flex items-center gap-2 text-xs text-text-muted uppercase font-bold mb-2">
                          <HardDrive className="w-4 h-4" />
                          Размер
                        </div>
                        <div className="text-text-main font-mono text-lg">{selectedImage.size} MB</div>
                      </div>
                      <div className="p-4 rounded-xl bg-bg-panel border border-border-color">
                        <div className="flex items-center gap-2 text-xs text-text-muted uppercase font-bold mb-2">
                          <Calendar className="w-4 h-4" />
                          Загружен
                        </div>
                        <div className="text-text-main text-sm font-medium">
                          {new Date(selectedImage.uploaded_at).toLocaleDateString('ru-RU')}
                        </div>
                         <div className="text-text-muted text-xs mt-1">
                          {new Date(selectedImage.uploaded_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                   </div>
                   
                   {/* Direct Link */}
                   <div className="p-5 rounded-xl bg-bg-panel border border-border-color">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-text-muted uppercase font-bold">Прямая ссылка</div>
                        <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          Public
                        </span>
                      </div>
                      <div className="flex gap-2">
                         <div className="relative flex-1">
                            <input 
                              type="text" 
                              readOnly 
                              value={selectedImage.url} 
                              className="w-full bg-bg-main border border-border-color rounded-lg pl-3 pr-10 py-2.5 text-text-main text-sm font-mono focus:outline-none focus:border-accent-primary transition-colors truncate"
                            />
                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-bg-main to-transparent pointer-events-none"></div>
                         </div>
                         <button 
                            onClick={() => copyToClipboard(selectedImage.url)}
                            className="px-3 py-2 rounded-lg bg-bg-main hover:bg-accent-primary hover:text-accent-secondary border border-border-color hover:border-accent-primary text-text-muted transition-all"
                            title="Копировать ссылку"
                         >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                         </button>
                      </div>
                      <p className="mt-3 text-xs text-text-muted leading-relaxed">
                        Эту ссылку можно использовать в HTML тегах &lt;img&gt; или отправлять в Discord.
                      </p>
                   </div>
                </div>
                
                <div className="mt-auto pt-8">
                  <button 
                    onClick={() => window.open(selectedImage.url, '_blank')}
                    className="w-full py-3 rounded-xl bg-bg-panel border border-border-color text-text-main hover:bg-accent-primary hover:text-accent-secondary hover:border-accent-primary transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Открыть оригинал
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
