// Content script per rilevare e controllare video
class UniversalVideoController {
  constructor() {
    this.video = null;
    this.lastVideoCheck = 0;
    this.overlayBar = null;
    this.isOverlayEnabled = true;
    this.videoObserver = null;
    this.retryCount = 0;
    this.maxRetries = 20;
    this.isOverlayVisible = false;
    this.setupMessageListener();
    this.loadOverlaySettings();
    this.init();
  }
  
  init() {
    // Attende il caricamento completo della pagina
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.startVideoDetection(), 1000);
      });
    } else {
      setTimeout(() => this.startVideoDetection(), 1000);
    }
  }
  
  startVideoDetection() {
    this.findVideo();
    this.setupAdvancedVideoDetection();
    this.setupNavigationHandling();
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'skipTo') {
        this.skipToTime(request.seconds)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      } else if (request.action === 'goForward') {
        this.goForward(request.seconds)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      } else if (request.action === 'toggleOverlay') {
        this.toggleOverlay();
        sendResponse({ success: true, enabled: this.isOverlayEnabled });
      } else if (request.action === 'showOverlay') {
        this.showOverlayBar();
        sendResponse({ success: true });
      }
    });
  }
  
  setupNavigationHandling() {
    // Gestisce navigazione SPA
    let currentUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        this.video = null;
        this.hideOverlayBar();
        setTimeout(() => this.findVideo(), 2000);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });
    
    // Gestisce eventi di navigazione
    window.addEventListener('popstate', () => {
      this.video = null;
      this.hideOverlayBar();
      setTimeout(() => this.findVideo(), 2000);
    });
  }
  
  setupAdvancedVideoDetection() {
    // Observer per modifiche DOM
    if (this.videoObserver) {
      this.videoObserver.disconnect();
    }
    
    this.videoObserver = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.tagName === 'VIDEO' || 
                node.tagName === 'IFRAME' ||
                (node.querySelector && (node.querySelector('video') || node.querySelector('iframe[src*="player"]')))) {
              shouldRecheck = true;
            }
          }
        });
      });
      
      if (shouldRecheck && (!this.video || !document.body.contains(this.video))) {
        clearTimeout(this.recheckTimeout);
        this.recheckTimeout = setTimeout(() => this.findVideo(), 1000);
      }
    });
    
    this.videoObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // Controllo periodico per video caricati dinamicamente
    this.periodicCheck = setInterval(() => {
      if (!this.video || !document.body.contains(this.video) || !this.isValidVideo(this.video)) {
        this.findVideo();
      }
    }, 3000);
  }
  
  findVideo() {
    console.log('🔍 Ricerca video su:', window.location.hostname);
    
    const hostname = window.location.hostname.toLowerCase();
    
    // Reset retry count se è passato troppo tempo
    const now = Date.now();
    if (now - this.lastVideoCheck > 30000) {
      this.retryCount = 0;
    }
    this.lastVideoCheck = now;
    
    // Strategie specifiche per dominio
    if (hostname.includes('altadefinizione')) {
      this.findAltadefinzioneVideo();
    } else if (hostname.includes('streamingunity') || hostname.includes('streamingcommunity')) {
      this.findStreamingCommunityVideo();
    } else {
      this.findGenericVideo();
    }
    
    // Se non trova video, usa strategie generiche
    if (!this.video) {
      this.findGenericVideo();
    }
    
    // Ricerca avanzata se ancora non trova
    if (!this.video && this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`🔄 Tentativo ${this.retryCount}/${this.maxRetries} di trovare video...`);
      setTimeout(() => this.advancedVideoSearch(), 1500);
    }
    
    if (this.video) {
      console.log('✅ Video trovato:', this.video);
      this.setupVideoListeners();
      this.retryCount = 0;
      
      if (this.isOverlayEnabled) {
        setTimeout(() => this.showOverlayBar(), 1500);
      }
    } else if (this.retryCount >= this.maxRetries) {
      console.log('❌ Massimo numero di tentativi raggiunto');
    }
  }
  
  findAltadefinzioneVideo() {
    console.log('🎬 Ricerca video Altadefinizione...');
    
    const selectors = [
      // Player VideoJS comuni
      '.video-js video',
      '.vjs-tech',
      '.vjs-html5-video',
      'video.vjs-tech',
      '#vjs_video_3_html5_api',
      
      // Container principali
      '#player video',
      '.player video',
      '.player-container video',
      '.video-player-container video',
      '#video-container video',
      '.video-container video',
      
      // Player JWPlayer
      '.jwplayer video',
      '.jw-video video',
      '.jw-media video',
      '.jwplayer .jw-video',
      
      // Player Plyr
      '.plyr video',
      '.plyr__video',
      '.plyr__video-wrapper video',
      
      // Altri player comuni
      '.dplayer-video',
      '.flowplayer video',
      '.fp-engine',
      
      // Selettori più generici ma specifici per streaming
      'video[src*=".mp4"]',
      'video[src*=".m3u8"]',
      'video[src*=".webm"]',
      'video[data-setup]',
      'video[controls]',
      'video[autoplay]',
      
      // Iframe player
      'iframe[src*="player"]',
      'iframe[src*="embed"]'
    ];
    
    // Cerca con selettori standard
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element.tagName === 'VIDEO' && this.isValidVideo(element)) {
            this.video = element;
            return;
          } else if (element.tagName === 'IFRAME') {
            this.searchInFrame(element);
            if (this.video) return;
          }
        }
      } catch (e) {
        console.log('Errore selettore:', selector, e);
      }
    }
    
    // Ricerca in tutti gli iframe
    this.searchInAllFrames();
    
    // Attesa per caricamento dinamico specifico per Altadefinizione
    if (!this.video) {
      setTimeout(() => this.waitForAltadefinzioneVideo(), 2000);
    }
  }
  
  waitForAltadefinzioneVideo() {
    let attempts = 0;
    const maxAttempts = 15;
    
    const checkVideo = () => {
      attempts++;
      console.log(`Altadefinizione check attempt ${attempts}/${maxAttempts}`);
      
      // Cerca video con attributi che indicano streaming attivo
      const specificSelectors = [
        'video[src]:not([src=""])',
        'video[currentSrc]:not([currentSrc=""])',
        '.vjs-tech[src]:not([src=""])',
        'video.vjs-tech:not([src=""])',
        '.video-js .vjs-tech',
        'video[data-setup]:not([data-setup=""])'
      ];
      
      for (const selector of specificSelectors) {
        try {
          const video = document.querySelector(selector);
          if (video && this.isValidVideo(video)) {
            console.log('✅ Video Altadefinizione trovato con:', selector);
            this.video = video;
            this.setupVideoListeners();
            if (this.isOverlayEnabled) {
              setTimeout(() => this.showOverlayBar(), 500);
            }
            return;
          }
        } catch (e) {
          console.log('Errore:', e);
        }
      }
      
      // Controlla anche eventi di caricamento video
      const allVideos = document.querySelectorAll('video');
      for (const video of allVideos) {
        if (this.isVideoLoading(video)) {
          console.log('🕒 Video in caricamento rilevato, aspetto...');
          this.video = video;
          this.waitForVideoReady(video);
          return;
        }
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkVideo, 2000);
      }
    };
    
    checkVideo();
  }
  
  findStreamingCommunityVideo() {
    console.log('🎬 Ricerca video StreamingCommunity...');
    
    const selectors = [
      // Player Plyr (molto comune su StreamingCommunity)
      '.plyr video',
      '.plyr__video',
      '.plyr__video-wrapper video',
      '.plyr-container video',
      '.plyr__video-embed video',
      
      // VideoJS
      '.video-js video',
      '.vjs-tech',
      'video.vjs-tech',
      
      // Container specifici StreamingCommunity
      '.player-container video',
      '.video-player-container video',
      '#video-container video',
      '.streaming-player video',
      '.sc-player video',
      '#player video',
      '.embed-player video',
      
      // JWPlayer
      '.jwplayer video',
      '.jw-video video',
      '.jw-media video',
      
      // Altri player
      '.dplayer-video',
      '.flowplayer video',
      '.clappr-container video',
      
      // Selettori con attributi specifici
      'video[src*=".m3u8"]',
      'video[src*=".mp4"]',
      'video[data-src]',
      'video[controls]',
      'video[autoplay]',
      'video[preload]',
      
      // Iframe embedded
      'iframe[src*="player"]',
      'iframe[src*="embed"]',
      'iframe[src*="stream"]'
    ];
    
    // Cerca con tutti i selettori
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element.tagName === 'VIDEO' && this.isValidVideo(element)) {
            this.video = element;
            return;
          } else if (element.tagName === 'IFRAME') {
            this.searchInFrame(element);
            if (this.video) return;
          }
        }
      } catch (e) {
        console.log('Errore selettore:', selector, e);
      }
    }
    
    // Ricerca in iframe
    this.searchInAllFrames();
    
    // Attesa specifica per StreamingCommunity
    if (!this.video) {
      setTimeout(() => this.waitForStreamingVideo(), 3000);
    }
  }
  
  waitForStreamingVideo() {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkVideo = () => {
      attempts++;
      console.log(`StreamingCommunity check attempt ${attempts}/${maxAttempts}`);
      
      // Controlla tutti i video nella pagina con condizioni più flessibili
      const allVideos = document.querySelectorAll('video');
      for (const video of allVideos) {
        // Accetta video anche se non ancora completamente caricati
        if (video && (
          video.src || 
          video.currentSrc || 
          video.querySelector('source') ||
          video.readyState > 0 ||
          video.duration > 0 ||
          this.isVideoLoading(video)
        )) {
          console.log('✅ Video StreamingCommunity trovato:', video);
          this.video = video;
          this.setupVideoListeners();
          if (this.isOverlayEnabled) {
            setTimeout(() => this.showOverlayBar(), 500);
          }
          return;
        }
      }
      
      // Controlla anche player specifici che potrebbero apparire
      const dynamicSelectors = [
        '.plyr__video-wrapper video',
        '.video-js .vjs-tech',
        'video[data-plyr-provider]'
      ];
      
      for (const selector of dynamicSelectors) {
        try {
          const video = document.querySelector(selector);
          if (video) {
            console.log('✅ Video dinamico trovato con:', selector);
            this.video = video;
            this.setupVideoListeners();
            if (this.isOverlayEnabled) {
              setTimeout(() => this.showOverlayBar(), 500);
            }
            return;
          }
        } catch (e) {
          console.log('Errore selettore dinamico:', e);
        }
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkVideo, 2000);
      }
    };
    
    checkVideo();
  }
  
  searchInAllFrames() {
    const frames = document.querySelectorAll('iframe, frame, embed, object');
    
    for (const frame of frames) {
      this.searchInFrame(frame);
      if (this.video) return;
    }
  }
  
  searchInFrame(frame) {
    try {
      let frameDoc = null;
      
      if (frame.contentDocument) {
        frameDoc = frame.contentDocument;
      } else if (frame.contentWindow && frame.contentWindow.document) {
        frameDoc = frame.contentWindow.document;
      }
      
      if (frameDoc) {
        const video = frameDoc.querySelector('video');
        if (video && this.isValidVideo(video)) {
          console.log('✅ Video trovato in iframe:', frame);
          this.video = video;
          return true;
        }
        
        // Cerca anche in nested frames
        const nestedFrames = frameDoc.querySelectorAll('iframe, frame');
        for (const nestedFrame of nestedFrames) {
          if (this.searchInFrame(nestedFrame)) return true;
        }
      }
    } catch (e) {
      // Frame cross-origin o altri errori di accesso
      console.log('Frame non accessibile:', frame.src || frame.id || 'unknown');
    }
    
    return false;
  }
  
  findGenericVideo() {
    const selectors = [
      'video',
      '#movie_player video',
      '.video-stream',
      '.vp-video-wrapper video',
      '.VideoContainer video',
      '.webPlayerContainer video',
      '.video-player video',
      '.dmp_VideoPlayer video',
      '.video-js video',
      '.jwplayer video',
      '.plyr video',
      '.flowplayer video'
    ];
    
    for (const selector of selectors) {
      try {
        const video = document.querySelector(selector);
        if (video && this.isValidVideo(video)) {
          this.video = video;
          return;
        }
      } catch (e) {
        console.log('Errore selettore generico:', selector, e);
      }
    }
  }
  
  advancedVideoSearch() {
    console.log('🔍 Ricerca avanzata video...');
    
    // Cerca in shadow DOM
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        try {
          const video = el.shadowRoot.querySelector('video');
          if (video && this.isValidVideo(video)) {
            this.video = video;
            return;
          }
        } catch (e) {
          console.log('Errore shadow DOM:', e);
        }
      }
    }
    
    // Cerca tutti i video, anche quelli non validi per vedere se stanno caricando
    const allVideos = document.getElementsByTagName('video');
    for (const video of allVideos) {
      if (this.isVideoLoading(video)) {
        console.log('🕒 Video in caricamento trovato:', video);
        this.video = video;
        this.waitForVideoReady(video);
        return;
      }
    }
  }
  
  isValidVideo(video) {
    if (!video || video.tagName !== 'VIDEO') return false;
    
    // Video è valido se ha una sorgente o sta caricando
    return video.duration > 0 || 
           video.readyState > 0 || 
           video.src || 
           video.currentSrc ||
           video.querySelector('source') ||
           video.hasAttribute('data-setup') ||
           this.isVideoLoading(video);
  }
  
  isVideoLoading(video) {
    if (!video || video.tagName !== 'VIDEO') return false;
    
    // Controlla se il video sta caricando
    return video.networkState === video.NETWORK_LOADING ||
           video.readyState === video.HAVE_FUTURE_DATA ||
           video.readyState === video.HAVE_ENOUGH_DATA ||
           (video.hasAttribute('src') && video.src !== '') ||
           (video.hasAttribute('data-src') && video.getAttribute('data-src') !== '') ||
           video.querySelector('source') !== null;
  }
  
  setupVideoListeners() {
    if (!this.video) return;
    
    // Observer per rimozione video
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.video)) {
        console.log('📹 Video rimosso, ricerca nuovo...');
        this.video = null;
        this.hideOverlayBar();
        setTimeout(() => this.findVideo(), 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Eventi del video
    this.video.addEventListener('loadstart', () => {
      console.log('📹 Video loadstart');
    });
    
    this.video.addEventListener('canplay', () => {
      console.log('📹 Video can play');
      if (this.isOverlayEnabled && !this.isOverlayVisible) {
        setTimeout(() => this.showOverlayBar(), 1000);
      }
    });
    
    this.video.addEventListener('loadeddata', () => {
      console.log('📹 Video loaded data');
      if (this.isOverlayEnabled && !this.isOverlayVisible) {
        setTimeout(() => this.showOverlayBar(), 500);
      }
    });
  }
  
  async waitForVideoReady(video = this.video) {
    return new Promise((resolve, reject) => {
      if (!video) {
        reject(new Error('Nessun video fornito'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: video non pronto'));
      }, 15000);
      
      const checkReady = () => {
        if (this.isValidVideo(video) && (video.duration > 0 || video.readyState >= 2)) {
          clearTimeout(timeout);
          resolve(video);
        } else {
          setTimeout(checkReady, 300);
        }
      };
      
      if (this.isValidVideo(video) && (video.duration > 0 || video.readyState >= 2)) {
        clearTimeout(timeout);
        resolve(video);
      } else {
        checkReady();
      }
    });
  }
  
  async skipToTime(seconds) {
    if (!this.video) {
      this.findVideo();
      if (!this.video) {
        throw new Error('Nessun video trovato nella pagina');
      }
    }
    
    try {
      // Aspetta che il video sia pronto se necessario
      if (!this.isValidVideo(this.video) || this.video.duration === 0) {
        await this.waitForVideoReady();
      }
      
      const targetTime = Math.min(Math.max(0, seconds), this.video.duration || seconds);
      this.video.currentTime = targetTime;
      
      // Aggiorna overlay se presente
      this.updateOverlayStatus(`⏭️ Video portato a ${this.formatTime(targetTime)}`);
      
      return {
        success: true,
        message: `Video portato al secondo ${targetTime}`
      };
      
    } catch (error) {
      throw new Error(`Errore nel controllare il video: ${error.message}`);
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
      if (!this.isValidVideo(this.video)) {
        await this.waitForVideoReady();
      }
      
      const currentTime = this.video.currentTime || 0;
      const newTime = Math.min(currentTime + seconds, this.video.duration || (currentTime + seconds));
      this.video.currentTime = newTime;
      
      // Aggiorna overlay se presente
      this.updateOverlayStatus(`⏩ Avanzato di ${seconds}s`);
      
      return {
        success: true,
        message: `Video avanzato di ${seconds} secondi`
      };
      
    } catch (error) {
      throw new Error(`Errore nel controllare il video: ${error.message}`);
    }
  }
  
  // === GESTIONE OVERLAY ===
  
  loadOverlaySettings() {
    chrome.storage.sync.get(['overlayEnabled'], (result) => {
      this.isOverlayEnabled = result.overlayEnabled !== false;
    });
  }
  
  toggleOverlay() {
    this.isOverlayEnabled = !this.isOverlayEnabled;
    chrome.storage.sync.set({ overlayEnabled: this.isOverlayEnabled });
    
    if (this.isOverlayEnabled && this.video) {
      this.showOverlayBar();
    } else {
      this.hideOverlayBar();
    }
  }
  
  showOverlayBar() {
    if (!this.isOverlayEnabled || this.isOverlayVisible || !this.video) return;
    
    this.createOverlayBar();
    this.isOverlayVisible = true;
  }
  
  hideOverlayBar() {
    if (this.overlayBar) {
      this.overlayBar.style.animation = 'uvcSlideUp 0.3s ease-in forwards';
      setTimeout(() => {
        if (this.overlayBar && this.overlayBar.parentNode) {
          this.overlayBar.parentNode.removeChild(this.overlayBar);
        }
        this.overlayBar = null;
        this.isOverlayVisible = false;
      }, 300);
    }
  }
  
  createOverlayBar() {
    if (this.overlayBar) return;
    
    chrome.storage.sync.get(['savedTime', 'savedDuration'], (result) => {
      const savedTime = result.savedTime || '';
      const savedDuration = result.savedDuration || '';
      
      this.overlayBar = document.createElement('div');
      this.overlayBar.id = 'uvc-overlay-bar';
      this.overlayBar.innerHTML = `
        <div class="uvc-bar-content">
          <div class="uvc-bar-header">
            <span class="uvc-title">🎥 Skipper Ext</span>
            <button class="uvc-close-btn" title="Chiudi barra">×</button>
          </div>
          <div class="uvc-bar-controls">
            <div class="uvc-input-group">
              <input type="text" id="uvc-time-input" placeholder="2:33" value="${savedTime}" title="Formato: mm:ss o hh:mm:ss">
              <button id="uvc-skip-btn" class="uvc-btn uvc-skip" title="Vai al minutaggio specificato">⏭️ Skip</button>
            </div>
            <div class="uvc-input-group">
              <input type="text" id="uvc-duration-input" placeholder="1m 30s" value="${savedDuration}" title="Formato: 1m 30s o 90s">
              <button id="uvc-forward-btn" class="uvc-btn uvc-forward" title="Avanza della durata specificata">⏩ Forward</button>
            </div>
          </div>
          <div id="uvc-status" class="uvc-status">✅ Video rilevato - Pronto per il controllo</div>
        </div>
      `;
      
      this.addOverlayStyles();
      document.body.appendChild(this.overlayBar);
      this.setupOverlayListeners();
      
      // Animazione di entrata
      setTimeout(() => {
        if (this.overlayBar) {
          this.overlayBar.style.transform = 'translateY(0)';
          this.overlayBar.style.opacity = '1';
        }
      }, 50);
    });
  }
  
  addOverlayStyles() {
    if (document.getElementById('uvc-overlay-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'uvc-overlay-styles';
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
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        border-bottom: 1px solid rgba(255,255,255,0.2) !important;
        backdrop-filter: blur(10px) !important;
        transform: translateY(-100%) !important;
        opacity: 0 !important;
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
      }
      
      @keyframes uvcSlideUp {
        from { 
          transform: translateY(0); 
          opacity: 1; 
        }
        to { 
          transform: translateY(-100%); 
          opacity: 0; 
        }
      }
      
      .uvc-bar-content {
        max-width: 1200px !important;
        margin: 0 auto !important;
        padding: 14px 20px !important;
      }
      
      .uvc-bar-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 12px !important;
      }
      
      .uvc-title {
        font-weight: 600 !important;
        font-size: 15px !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
      }
      
      .uvc-close-btn {
        background: rgba(255,255,255,0.2) !important;
        border: none !important;
        color: white !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 14px !important;
        cursor: pointer !important;
        font-size: 16px !important;
        font-weight: bold !important;
        line-height: 1 !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .uvc-close-btn:hover {
        background: rgba(255,0,0,0.8) !important;
        transform: scale(1.1) rotate(90deg) !important;
      }
      
      .uvc-bar-controls {
        display: flex !important;
        gap: 16px !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        }
      
      .uvc-input-group {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        flex: 1 !important;
        min-width: 200px !important;
      }
      
      .uvc-input-group input {
        flex: 1 !important;
        padding: 8px 12px !important;
        border: none !important;
        border-radius: 6px !important;
        background: rgba(255,255,255,0.9) !important;
        color: #333 !important;
        font-size: 14px !important;
        outline: none !important;
        transition: all 0.2s ease !important;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.1) !important;
      }
      
      .uvc-input-group input:focus {
        background: white !important;
        box-shadow: 0 0 0 2px rgba(255,255,255,0.5) !important;
        transform: scale(1.02) !important;
      }
      
      .uvc-input-group input::placeholder {
        color: #888 !important;
        opacity: 1 !important;
      }
      
      .uvc-btn {
        padding: 8px 16px !important;
        border: none !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
      }
      
      .uvc-skip {
        background: linear-gradient(135deg, #ff6b6b, #ee5a24) !important;
        color: white !important;
      }
      
      .uvc-forward {
        background: linear-gradient(135deg, #4ecdc4, #44a08d) !important;
        color: white !important;
      }
      
      .uvc-btn:hover {
        transform: translateY(-1px) scale(1.05) !important;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
      }
      
      .uvc-btn:active {
        transform: translateY(0) scale(0.98) !important;
      }
      
      .uvc-status {
        text-align: center !important;
        font-size: 13px !important;
        margin-top: 10px !important;
        padding: 6px 12px !important;
        background: rgba(255,255,255,0.15) !important;
        border-radius: 4px !important;
        border-left: 3px solid #4ecdc4 !important;
        backdrop-filter: blur(5px) !important;
      }
      
      @media (max-width: 768px) {
        .uvc-bar-controls {
          flex-direction: column !important;
          gap: 10px !important;
        }
        
        .uvc-input-group {
          min-width: unset !important;
          width: 100% !important;
        }
        
        .uvc-bar-content {
          padding: 12px 16px !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  setupOverlayListeners() {
    if (!this.overlayBar) return;
    
    // Bottone chiudi
    const closeBtn = this.overlayBar.querySelector('.uvc-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideOverlayBar();
      });
    }
    
    // Input time - salva automaticamente
    const timeInput = this.overlayBar.querySelector('#uvc-time-input');
    if (timeInput) {
      timeInput.addEventListener('input', () => {
        chrome.storage.sync.set({ savedTime: timeInput.value });
      });
      
      timeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.overlayBar.querySelector('#uvc-skip-btn').click();
        }
      });
    }
    
    // Input duration - salva automaticamente
    const durationInput = this.overlayBar.querySelector('#uvc-duration-input');
    if (durationInput) {
      durationInput.addEventListener('input', () => {
        chrome.storage.sync.set({ savedDuration: durationInput.value });
      });
      
      durationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.overlayBar.querySelector('#uvc-forward-btn').click();
        }
      });
    }
    
    // Bottone Skip
    const skipBtn = this.overlayBar.querySelector('#uvc-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', async () => {
        const timeInput = this.overlayBar.querySelector('#uvc-time-input');
        const timeStr = timeInput.value.trim();
        
        if (!timeStr) {
          this.updateOverlayStatus('⚠️ Inserisci un minutaggio (es: 2:30)', 'error');
          return;
        }
        
        try {
          const seconds = this.parseTimeToSeconds(timeStr);
          this.updateOverlayStatus('🔄 Esecuzione skip...', 'loading');
          
          const result = await this.skipToTime(seconds);
          if (result.success) {
            this.updateOverlayStatus(`✅ ${result.message}`, 'success');
          }
        } catch (error) {
          this.updateOverlayStatus(`❌ ${error.message}`, 'error');
        }
      });
    }
    
    // Bottone Forward
    const forwardBtn = this.overlayBar.querySelector('#uvc-forward-btn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', async () => {
        const durationInput = this.overlayBar.querySelector('#uvc-duration-input');
        const durationStr = durationInput.value.trim();
        
        if (!durationStr) {
          this.updateOverlayStatus('⚠️ Inserisci una durata (es: 1m 30s)', 'error');
          return;
        }
        
        try {
          const seconds = this.parseDurationToSeconds(durationStr);
          this.updateOverlayStatus('🔄 Esecuzione avanzamento...', 'loading');
          
          const result = await this.goForward(seconds);
          if (result.success) {
            this.updateOverlayStatus(`✅ ${result.message}`, 'success');
          }
        } catch (error) {
          this.updateOverlayStatus(`❌ ${error.message}`, 'error');
        }
      });
    }
  }
  
  updateOverlayStatus(message, type = 'info') {
    const statusEl = this.overlayBar?.querySelector('#uvc-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `uvc-status uvc-status-${type}`;
    
    // Aggiungi stili per i diversi tipi di stato
    const colors = {
      success: '#4ecdc4',
      error: '#ff6b6b',
      loading: '#f39c12',
      info: '#4ecdc4'
    };
    
    statusEl.style.borderLeftColor = colors[type] || colors.info;
    
    // Reset automatico dopo qualche secondo per messaggi di successo/errore
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        if (statusEl && this.video) {
          statusEl.textContent = '✅ Video rilevato - Pronto per il controllo';
          statusEl.className = 'uvc-status';
          statusEl.style.borderLeftColor = '#4ecdc4';
        }
      }, 3000);
    }
  }
  
  // Utility functions per parsing tempo e durata
  parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(p => parseInt(p.trim()));
    
    if (parts.length === 2) {
      // mm:ss
      const [minutes, seconds] = parts;
      if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
        throw new Error('Formato tempo non valido. Usa mm:ss (es: 2:30)');
      }
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      // hh:mm:ss
      const [hours, minutes, seconds] = parts;
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || 
          hours < 0 || minutes < 0 || seconds < 0 || 
          minutes >= 60 || seconds >= 60) {
        throw new Error('Formato tempo non valido. Usa hh:mm:ss (es: 1:23:45)');
      }
      return hours * 3600 + minutes * 60 + seconds;
    } else {
      throw new Error('Formato tempo non valido. Usa mm:ss o hh:mm:ss');
    }
  }
  
  parseDurationToSeconds(durationStr) {
    // Supporta formati come: "1m 30s", "90s", "2m", "1h 5m", "1h 5m 30s"
    let totalSeconds = 0;
    
    // Rimuovi spazi extra e converti in minuscolo
    const str = durationStr.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Pattern per ore, minuti, secondi
    const hoursMatch = str.match(/(\d+)h/);
    const minutesMatch = str.match(/(\d+)m/);
    const secondsMatch = str.match(/(\d+)s/);
    
    // Se è solo un numero, assumiamo che siano secondi
    if (/^\d+$/.test(str)) {
      return parseInt(str);
    }
    
    if (hoursMatch) {
      totalSeconds += parseInt(hoursMatch[1]) * 3600;
    }
    
    if (minutesMatch) {
      totalSeconds += parseInt(minutesMatch[1]) * 60;
    }
    
    if (secondsMatch) {
      totalSeconds += parseInt(secondsMatch[1]);
    }
    
    if (totalSeconds === 0) {
      throw new Error('Formato durata non valido. Usa: 1m 30s, 90s, 2m, 1h 5m');
    }
    
    return totalSeconds;
  }
  
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }
}

// Inizializza il controller quando la pagina è pronta
if (typeof window !== 'undefined') {
  window.universalVideoController = new UniversalVideoController();
}