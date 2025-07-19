// Content script per rilevare e controllare video
class UniversalVideoController {
  constructor() {
    this.video = null;
    this.lastVideoCheck = 0;
    this.overlayBar = null;
    this.isOverlayEnabled = true;
    this.videoObserver = null;
    this.setupMessageListener();
    this.loadOverlaySettings();
    this.findVideo();
    this.setupAdvancedVideoDetection();
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
  
  setupAdvancedVideoDetection() {
    // Observer per iframe dinamici
    const observer = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'VIDEO' || 
                node.tagName === 'IFRAME' ||
                node.querySelector && (node.querySelector('video') || node.querySelector('iframe'))) {
              shouldRecheck = true;
            }
          }
        });
      });
      
      if (shouldRecheck && !this.video) {
        setTimeout(() => this.findVideo(), 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Controlla periodicamente per video caricati dinamicamente
    setInterval(() => {
      if (!this.video || !document.body.contains(this.video)) {
        this.findVideo();
      }
    }, 2000);
    
    // Ascolta eventi globali per cambi di pagina SPA
    window.addEventListener('popstate', () => {
      setTimeout(() => this.findVideo(), 1000);
    });
    
    // Ascolta eventi di navigazione
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => this.findVideo(), 1000);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });
  }
  
  findVideo() {
    console.log('🔍 Ricerca video su:', window.location.hostname);
    
    // Strategie specifiche per dominio
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('altadefinizione') || hostname.includes('altadefinizione01')) {
      this.findAltadefinzioneVideo();
    } else if (hostname.includes('streamingunity') || hostname.includes('streamingcommunity')) {
      this.findStreamingCommunityVideo();
    } else {
      this.findGenericVideo();
    }
    
    // Se non trova video, riprova con strategie generiche
    if (!this.video) {
      this.findGenericVideo();
    }
    
    // Se ancora non trova, attiva ricerca avanzata
    if (!this.video) {
      this.advancedVideoSearch();
    }
    
    if (this.video) {
      console.log('✅ Video trovato:', this.video);
      this.setupVideoListeners();
      if (this.isOverlayEnabled) {
        setTimeout(() => this.showOverlay(), 1000);
      }
    } else {
      console.log('❌ Nessun video trovato');
    }
  }
  
  findAltadefinzioneVideo() {
    console.log('🎬 Ricerca video Altadefinizione...');
    
    // Selettori specifici per Altadefinizione
    const selectors = [
      // Player principali
      '#player video',
      '.player video',
      '#vjs_video_3_html5_api',
      '.vjs-tech',
      '.video-js video',
      '.vjs-html5-video',
      
      // Container comuni
      '.player-container video',
      '.video-player-container video',
      '#video-container video',
      '.video-container video',
      
      // Player JWPlayer
      '.jwplayer video',
      '.jw-video video',
      '.jw-media video',
      
      // Player VideoJS
      '.video-js .vjs-tech',
      'video.vjs-tech',
      
      // Altri player
      '.dplayer-video',
      '.flowplayer video'
    ];
    
    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (video && this.isValidVideo(video)) {
        this.video = video;
        return;
      }
    }
    
    // Ricerca in iframe
    this.searchInFrames();
    
    // Ricerca specifica per Altadefinizione con attesa
    setTimeout(() => {
      if (!this.video) {
        this.waitForAltadefinzioneVideo();
      }
    }, 2000);
  }
  
  waitForAltadefinzioneVideo() {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkVideo = () => {
      attempts++;
      
      // Cerca nei player più comuni di Altadefinizione
      const playerSelectors = [
        'video[src*="mp4"]',
        'video[src*="m3u8"]',
        'video[data-setup]',
        '.vjs-tech[src]'
      ];
      
      for (const selector of playerSelectors) {
        const video = document.querySelector(selector);
        if (video && this.isValidVideo(video)) {
          this.video = video;
          this.setupVideoListeners();
          if (this.isOverlayEnabled) {
            setTimeout(() => this.showOverlay(), 500);
          }
          return;
        }
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkVideo, 1000);
      }
    };
    
    checkVideo();
  }
  
  findStreamingCommunityVideo() {
    console.log('🎬 Ricerca video StreamingCommunity...');
    
    const selectors = [
      // Player Plyr (molto comune)
      '.plyr video',
      '.plyr__video',
      '.plyr__video-wrapper video',
      '.plyr-container video',
      
      // Container specifici
      '.player-container video',
      '.video-player-container video',
      '#video-container video',
      '.streaming-player video',
      '.sc-player video',
      '#player video',
      
      // Altri player comuni
      '.jwplayer video',
      '.video-js video',
      '.dplayer-video',
      
      // Selettori generici che potrebbero funzionare
      'video[src]',
      'video[data-src]'
    ];
    
    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (video && this.isValidVideo(video)) {
        this.video = video;
        return;
      }
    }
    
    // Ricerca in iframe per player embedded
    this.searchInFrames();
    
    // Attesa per caricamento dinamico
    setTimeout(() => {
      if (!this.video) {
        this.waitForStreamingVideo();
      }
    }, 2000);
  }
  
  waitForStreamingVideo() {
    let attempts = 0;
    const maxAttempts = 15;
    
    const checkVideo = () => {
      attempts++;
      
      // Controlla tutti i video nella pagina
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (this.isValidVideo(video)) {
          this.video = video;
          this.setupVideoListeners();
          if (this.isOverlayEnabled) {
            setTimeout(() => this.showOverlay(), 500);
          }
          return;
        }
      }
      
      // Controlla anche nei player che potrebbero apparire
      const dynamicSelectors = [
        'video[autoplay]',
        'video[controls]',
        'video[preload]',
        '.plyr__video-wrapper video'
      ];
      
      for (const selector of dynamicSelectors) {
        const video = document.querySelector(selector);
        if (video && this.isValidVideo(video)) {
          this.video = video;
          this.setupVideoListeners();
          if (this.isOverlayEnabled) {
            setTimeout(() => this.showOverlay(), 500);
          }
          return;
        }
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkVideo, 1000);
      }
    };
    
    checkVideo();
  }
  
  searchInFrames() {
    // Cerca in tutti gli iframe della pagina
    const frames = document.querySelectorAll('iframe, frame');
    
    for (const frame of frames) {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc) {
          const video = frameDoc.querySelector('video');
          if (video && this.isValidVideo(video)) {
            this.video = video;
            return;
          }
        }
      } catch (e) {
        // Cross-origin frame, non possiamo accedere
        console.log('Frame cross-origin rilevato:', frame.src);
      }
    }
    
    // Attende che i frame si carichino
    frames.forEach(frame => {
      frame.addEventListener('load', () => {
        setTimeout(() => {
          if (!this.video) {
            this.searchInFrames();
          }
        }, 1000);
      });
    });
  }
  
  findGenericVideo() {
    const selectors = [
      // Video HTML5 standard
      'video',
      
      // YouTube
      '#movie_player video',
      '.video-stream',
      
      // Vimeo
      '.vp-video-wrapper video',
      '.vp-video video',
      
      // Netflix
      '.VideoContainer video',
      
      // Prime Video
      '.webPlayerContainer video',
      
      // Twitch
      '.video-player video',
      
      // Dailymotion
      '.dmp_VideoPlayer video',
      
      // Player comuni
      '.video-js video',
      '.jwplayer video',
      '.plyr video',
      '.flowplayer video'
    ];
    
    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (video && this.isValidVideo(video)) {
        this.video = video;
        return;
      }
    }
  }
  
  advancedVideoSearch() {
    console.log('🔍 Ricerca avanzata video...');
    
    // Cerca in shadow DOM
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const video = el.shadowRoot.querySelector('video');
        if (video && this.isValidVideo(video)) {
          this.video = video;
          return;
        }
      }
    }
    
    // Cerca video con attributi specifici
    const videoElements = document.getElementsByTagName('video');
    for (const video of videoElements) {
      if (this.isValidVideo(video)) {
        this.video = video;
        return;
      }
    }
    
    // Usa MutationObserver per video caricati dinamicamente
    if (!this.videoObserver) {
      this.videoObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.tagName === 'VIDEO' && this.isValidVideo(node)) {
                this.video = node;
                this.setupVideoListeners();
                if (this.isOverlayEnabled) {
                  setTimeout(() => this.showOverlay(), 500);
                }
                return;
              }
              
              const video = node.querySelector && node.querySelector('video');
              if (video && this.isValidVideo(video)) {
                this.video = video;
                this.setupVideoListeners();
                if (this.isOverlayEnabled) {
                  setTimeout(() => this.showOverlay(), 500);
                }
                return;
              }
            }
          }
        }
      });
      
      this.videoObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  isValidVideo(video) {
    if (!video || video.tagName !== 'VIDEO') return false;
    
    // Controlla se il video ha contenuto
    return video.duration > 0 || 
           video.readyState > 0 || 
           video.src || 
           video.currentSrc ||
           video.querySelector('source');
  }
  
  setupVideoListeners() {
    if (!this.video) return;
    
    // Re-cerca video se quello corrente viene rimosso
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.video)) {
        this.video = null;
        setTimeout(() => this.findVideo(), 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Eventi del video
    this.video.addEventListener('loadstart', () => {
      setTimeout(() => {
        if (!this.isValidVideo(this.video)) {
          this.findVideo();
        }
      }, 1000);
    });
    
    this.video.addEventListener('canplay', () => {
      console.log('✅ Video pronto per la riproduzione');
      if (this.isOverlayEnabled && !this.overlayBar) {
        setTimeout(() => this.showOverlay(), 500);
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
      // Aspetta che il video sia pronto
      if (!this.isValidVideo(this.video) || this.video.duration === 0) {
        await this.waitForVideoReady();
      }
      
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
  
  async waitForVideoReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: video non pronto'));
      }, 10000);
      
      const checkReady = () => {
        if (this.isValidVideo(this.video) && this.video.duration > 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 200);
        }
      };
      
      checkReady();
    });
  }
  
  // Gestione overlay bar
  loadOverlaySettings() {
    chrome.storage.sync.get(['overlayEnabled'], (result) => {
      this.isOverlayEnabled = result.overlayEnabled !== false;
    });
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
            <span>🎥 Skipper Ext</span>
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
      
      this.addOverlayStyles();
      document.body.appendChild(this.overlayBar);
      this.setupOverlayListeners();
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
        backdrop-filter: blur(15px) !important;
        animation: uvcSlideDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
      }
      
      @keyframes uvcSlideDown {
        from { 
          transform: translateY(-100%); 
          opacity: 0; 
        }
        to { 
          transform: translateY(0); 
          opacity: 1; 
        }
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
        padding: 12px 20px !important;
      }
      
      .uvc-bar-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 12px !important;
      }
      
      .uvc-bar-header span {
        font-weight: 600 !important;
        font-size: 15px !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }
      
      .uvc-close-btn {
        background: rgba(255,255,255,0.2) !important;
        border: none !important;
        color: white !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 14px !important;
        cursor: pointer !important;
        font-size: 18px !important;
        font-weight: bold !important;
        line-height: 1 !important;
        transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .uvc-close-btn:hover {
        background: rgba(255,255,255,0.3) !important;
        transform: scale(1.1) rotate(90deg) !important;
      }
      
      .uvc-bar-controls {
        display: flex !important;
        gap: 20px !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
      }
      
      .uvc-input-group {
        display: flex !important;
        gap: 10px !important;
        align-items: center !important;
      }
      
      .uvc-input-group input {
        padding: 8px 14px !important;
        border: 1px solid rgba(255,255,