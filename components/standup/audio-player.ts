// components/standup/audio-player.ts
//
// Fixed hang scenarios:
//   1. Empty stream (TTS failed): markStreamEnd with no chunks → fires onEndCb directly
//   2. Autoplay blocked: play() rejection → fires onEndCb after short delay
//   3. Late chunks: chunks arriving after markStreamEnd → retries tryPlay
//   4. Safety timeout: if audio hasn't ended 30s after markStreamEnd → force end
//   5. Stale state: reset() clears streamEnded so next turn starts clean

export class AudioChunkPlayer {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private pending = new Map<number, Uint8Array>();
  private ordered: Uint8Array[] = [];
  private nextIndex = 0;
  private streamEnded = false;
  private disposed = false;
  private playing = false;
  private onEndCb: (() => void) | null = null;
  private onPlayingCb: ((playing: boolean) => void) | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.addEventListener("ended", this.handleEnded);
    this.audio.addEventListener("play", this.handlePlay);
    this.audio.addEventListener("pause", this.handlePause);
    this.audio.addEventListener("error", this.handleError);
  }

  enqueue(base64Chunk: string, index?: number) {
    if (this.disposed) return;

    try {
      const binaryString = atob(base64Chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      if (typeof index === "number") {
        this.pending.set(index, bytes);
        while (this.pending.has(this.nextIndex)) {
          this.ordered.push(this.pending.get(this.nextIndex)!);
          this.pending.delete(this.nextIndex);
          this.nextIndex += 1;
        }
      } else {
        this.ordered.push(bytes);
      }

      // FIX: If chunks arrive AFTER markStreamEnd, retry playback.
      // This handles the race where pm_audio_end fires before all chunks arrive.
      if (this.streamEnded && !this.playing) {
        this.tryPlay();
      }
    } catch (error) {
      console.warn("[AudioChunkPlayer] Failed to decode chunk", error);
    }
  }

  markStreamEnd() {
    this.streamEnded = true;

    // FIX: If no chunks arrived (TTS failed silently), fire onEndCb directly
    // instead of waiting forever for audio that will never play.
    if (this.ordered.length === 0) {
      console.warn("[AudioChunkPlayer] Stream ended with no chunks — skipping playback");
      this.fireEnd();
      return;
    }

    this.tryPlay();

    // FIX: Safety timeout. If audio hasn't finished 30s after stream end,
    // force the transition. This catches edge cases like corrupt audio blobs
    // that load but never fire "ended", or extremely long TTS output.
    this.clearSafetyTimer();
    this.safetyTimer = setTimeout(() => {
      if (!this.disposed && this.streamEnded) {
        console.warn("[AudioChunkPlayer] Safety timeout — forcing end");
        this.interrupt();
        this.fireEnd();
      }
    }, 30_000);
  }

  interrupt() {
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {}
    this.clearUrl();
    this.playing = false;
    this.onPlayingCb?.(false);
  }

  stop() {
    this.interrupt();
    this.reset();
  }

  reset() {
    this.pending.clear();
    this.ordered = [];
    this.nextIndex = 0;
    this.streamEnded = false;
    this.playing = false;
    this.clearSafetyTimer();
  }

  onEnd(cb: () => void) {
    this.onEndCb = cb;
  }

  onPlayingChange(cb: (playing: boolean) => void) {
    this.onPlayingCb = cb;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.clearSafetyTimer();
    if (this.audio) {
      this.audio.removeEventListener("ended", this.handleEnded);
      this.audio.removeEventListener("play", this.handlePlay);
      this.audio.removeEventListener("pause", this.handlePause);
      this.audio.removeEventListener("error", this.handleError);
    }
    this.audio = null;
  }

  private tryPlay() {
    if (!this.streamEnded || !this.audio || this.ordered.length === 0) return;
    if (this.playing) return;

    const blob = new Blob(this.ordered as BlobPart[], { type: "audio/mpeg" });
    this.clearUrl();
    this.url = URL.createObjectURL(blob);
    this.audio.src = this.url;

    const playPromise = this.audio.play();

    if (playPromise) {
      playPromise.catch((error) => {
        console.warn("[AudioChunkPlayer] Playback failed:", error?.message);
        this.playing = false;
        this.onPlayingCb?.(false);

        // FIX: If play() is rejected (autoplay policy, NotAllowedError, etc.),
        // fire onEndCb after a short delay so the standup doesn't hang.
        // The candidate will see Sarah's text but won't hear audio — better
        // than an infinite hang with no indication of what happened.
        setTimeout(() => {
          if (!this.disposed && this.streamEnded) {
            this.fireEnd();
          }
        }, 500);
      });
    }
  }

  private clearUrl() {
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }

  private clearSafetyTimer() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  /** Fire the end callback exactly once per stream. */
  private fireEnd() {
    this.clearSafetyTimer();
    this.playing = false;
    this.onPlayingCb?.(false);
    this.clearUrl();
    this.reset();
    this.onEndCb?.();
  }

  private handleEnded = () => {
    this.fireEnd();
  };

  private handlePlay = () => {
    this.playing = true;
    this.onPlayingCb?.(true);
  };

  private handlePause = () => {
    this.playing = false;
    this.onPlayingCb?.(false);
  };

  // FIX: Audio error event (corrupt blob, network error on blob URL, etc.)
  // Treat as end-of-playback to prevent hangs.
  private handleError = () => {
    console.warn("[AudioChunkPlayer] Audio error event — treating as end");
    if (this.streamEnded) {
      this.fireEnd();
    } else {
      this.playing = false;
      this.onPlayingCb?.(false);
    }
  };
}
