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
        this.savedTime = ''; // Aggiungi queste proprietà per salvare i dati una volta
        this.savedDuration = ''; // Aggiungi queste proprietà
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
            'iframe[src*="embed"]',
            'iframe[src*="/e/"]', // Added for Altadefinizione
            '.ratio iframe', // Added for Altadefinizione specific structure

            'iframe[src*="https://streamtape.com/e/"]',
            'iframe[src*="https://voe.sx/e/"]',
            'iframe[src*="https://filemoon.sx/e/"]',
            'iframe[src*="https://vidhidepro.com/e/"]',

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
                        // Use the new pollForVideoInFrame for iframes
                        if (this.pollForVideoInFrame(element)) {
                            return; // Video found inside iframe
                        }
                    }
                }
            } catch (e) {
                console.log('Errore selettore:', selector, e);
            }
        }

        // Ricerca in tutti gli iframe (ascolta sempre gli iframe)
        this.searchInAllFrames();
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
            'iframe[src*="stream"]',
            'iframe[src*="/e/"]', // Added for StreamingCommunity
            '.ratio iframe', // Added for common iframe structures

            'iframe[src*="https://vidhidepro.com/e/"]',
            'iframe[src*="https://d0001.stream/e/"]',
            'iframe[src*="https://watchvideo.us/e/"]',

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
                        // Use the new pollForVideoInFrame for iframes
                        if (this.pollForVideoInFrame(element)) {
                            return; // Video found inside iframe
                        }
                    }
                }
            } catch (e) {
                console.log('Errore selettore:', selector, e);
            }
        }

        // Ricerca in tutti gli iframe (ascolta sempre gli iframe)
        this.searchInAllFrames();
    }

    searchInAllFrames() {
        const frames = document.querySelectorAll('iframe, frame'); // Removed embed, object as they are less common for modern video players

        for (const frame of frames) {
            // Initiate polling for video within each frame
            this.pollForVideoInFrame(frame);
            if (this.video) return; // If video is found in any frame, stop
        }
    }

    showExternalVideoNotice(videoUrl, host) {
        // Evita duplicati
        if (document.getElementById('uvc-external-notice')) return;

        const notice = document.createElement('div');
        notice.id = 'uvc-external-notice';
        notice.style.position = 'fixed';
        notice.style.bottom = '80px';
        notice.style.left = '50%';
        notice.style.transform = 'translateX(-50%)';
        notice.style.zIndex = '999999';
        notice.style.background = '#222';
        notice.style.color = 'white';
        notice.style.padding = '14px 20px';
        notice.style.border = '1px solid #FFD700';
        notice.style.borderRadius = '8px';
        notice.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        notice.style.backdropFilter = 'blur(8px)';
        notice.style.fontFamily = 'Arial, sans-serif';
        notice.style.maxWidth = '90%';
        notice.style.textAlign = 'center';

        notice.innerHTML = `
        <div style="margin-bottom: 10px;">🎥 Video rilevato su <strong>${host}</strong>, non controllabile da questa pagina.</div>
        <button style="padding: 8px 16px; background: #FFD700; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
            Apri il video in un'altra scheda
        </button>
    `;

        const button = notice.querySelector('button');
        button.addEventListener('click', () => {
            window.open(videoUrl, '_blank');
            notice.remove();
        });

        document.body.appendChild(notice);

        // Rimuovi dopo 30s se ignorato
        setTimeout(() => {
            if (notice && document.body.contains(notice)) {
                notice.remove();
            }
        }, 30000);
    }


    // New function to poll for video inside a frame
    pollForVideoInFrame(frame, attempts = 0, maxAttempts = 15) {
        if (!frame || attempts >= maxAttempts) {
            return false;
        }

        try {
            let frameDoc = null;

            if (frame.contentDocument) {
                frameDoc = frame.contentDocument;
            } else if (frame.contentWindow && frame.contentWindow.document) {
                frameDoc = frame.contentWindow.document;
            }

            if (frameDoc) {
                const videoSelectorsInFrame = [
                    'video',
                    '.video-js video',
                    '.vjs-tech',
                    '.plyr video',
                    '.jwplayer video',
                    'video[src*=".mp4"]',
                    'video[src*=".m3u8"]',
                    'video[controls]',
                    'video[autoplay]'
                ];

                for (const selector of videoSelectorsInFrame) {
                    try {
                        const video = frameDoc.querySelector(selector);
                        if (video && this.isValidVideo(video)) {
                            console.log('✅ Video trovato in iframe:', frame.src || frame.id || 'unknown');
                            this.video = video;
                            this.setupVideoListeners(); // Set up listeners for the found video
                            if (this.isOverlayEnabled) {
                                setTimeout(() => this.showOverlayBar(), 500);
                            }
                            return true;
                        }
                    } catch (e) {
                        console.log('Errore selettore in iframe:', selector, e);
                    }
                }

                // Recursively search in nested iframes within the current frame
                const nestedFrames = frameDoc.querySelectorAll('iframe, frame');
                for (const nestedFrame of nestedFrames) {
                    if (this.pollForVideoInFrame(nestedFrame, 0, maxAttempts)) { // Reset attempts for nested frames
                        return true;
                    }
                }
            }
        } catch (e) {
            console.log('Frame cross-origin o errore di accesso:', frame.src || frame.id || 'unknown', e);

            const knownVideoHosts = [
                'dropload.io',
                'vixcloud.co',
                'vidhidepro.com',
                'filemoon.sx',
                'upstream.to',
                'streamtape.com',
                'mixdrop.co'
            ];

            if (frame.src) {
                const url = new URL(frame.src);
                const hostMatch = knownVideoHosts.some(h => url.hostname.includes(h));
                if (hostMatch) {
                    console.log('🔐 Rilevato video su host esterno:', url.hostname);

                    this.showExternalVideoNotice(frame.src, url.hostname);
                    this.updateOverlayStatus(`🎥 Video esterno rilevato su ${url.hostname}`, 'info');
                }
            }

        }

        // If not found yet, retry after a delay
        setTimeout(() => {
            // Only retry if no video has been found yet overall
            if (!this.video) {
                this.pollForVideoInFrame(frame, attempts + 1, maxAttempts);
            }
        }, 500 + (attempts * 100)); // Increase delay with attempts

        return false;
    }


    findGenericVideo() {
        const selectors = [
            'video', // Tag video HTML5 standard
            'video[src]', // Tag video con sorgente diretta
            'video[currentSrc]', // Tag video con sorgente corrente
            'video[data-setup]', // Video.js
            '.video-js video', // Lettore Video.js all'interno del suo contenitore
            'video.jw-video', // Elemento video JWPlayer
            '.jw-video', // Contenitore JWPlayer
            'div[data-player-type="plyr"] video', // Lettore Plyr
            '.plyr__video', // Elemento video Plyr
            'iframe[src*="player.vimeo.com"]', // Lettori Vimeo incorporati
            'iframe[src*="youtube.com/embed"]', // Lettori YouTube incorporati
            'iframe[src*="player.twitch.tv"]', // Lettori Twitch incorporati
            'iframe[src*="ok.ru/videoembed"]', // OK.ru (spesso usato su siti di streaming)
            'iframe[src*="mixdrop.co/e"]', // Mixdrop (comune sui siti di streaming)
            'iframe[src*="streamtape.com/e"]', // Streamtape (comune)
            'iframe[src*="voe.sx/e"]', // Voe.sx (comune)
            'iframe[src*="fembed.com/v/"]', // Fembed (comune)
            'iframe[src*="filemoon.sx/e/"]', // Filemoon (comune)
            'iframe[src*="/e/"]', // Added for general embedded videos
            'div[id*="player"] video', // Div generici con "player" nell'ID
            'div[class*="player"] video', // Div generici con "player" nella classe
            'embed', // Vecchi tag embed
            'object',
            'iframe[src*="vidhidepro.com"]',
            'iframe[src*="watchvideo.us"]',
            'iframe[src*="d0001.stream"]',

        ];

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    if (element.tagName === 'VIDEO' && this.isValidVideo(element)) {
                        this.video = element;
                        return;
                    } else if (element.tagName === 'IFRAME') {
                        // If an iframe is found, try to poll for video inside it
                        if (this.pollForVideoInFrame(element)) {
                            return; // Video found inside iframe
                        }
                    }
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

    catchIframses() {

        document.querySelectorAll('iframe').forEach(f => {
            console.log('IFRAME SRC:', f.src);
        });

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
        this.catchIframses()
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
        this.catchIframses()
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
        chrome.storage.sync.get(['overlayEnabled', 'savedTime', 'savedDuration'], (result) => { // Carica anche i tempi qui
            this.isOverlayEnabled = result.overlayEnabled !== false;
            this.savedTime = result.savedTime || ''; // Salva i valori
            this.savedDuration = result.savedDuration || ''; // Salva i valori
            // Se la barra è già stata creata (e poi nascosta), aggiorna i suoi input
            if (this.overlayBar) {
                const timeInput = this.overlayBar.querySelector('#uvc-time-input');
                const durationInput = this.overlayBar.querySelector('#uvc-duration-input');
                if (timeInput) timeInput.value = this.savedTime;
                if (durationInput) durationInput.value = this.savedDuration;
            }
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
        console.log("showOverlayBar chiamata. video:", this.video);
        if (!this.video) {
            console.log("Nessun video trovato, overlay non mostrato.");
            return;
        }

        // Se la barra esiste già e non è nascosta, nascondila prima di ricrearla
        if (this.overlayBar && this.isOverlayVisible) {
            this.hideOverlayBar(); // Questo imposta this.overlayBar = null;
        }

        // SOLO se this.overlayBar è null (cioè non esiste o è stato rimosso), crealo
        if (!this.overlayBar) {
            this.createOverlayBar(); // Questa funzione DEVE creare l'elemento e assegnarlo a this.overlayBar
            if (!this.overlayBar) { // Doppia verifica: se createOverlayBar non lo crea, esci.
                console.error("Errore: createOverlayBar non ha creato un elemento valido.");
                return;
            }
            // Add the style element to the head
            const styleElement = document.createElement('style');
            styleElement.id = 'uvc-overlay-styles';
            styleElement.textContent = `
      #uvc-overlay-bar {
        position: fixed !important;
        bottom: 20px !important; /* Changed from top: 0 */
        left: 50% !important; /* Centered */
        transform: translateY(calc(100% + 20px)) translateX(-50%); /* Removed !important */
        width: 90% !important; /* Expand in width */
        max-width: 800px !important; /* Max width for larger screens */
        z-index: 999999 !important;
        background: #222 !important; /* Dark black background */
        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-shadow: 0 8px 30px rgba(0,0,0,0.6) !important; /* More prominent shadow for "rilievo" */
        border: 1px solid rgba(255,255,255,0.1) !important; /* Subtle border for raised effect */
        backdrop-filter: blur(10px) !important;
        opacity: 0; /* Removed !important */
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
      }

      @keyframes uvcSlideUp {
        from {
          transform: translateY(0) translateX(-50%); /* Visible position */
          opacity: 1;
        }
        to {
          transform: translateY(calc(100% + 20px)) translateX(-50%); /* Hidden below screen */
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
        background: linear-gradient(135deg, #FFD700, #FFA500) !important; /* Yellow gradient */
        color: #333 !important; /* Dark text for yellow buttons */
      }

      .uvc-forward {
        background: linear-gradient(135deg, #FFD700, #FFA500) !important; /* Yellow gradient */
        color: #333 !important; /* Dark text for yellow buttons */
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
        border-left: 3px solid #FFD700 !important; /* Yellow border */
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
            document.head.appendChild(styleElement);

            this.overlayBar.style.transform = 'translateY(0) translateX(-50%)'; // Adjusted
            this.overlayBar.style.opacity = '1';

            this.setupOverlayListeners();
            document.body.appendChild(this.overlayBar);
            this.isOverlayVisible = true;
            console.log("Barra di overlay aggiunta al body.");
        } else {
            // Se la barra esiste ma non era visibile (es. era solo nascosta da CSS)
            // Assicurati che sia nel DOM e che gli stili di visibilità siano applicati
            if (!document.body.contains(this.overlayBar)) {
                document.body.appendChild(this.overlayBar);
                console.log("Barra di overlay riaggiunta al body (era stata rimossa).");
            }
            this.isOverlayVisible = true; // Assicurati che lo stato sia visibile
        }

    }

    hideOverlayBar() {
        if (this.overlayBar) {
            this.overlayBar.style.animation = 'uvcSlideUp 0.3s ease-in forwards';
            setTimeout(() => {
                if (this.overlayBar && this.overlayBar.parentNode) {
                    this.overlayBar.parentNode.removeChild(this.overlayBar);
                    // Also remove the style element if it was added
                    const styleElement = document.getElementById('uvc-overlay-styles');
                    if (styleElement && styleElement.parentNode) {
                        styleElement.parentNode.removeChild(styleElement);
                    }
                }
                this.overlayBar = null;
                this.isOverlayVisible = false;
            }, 300);
        }
    }

    createOverlayBar() {
        // La logica di creazione deve essere SINCRONA
        console.log("this.overlayBar:\n", this.overlayBar)
        if (this.overlayBar) { // Se per qualche motivo è già stato creato, non ricreare
            return;
        }

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
                        <input type="text" id="uvc-time-input" placeholder="2:33" value="${this.savedTime}" title="Formato: mm:ss o hh:mm:ss">
                        <button id="uvc-skip-btn" class="uvc-btn uvc-skip" title="Vai al minutaggio specificato">⏭️ Skip</button>
                    </div>
                    <div class="uvc-input-group">
                        <input type="text" id="uvc-duration-input" placeholder="1m 30s" value="${this.savedDuration}" title="Formato: 1m 30s o 90s">
                        <button id="uvc-forward-btn" class="uvc-btn uvc-forward" title="Avanza della durata specificata">⏩ Forward</button>
                    </div>
                </div>
                <div id="uvc-status" class="uvc-status">✅ Video rilevato - Pronto per il controllo</div>
            </div>
        `;
    }


    setupOverlayListeners() {
        if (!this.overlayBar) {
            console.warn("overlayBar not found in setupOverlayListeners")

            return;
        }

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
            success: '#FFD700', // Changed to yellow
            error: '#ff6b6b',
            loading: '#f39c12',
            info: '#FFD700' // Changed to yellow
        };

        statusEl.style.borderLeftColor = colors[type] || colors.info;

        // Reset automatico dopo qualche secondo per messaggi di successo/errore
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                if (statusEl && this.video) {
                    statusEl.textContent = '✅ Video rilevato - Pronto per il controllo';
                    statusEl.className = 'uvc-status';
                    statusEl.style.borderLeftColor = '#FFD700'; // Changed to yellow
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