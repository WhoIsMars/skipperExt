// Content script per rilevare e controllare video
class UniversalVideoController {
  constructor() {
    this.video = null;
    this.lastVideoCheck = 0;
    this.overlayBar = null;
    this.isOverlayEnabled = true;
    this.setupMessageListener();
    this.loadOverlaySettings();
    this.findVideo();
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'skipTo') {
        this.skipToTime(request.seconds)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Per response asincrona
      } else if (request.action === 'goForward') {
        this.goForward(request.seconds)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Per response asincrona
      } else if (request.action === 'toggleOverlay') {
        this.toggleOverlay();
        sendResponse({ success: true, enabled: this.isOverlayEnabled });
      } else if (request.action === 'showOverlay') {
        this.showOverlay();
        sendResponse({ success: true });
      }
    });
  }
  
  findVideo() {
    // Cerca video con multiple strategie
    const strategies = [
      // Strategia 1: video HTML5 standard
      () => document.querySelector('video'),
      
      // Strategia 2: video in iframe (YouTube, Vimeo, etc.)
      () => {
        const iframes = document.querySelectorAll('iframe');
        for (let iframe of iframes) {
          try {
            const video = iframe.contentDocument?.querySelector('video');
            if (video) return video;
          } catch (e) {
            // Cross-origin iframe, non possiamo accedere
          }
        }
        return null;
      },
      
      // Strategia 3: video in shadow DOM
      () => {
        const elements = document.querySelectorAll('*');
        for (let el of elements) {
          if (el.shadowRoot) {
            const video = el.shadowRoot.querySelector('video');
            if (video) return video;
          }
        }
        return null;
      },
      
      // Strategia 4: video creati dinamicamente
      () => {
        const videos = document.getElementsByTagName('video');
        return videos.length > 0 ? videos[0] : null;
      },
      
      // Strategia 5: selettori specifici per player popolari
      () => {
        const selectors = [
          // YouTube
          '#movie_player video',
          '.video-stream',
          
          // Vimeo
          '.vp-video-wrapper video',
          '.vp-video video',
          
          // Twitch
          '.video-player video',
          
          // Netflix
          '.VideoContainer video',
          
          // Prime Video
          '.webPlayerContainer video',
          
          // Dailymotion
          '.dmp_VideoPlayer video',
          
          // Altadefinizione
          '#player video',
          '.player-container video',
          '.video-player-container video',
          '.altadefinizione-player video',
          '#vjs_video_3_html5_api',
          '.vjs-tech',
          
          // StreamingCommunity
          '.plyr__video-wrapper video',
          '.plyr__video',
          '#streamingcommunity-player video',
          '.sc-player video',
          '.streaming-player video',
          '.player-wrapper video',
          '#player-container video',
          '.video-container video',
          
          // Player Video.js (usato da molti siti streaming)
          '.video-js .vjs-tech',
          '.vjs-html5-video',
          
          // JWPlayer (comune sui siti streaming)
          '.jwplayer .jw-video video',
          '.jw-media video',
          
          // Altri player comuni sui siti streaming
          '.flowplayer video',
          '.fp-engine video',
          '.dplayer-video',
          '.aplayer-video',
          '#mediaelement video',
          '.mejs__player video',
          
          // Selettori generici per player embedati
          '.embed-responsive video',
          '.responsive-video video',
          '.video-embed video',
          
          // Altri player comuni
          '.jwplayer video',
          '.plyr video',
          '.video-js video'
        ];
        
        for (let selector of selectors) {
          const video = document.querySelector(selector);
          if (video) return video;
        }
        return null;
      },
      
      // Strategia 6: ricerca specifica per siti streaming italiani
      () => {
        // Controlla se siamo su Altadefinizione
        if (window.location.hostname.includes('altadefinizione') || 
            window.location.hostname.includes('altadefinizione01')) {
          
          // Cerca nei frame e iframe specifici di Altadefinizione
          const frames = document.querySelectorAll('iframe, frame');
          for (let frame of frames) {
            try {
              const frameDoc = frame.contentDocument || frame.contentWindow?.document;
              if (frameDoc) {
                const video = frameDoc.querySelector('video') || 
                            frameDoc.querySelector('#player video') ||
                            frameDoc.querySelector('.vjs-tech');
                if (video) return video;
              }
            } catch (e) {
              // Cross-origin frame
            }
          }
          
          // Cerca nei container comuni di Altadefinizione
          const containers = [
            '#player',
            '.player',
            '.video-player',
            '#video-player',
            '.player-container'
          ];
          
          for (let container of containers) {
            const element = document.querySelector(container);
            if (element) {
              const video = element.querySelector('video') || 
                          element.querySelector('.vjs-tech') ||
                          element.querySelector('#vjs_video_3_html5_api');
              if (video) return video;
            }
          }
        }
        
        // Controlla se siamo su StreamingCommunity
        if (window.location.hostname.includes('streamingcommunity')) {
          
          // Cerca player Plyr (comune su StreamingCommunity)
          const plyrVideo = document.querySelector('.plyr video') || 
                           document.querySelector('.plyr__video') ||
                           document.querySelector('.plyr__video-wrapper video');
          if (plyrVideo) return plyrVideo;
          
          // Cerca nei container specifici
          const scContainers = [
            '.player-container',
            '.video-player-container', 
            '#video-container',
            '.streaming-player',
            '.sc-player-wrapper'
          ];
          
          for (let container of scContainers) {
            const element = document.querySelector(container);
            if (element) {
              const video = element.querySelector('video');
              if (video) return video;
            }
          }
        }
        
        return null;
      }
    ];
    
    // Prova ogni strategia
    for (let strategy of strategies) {
      try {
        const video = strategy();
        if (video && video.duration) {
          this.video = video;
          this.setupVideoListeners();
          console.log('Universal Video Controller: Video trovato', video);
          return;
        }
      } catch (e) {
        // Strategia fallita, prova la prossima
      }
    }
    
    // Se non trova video, riprova dopo un po'
    const now = Date.now();
    if (now - this.lastVideoCheck > 2000) { // Ogni 2 secondi max
      this.lastVideoCheck = now;
      setTimeout(() => this.findVideo(), 1000);
    }
  }
  
  setupVideoListeners() {
    if (!this.video) return;
    
    // Re-cerca video se quello corrente viene rimosso
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.video)) {
        this.video = null;
        this.findVideo();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Ascolta eventi del video per re-rilevamento
    this.video.addEventListener('loadstart', () => {
      setTimeout(() => this.findVideo(), 500);
    });
  }
  
  async skipToTime(seconds) {
    if (!this.video) {
      this.findVideo(); // Riprova a trovare il video
      if (!this.video) {
        throw new Error('Nessun video trovato nella pagina');
      }
    }
    
    try {
      // Verifica che il video sia pronto
      if (this.video.duration === 0 || isNaN(this.video.duration)) {
        // Aspetta che il video sia caricato
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout caricamento video')), 5000);
          
          const checkReady = () => {
            if (this.video.duration > 0) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          
          checkReady();
        });
      }
      
      // Limita il tempo alla durata del video
      const targetTime = Math.min(seconds, this.video.duration);
      
      this.video.currentTime = targetTime;
      
      return {
        success: true,
        message: `Video portato al secondo ${targetTime}`
      };
      
    } catch (error) {
      throw new Error(`Errore nel controllare il video: ${error.message}`);
    }
  }
  
  // Gestione overlay bar
  loadOverlaySettings() {
    chrome.storage.sync.get(['overlayEnabled'], (result) => {
      this.isOverlayEnabled = result.overlayEnabled !== false; // Default true
    });
  }
  
  createOverlayBar() {
    if (!this.isOverlayEnabled || this.overlayBar) return;
    
    // Carica i valori salvati
    chrome.storage.sync.get(['savedTime', 'savedDuration'], (result) => {
      const savedTime = result.savedTime || '';
      const savedDuration = result.savedDuration || '';
      
      // Crea la barra overlay
      this.overlayBar = document.createElement('div');
      this.overlayBar.id = 'uvc-overlay-bar';
      this.overlayBar.innerHTML = `
        <div class="uvc-bar-content">
          <div class="uvc-bar-header">
            <span>🎥 Video Controller</span>
            <button class="uvc-close-btn" title="Chiudi barra">×</button>
          </div>
          <div class="uvc-bar-controls">
            <div class="uvc-input-group">
              <input type="text" id="uvc-time-input" placeholder="2:33" value="${savedTime}">
              <button id="uvc-skip-btn" class="uvc-btn uvc-skip">Skip to</button>
            </div>
            <div class="uvc-input-group">
              <input type="text" id="uvc-duration-input" placeholder="1m 30s" value="${savedDuration}">
              <button id="uvc-forward-btn" class="uvc-btn uvc-forward">Go forward</button>
            </div>
          </div>
        </div>
      `;
      
      // Stili CSS
      const style = document.createElement('style');
      style.textContent = `
        #uvc-overlay-bar {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 999999 !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          box-shadow: 0 2px 15px rgba(0,0,0,0.3) !important;
          border-bottom: 1px solid rgba(255,255,255,0.2) !important;
          backdrop-filter: blur(10px) !important;
          animation: uvcSlideDown 0.3s ease-out !important;
        }
        
        @keyframes uvcSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes uvcSlideUp {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }
        
        .uvc-bar-content {
          max-width: 1200px !important;
          margin: 0 auto !important;
          padding: 8px 16px !important;
        }
        
        .uvc-bar-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 8px !important;
        }
        
        .uvc-bar-header span {
          font-weight: 600 !important;
          font-size: 14px !important;
        }
        
        .uvc-close-btn {
          background: rgba(255,255,255,0.2) !important;
          border: none !important;
          color: white !important;
          width: 24px !important;
          height: 24px !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          font-size: 16px !important;
          font-weight: bold !important;
          line-height: 1 !important;
          transition: all 0.2s !important;
        }
        
        .uvc-close-btn:hover {
          background: rgba(255,255,255,0.3) !important;
          transform: scale(1.1) !important;
        }
        
        .uvc-bar-controls {
          display: flex !important;
          gap: 16px !important;
          flex-wrap: wrap !important;
        }
        
        .uvc-input-group {
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
        }
        
        .uvc-input-group input {
          padding: 6px 12px !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          border-radius: 20px !important;
          background: rgba(255,255,255,0.15) !important;
          color: white !important;
          font-size: 12px !important;
          width: 80px !important;
          backdrop-filter: blur(10px) !important;
        }
        
        .uvc-input-group input::placeholder {
          color: rgba(255,255,255,0.7) !important;
        }
        
        .uvc-input-group input:focus {
          outline: none !important;
          border-color: rgba(255,255,255,0.6) !important;
          background: rgba(255,255,255,0.25) !important;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.2) !important;
        }
        
        .uvc-btn {
          padding: 6px 14px !important;
          border: none !important;
          border-radius: 20px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
          white-space: nowrap !important;
        }
        
        .uvc-skip {
          background: rgba(66, 133, 244, 0.9) !important;
          color: white !important;
        }
        
        .uvc-forward {
          background: rgba(52, 168, 83, 0.9) !important;
          color: white !important;
        }
        
        .uvc-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        
        .uvc-btn:active {
          transform: translateY(0) !important;
        }
        
        @media (max-width: 768px) {
          .uvc-bar-controls {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .uvc-input-group {
            justify-content: center !important;
          }
        }
      `;
      
      // Aggiungi stili e barra al DOM
      document.head.appendChild(style);
      document.body.appendChild(this.overlayBar);
      
      this.setupOverlayListeners();
    });
  }
  
  setupOverlayListeners() {
    if (!this.overlayBar) return;
    
    const timeInput = this.overlayBar.querySelector('#uvc-time-input');
    const durationInput = this.overlayBar.querySelector('#uvc-duration-input');
    const skipBtn = this.overlayBar.querySelector('#uvc-skip-btn');
    const forwardBtn = this.overlayBar.querySelector('#uvc-forward-btn');
    const closeBtn = this.overlayBar.querySelector('.uvc-close-btn');
    
    // Salvataggio automatico
    timeInput.addEventListener('input', (e) => {
      chrome.storage.sync.set({ savedTime: e.target.value });
    });
    
    durationInput.addEventListener('input', (e) => {
      chrome.storage.sync.set({ savedDuration: e.target.value });
    });
    
    // Funzioni di conversione (duplicate per l'overlay)
    const timeToSeconds = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      let seconds = 0;
      if (parts.length === 1) {
        seconds = parseInt(parts[0]) || 0;
      } else if (parts.length === 2) {
        seconds = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      } else if (parts.length === 3) {
        seconds = (parseInt(parts[0]) || 0) * 3600 + 
                  (parseInt(parts[1]) || 0) * 60 + 
                  (parseInt(parts[2]) || 0);
      }
      return seconds;
    };
    
    const durationToSeconds = (durationStr) => {
      if (!durationStr) return 0;
      let seconds = 0;
      const str = durationStr.toLowerCase();
      const minMatch = str.match(/(\d+)m/);
      if (minMatch) seconds += parseInt(minMatch[1]) * 60;
      const secMatch = str.match(/(\d+)s/);
      if (secMatch) seconds += parseInt(secMatch[1]);
      if (seconds === 0) {
        const numMatch = str.match(/(\d+)/);
        if (numMatch) seconds = parseInt(numMatch[1]);
      }
      return seconds;
    };
    
    // Eventi dei pulsanti
    skipBtn.addEventListener('click', () => {
      const seconds = timeToSeconds(timeInput.value);
      if (seconds >= 0) {
        this.skipToTime(seconds);
      }
    });
    
    forwardBtn.addEventListener('click', () => {
      const seconds = durationToSeconds(durationInput.value);
      if (seconds > 0) {
        this.goForward(seconds);
      }
    });
    
    // Chiusura della barra
    closeBtn.addEventListener('click', () => {
      this.hideOverlay();
    });
  }
  
  showOverlay() {
    if (!this.video || !this.isOverlayEnabled) return;
    
    if (!this.overlayBar) {
      this.createOverlayBar();
    } else {
      this.overlayBar.style.display = 'block';
      this.overlayBar.style.animation = 'uvcSlideDown 0.3s ease-out';
    }
  }
  
  hideOverlay() {
    if (this.overlayBar) {
      this.overlayBar.style.animation = 'uvcSlideUp 0.3s ease-out';
      setTimeout(() => {
        if (this.overlayBar) {
          this.overlayBar.style.display = 'none';
        }
      }, 300);
    }
  }
  
  toggleOverlay() {
    this.isOverlayEnabled = !this.isOverlayEnabled;
    chrome.storage.sync.set({ overlayEnabled: this.isOverlayEnabled });
    
    if (this.isOverlayEnabled && this.video) {
      this.showOverlay();
    } else {
      this.hideOverlay();
    }
  }
  
  async goForward(seconds) {
    if (!this.video) {
      this.findVideo();
      if (!this.video) {
        throw new Error('Nessun video trovato nella pagina');
      }
    }
    
    try {
      const currentTime = this.video.currentTime;
      const newTime = Math.min(currentTime + seconds, this.video.duration);
      
      this.video.currentTime = newTime;
      
      return {
        success: true,
        message: `Video avanzato di ${seconds} secondi`
      };
      
    } catch (error) {
      throw new Error(`Errore nel controllare il video: ${error.message}`);
    }
  }
}

// Inizializza il controller quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UniversalVideoController();
  });
} else {
  new UniversalVideoController();
}

// Inizializza anche dopo un breve ritardo per video caricati dinamicamente
setTimeout(() => {
  new UniversalVideoController();
}, 1000);