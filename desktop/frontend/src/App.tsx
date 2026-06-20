import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import SplashScreen from './components/SplashScreen';
import SetupWizard from './components/SetupWizard';
import SettingsModal from './components/SettingsModal';
import { X } from 'lucide-react';
import './index.css';

type AppState = 'booting' | 'setup' | 'main';

import { getCurrentWindow } from '@tauri-apps/api/window';

const WindowControls = () => {
  const appWindow = getCurrentWindow();
  return (
    <div className="shell-window-controls">
      <button onClick={() => appWindow.minimize()} className="shell-window-btn" title="最小化">
        <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="5" width="8" height="1" fill="currentColor"/></svg>
      </button>
      <button onClick={() => appWindow.toggleMaximize()} className="shell-window-btn" title="最大化">
        <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
      </button>
      <button onClick={() => appWindow.close()} className="shell-window-btn shell-window-close" title="关闭">
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2,2 L9,9 M9,2 L2,9" stroke="currentColor" strokeWidth="1.2"/></svg>
      </button>
    </div>
  );
};

function App() {
  const [appState, setAppState] = useState<AppState>('booting');
  const [activePort, setActivePort] = useState<number>(8681);
  const [showSettings, setShowSettings] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const unlisten = listen('closing-backend', () => {
      setClosing(true);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'tauri-drag') {
        getCurrentWindow().startDragging();
      } else if (e.data === 'open-settings') {
        setShowSettings(true);
      } else if (e.data === 'refresh-iframe') {
        const iframe = document.getElementById('plugin-iframe') as HTMLIFrameElement;
        if (iframe) {
          const url = new URL(iframe.src);
          url.searchParams.set('t', Date.now().toString());
          iframe.src = url.toString();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    let interval: number;

    const checkStatus = async () => {
      try {
        const status = await invoke<string>('get_backend_status');
        
        if (status === 'running' || status === 'exited:0') {
          try {
            // Fallback 端口列表：实际端口由 config/webui 决定（默认 8681），
            // 此处扫描仅用于多实例或端口被占用时的兜底发现。
            const PORTS = [8681, 8682, 8683, 8684, 8685];
            
            const checkPort = async (port: number) => {
              const res = await fetch(`http://127.0.0.1:${port}/api/config`);
              if (res.ok) return port;
              throw new Error('Not ok');
            };

            const active = await Promise.any(PORTS.map(p => checkPort(p)));
            setActivePort(active);

            const setupRes = await fetch(`http://127.0.0.1:${active}/api/setup/status`);
            if (setupRes.ok) {
              const data = await setupRes.json();
              if (data.status === 'awaiting_config') {
                setAppState('setup');
              } else {
                setAppState('main');
              }
            } else {
              setAppState('main');
            }

            clearInterval(interval);
          } catch (e) {
            console.log("Waiting for backend API...", e);
          }
        }
      } catch (e) {
        console.error("Failed to check backend status:", e);
      }
    };

    interval = window.setInterval(checkStatus, 1000);
    checkStatus();

    return () => clearInterval(interval);
  }, []);

  const handleSetupComplete = async () => {
    try {
      await invoke('restart_backend');
    } catch (e) {
      console.error("Failed to restart backend:", e);
    }

    // 无论是否来自设置弹窗，都重启并重新加载
    if (showSettings) {
      setShowSettings(false);
    }
    setAppState('booting');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  return (
    <div className="shell-container" style={{ flexDirection: 'column' }}>
      {appState === 'booting' && <SplashScreen />}
      
      {appState === 'setup' && <SetupWizard onComplete={handleSetupComplete} port={activePort} />}
      
      {appState === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
          {/* Native Title Bar */}
          <div 
            data-tauri-drag-region 
            className="flex items-center shrink-0 border-b border-gray-200"
            style={{ height: '32px', paddingLeft: '16px', userSelect: 'none', backgroundColor: '#f9fafb' }}
          >
            <div className="flex items-center gap-3 pointer-events-none" style={{ flex: 1 }}>
              <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#2563eb' }}>
                <img src="/logo.png" alt="MoFox" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>MoFox Code</span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              style={{
                WebkitAppRegion: 'no-drag',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                marginRight: '8px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              } as React.CSSProperties}
              title="Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <WindowControls />
          </div>

          <div className="shell-main-content" style={{ flex: 1, position: 'relative' }}>
            <iframe
              id="plugin-iframe"
              src={`http://127.0.0.1:${activePort}/?embedded=1&t=${Date.now()}`} 
              className="plugin-iframe"
              title="MoFox Code WebUI"
              allow="clipboard-read; clipboard-write"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
            {showSettings && (
              <div 
                className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" 
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setShowSettings(false);
                }}
              >
                <div 
                  className="w-[95vw] max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" 
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/50 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">系统设置</h2>
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <SettingsModal port={activePort} onClose={() => setShowSettings(false)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {closing && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">正在关闭后端服务...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
