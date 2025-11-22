import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, ArrowRight } from 'lucide-react';
import StarBackground from '../components/StarBackground';

const Auth = () => {
  const [isLogin, setIsLogin] = React.useState(true);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 text-text-main bg-bg-main transition-colors duration-300">
      <StarBackground />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-primary text-accent-secondary mb-4 shadow-lg shadow-accent-primary/20">
            <Rocket className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-text-main mb-2">
            CosmoSpace
          </h1>
          <p className="text-text-muted">Исследуйте вселенную API</p>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden border border-border-color">
          {/* Decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent-primary/5 rounded-full blur-3xl"></div>

          <h2 className="text-xl font-semibold mb-6 relative z-10 text-text-main">
            {isLogin ? 'Вход в систему' : 'Создание аккаунта'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Имя пользователя</label>
                <input 
                  type="text" 
                  className="w-full bg-bg-main border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-text-main"
                  placeholder="Commander Shepard"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
              <input 
                type="text" 
                className="w-full bg-bg-main border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-text-main"
                placeholder="user@cosmos.io"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Пароль</label>
              <input 
                type="password" 
                className="w-full bg-bg-main border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-text-main"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-accent-primary hover:opacity-90 text-accent-secondary font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2 group"
            >
              {isLogin ? 'Войти' : 'Зарегистрироваться'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm relative z-10">
            <span className="text-text-muted">
              {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
            </span>
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-text-main hover:text-accent-primary font-medium transition-colors"
            >
              {isLogin ? 'Создать' : 'Войти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
