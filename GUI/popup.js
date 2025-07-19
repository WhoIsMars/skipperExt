} catch (error) {
    showStatus('Errore di comunicazione', 'error');
  }
});

// Funzioni overlay
function updateOverlayButton(enabled) {
  if (enabled) {
    overlayToggleBtn.textContent = '🎯 Disattiva barra overlay';
    overlayToggleBtn.className = 'overlay-btn active';
  } else {
    overlayToggleBtn.textContent = '🎯 Attiva barra overlay';
    overlayToggleBtn.className = 'overlay-btn';
  }
}

overlayToggleBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.tabs.sendMessage(tab.id, {// Elementi DOM
const timeInput = document.getElementById('timeInput');
const durationInput = document.getElementById('durationInput');
const skipBtn = document.getElementById('skipBtn');
const forwardBtn = document.getElementById('forwardBtn');
const overlayToggleBtn = document.getElementById('overlayToggleBtn');
const showOverlayBtn = document.getElementById('showOverlayBtn');
const status = document.getElementById('status');
const skipTime = document.getElementById('skipTime');
const forwardDuration = document.getElementById('forwardDuration');

// Carica i valori salvati
chrome.storage.sync.get(['savedTime', 'savedDuration', 'overlayEnabled'], (result) => {
  if (result.savedTime) {
    timeInput.value = result.savedTime;
    skipTime.textContent = result.savedTime;
  }
  if (result.savedDuration) {
    durationInput.value = result.savedDuration;
    forwardDuration.textContent = result.savedDuration;
  }
  
  // Stato overlay
  const overlayEnabled = result.overlayEnabled !== false; // Default true
  updateOverlayButton(overlayEnabled);
});

// Funzione per convertire il tempo in secondi
function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  
  // Supporta formati: 2:33, 1:23:45, 123
  const parts = timeStr.split(':');
  let seconds = 0;
  
  if (parts.length === 1) {
    // Solo secondi
    seconds = parseInt(parts[0]) || 0;
  } else if (parts.length === 2) {
    // mm:ss
    seconds = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  } else if (parts.length === 3) {
    // hh:mm:ss
    seconds = (parseInt(parts[0]) || 0) * 3600 + 
              (parseInt(parts[1]) || 0) * 60 + 
              (parseInt(parts[2]) || 0);
  }
  
  return seconds;
}

// Funzione per convertire la durata in secondi
function durationToSeconds(durationStr) {
  if (!durationStr) return 0;
  
  let seconds = 0;
  const str = durationStr.toLowerCase();
  
  // Estrae minuti (1m, 30m, etc.)
  const minMatch = str.match(/(\d+)m/);
  if (minMatch) {
    seconds += parseInt(minMatch[1]) * 60;
  }
  
  // Estrae secondi (30s, 45s, etc.)
  const secMatch = str.match(/(\d+)s/);
  if (secMatch) {
    seconds += parseInt(secMatch[1]);
  }
  
  // Se non trova m o s, prova a interpretare come solo secondi
  if (seconds === 0) {
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
      seconds = parseInt(numMatch[1]);
    }
  }
  
  return seconds;
}

// Salva automaticamente i valori
timeInput.addEventListener('input', () => {
  const value = timeInput.value;
  chrome.storage.sync.set({ savedTime: value });
  skipTime.textContent = value || '--:--';
});

durationInput.addEventListener('input', () => {
  const value = durationInput.value;
  chrome.storage.sync.set({ savedDuration: value });
  forwardDuration.textContent = value || '--';
});

// Funzione per mostrare lo status
function showStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
  if (type) {
    setTimeout(() => {
      status.className = 'status';
      status.textContent = 'Pronto per controllare video';
    }, 3000);
  }
}

// Skip to time
skipBtn.addEventListener('click', async () => {
  const timeStr = timeInput.value;
  if (!timeStr) {
    showStatus('Inserisci un minutaggio', 'error');
    return;
  }
  
  const seconds = timeToSeconds(timeStr);
  if (seconds < 0) {
    showStatus('Formato tempo non valido', 'error');
    return;
  }
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'skipTo',
      seconds: seconds
    });
    
    if (result.success) {
      showStatus(`Video portato a ${timeStr}`, 'success');
    } else {
      showStatus(result.error || 'Video non trovato', 'error');
    }
  } catch (error) {
    showStatus('Errore di comunicazione', 'error');
  }
});

// Go forward
forwardBtn.addEventListener('click', async () => {
  const durationStr = durationInput.value;
  if (!durationStr) {
    showStatus('Inserisci una durata', 'error');
    return;
  }
  
  const seconds = durationToSeconds(durationStr);
  if (seconds <= 0) {
    showStatus('Formato durata non valido', 'error');
    return;
  }
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'goForward',
      seconds: seconds
    });
    
    if (result.success) {
      showStatus(`Video avanzato di ${durationStr}`, 'success');
    } else {
      showStatus(result.error || 'Video non trovato', 'error');
    }
  } catch (error) {
    showStatus('Errore di comunicazione', 'error');
  }
});