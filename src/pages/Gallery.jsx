import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, HardDrive, Loader2, AlertCircle, X, Calendar, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';

const Gallery = () => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState(null);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill API Key if user has one
  useEffect(() => {
      const loadKey = async () => {
          try {
              const tokens = await dbService.getApiTokens();
              if (tokens && tokens.length > 0) {
                  setApiKey(tokens[0].token);
                  // Auto-load images if key found
                  handleSearch(null, tokens[0].token);
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
    // Only reset images if explicit search
    if (e) setImages(null); 

    try {
      const result = await dbService.getImagesByToken(keyToUse);
      setImages(result);
      if (result.length === 0) {
        setError('Изображения не найдены или неверный ключ.');
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

      {/* Search Section */}
      <div className="glass-panel p-8 rounded-2xl">
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Найти'}
            </button>
          </div>
        </form>
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

            {/* Image Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {images.map((img, index) => (
                <motion.div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative aspect-video rounded-xl overflow-hidden glass-panel border border-border-color cursor-pointer hover:shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-shadow"
                >
                  <img 
                    src={img.url} 
                    alt={img.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                     <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white border border-white/20">
                        Подробнее
                     </div>
                  </div>
                </motion.div>
              ))}
            </div>
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
