import React, { useState } from 'react';
import { Upload, Check, AlertTriangle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';

const ApiTest = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Pre-fill key from storage
  React.useEffect(() => {
    const loadKey = async () => {
      const tokenData = await dbService.getApiToken();
      if (tokenData && tokenData.token) {
        setApiKey(tokenData.token);
      }
    };
    loadKey();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setResponse(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл для загрузки');
      return;
    }
    if (!apiKey) {
      setError('Введите API ключ');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      // Determine API URL: use relative path if on same domain, or full URL
      // Since this is running in the browser, relative /api/images/upload works 
      // if the React app is served by the same server or proxied correctly.
      // If running dev server (port 5173) and backend is 3000, we need full URL or proxy.
      // Let's try full URL if hostname is localhost, otherwise relative.
      
      let apiUrl = '/api/images/upload';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
         // Assume backend is on 3000 for dev
         apiUrl = 'http://localhost:3000/api/images/upload';
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data);
      } else {
        setError(data.error || `Error ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-text-main flex items-center justify-center gap-3">
          <Terminal className="text-accent-primary" />
          API Tester
        </h1>
        <p className="text-text-muted">Проверка загрузки файлов через API прямо из браузера</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-6">
        
        {/* API Key Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">API Key</label>
          <input 
            type="text" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 font-mono text-text-main focus:outline-none focus:border-accent-primary transition-colors"
            placeholder="sk_live_..."
          />
        </div>

        {/* File Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">Image File</label>
          <div className="relative border-2 border-dashed border-border-color rounded-2xl p-8 text-center hover:border-accent-primary/50 transition-colors bg-bg-main/30">
            <input 
              type="file" 
              onChange={handleFileChange}
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <div className="p-3 rounded-full bg-bg-main text-accent-primary border border-border-color">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-text-main font-medium">
                {file ? file.name : 'Click to select or drag file here'}
              </div>
              {file && <div className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</div>}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUpload}
          disabled={loading || !file}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            loading || !file 
              ? 'bg-bg-main text-text-muted cursor-not-allowed' 
              : 'bg-accent-primary text-accent-secondary shadow-lg hover:shadow-accent-primary/20'
          }`}
        >
          {loading ? (
            <span className="animate-pulse">Uploading...</span>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Test Upload
            </>
          )}
        </motion.button>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 overflow-hidden"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="font-mono text-sm break-all">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Response */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
                <Check className="w-5 h-5" />
                <span className="font-bold">Upload Successful!</span>
              </div>

              <div className="bg-bg-main rounded-xl p-4 border border-border-color font-mono text-xs text-text-muted overflow-x-auto">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>

              {response.directUrl && (
                <div className="rounded-xl overflow-hidden border border-border-color bg-bg-main">
                  <img 
                    src={response.directUrl.replace('http://bublickrust', window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin)} 
                    alt="Uploaded" 
                    className="w-full h-auto max-h-[300px] object-contain" 
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default ApiTest;

