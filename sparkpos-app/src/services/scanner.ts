// Web Audio API Synthesizer for POS Beep (Zero external asset dependencies)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSuccessBeep() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch retail beep (A6)
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (err) {
    console.debug('Audio not allowed yet without user gesture', err);
  }
}

export function playErrorBeep() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (err) {
    console.debug('Audio error beep', err);
  }
}

export function playCashDrawerKickSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (err) {
    console.debug('Audio cash drawer sound', err);
  }
}

type ScanCallback = (barcode: string) => void;

class GlobalBarcodeScanner {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private listeners: Set<ScanCallback> = new Set();
  private maxIntervalMs: number = 60; // Max ms between characters from hardware scanner

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    }
  }

  public subscribe(cb: ScanCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private handleKeyDown(e: KeyboardEvent) {
    // If user is focused on an input/textarea and manually typing, don't hijack unless it's fast burst
    const activeEl = document.activeElement;
    const isInputFocused =
      activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

    // We allow the dedicated barcode input or any un-focused screen to trigger scanner
    const now = Date.now();
    const timeDiff = now - this.lastKeyTime;
    this.lastKeyTime = now;

    if (e.key === 'Enter') {
      if (this.buffer.length >= 3) {
        // High confidence this is a barcode (either from scanner or buffered)
        const scannedCode = this.buffer.trim();
        this.buffer = '';
        this.notifyListeners(scannedCode);
        if (!isInputFocused) {
          e.preventDefault();
        }
      } else {
        this.buffer = '';
      }
      return;
    }

    // Ignore non-printable keys (Shift, Ctrl, Alt, F1-F12, etc.)
    if (e.key.length !== 1) {
      if (timeDiff > this.maxIntervalMs) {
        this.buffer = '';
      }
      return;
    }

    // If interval was too long (human typing normally, not scanning) and NOT focused on barcode input:
    if (timeDiff > this.maxIntervalMs && this.buffer.length > 0) {
      this.buffer = '';
    }

    this.buffer += e.key;
  }

  private notifyListeners(barcode: string) {
    for (const listener of this.listeners) {
      listener(barcode);
    }
  }
}

export const barcodeScanner = new GlobalBarcodeScanner();
