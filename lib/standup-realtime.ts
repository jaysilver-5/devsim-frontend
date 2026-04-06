// lib/standup-realtime.ts
//
// OpenAI Realtime WebRTC bridge for DevSim standups.
//
// Architecture:
//   Browser ←→ OpenAI Realtime (WebRTC) for voice I/O (sub-300ms latency)
//   Browser → DevSim backend (REST) for scoring & context-aware follow-ups
//   Browser → OpenAI data channel to inject follow-up as next assistant turn
//
// Flow:
//   1. Backend creates ephemeral client secret with session instructions
//   2. Browser opens WebRTC peer connection to OpenAI Realtime
//   3. OpenAI speaks the opening line automatically (from session config)
//   4. User speaks → semantic VAD detects end → transcript event fires
//   5. Browser POSTs transcript to DevSim backend (completeTurnText)
//   6. Backend returns { pmFollowUp, turnScore, isComplete, ... }
//   7. Browser injects pmFollowUp into data channel as assistant message
//   8. OpenAI speaks the follow-up naturally
//   9. Repeat until backend signals isComplete

export interface RealtimeSession {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  audio: HTMLAudioElement;
  stream: MediaStream;
  close: () => void;
}

export type RealtimeEvent =
  | { type: 'transcript_complete'; transcript: string }
  | { type: 'speech_started' }
  | { type: 'speech_stopped' }
  | { type: 'assistant_speaking' }
  | { type: 'assistant_done' }
  | { type: 'error'; message: string }
  | { type: 'connected' }
  | { type: 'disconnected' };

export type RealtimeEventCallback = (event: RealtimeEvent) => void;

/**
 * Establish a WebRTC connection to OpenAI Realtime using an ephemeral token.
 *
 * @param token - The client_secret value from the backend's client-secret endpoint
 * @param model - OpenAI Realtime model (default: gpt-4o-realtime-preview-2025-06-03)
 * @param onEvent - Callback for realtime session events (transcripts, state changes)
 */
export async function createRealtimeSession(
  token: string,
  onEvent: RealtimeEventCallback,
  model?: string,
): Promise<RealtimeSession> {
  const pc = new RTCPeerConnection();
  const audio = document.createElement('audio');
  audio.autoplay = true;

  // Track remote audio (OpenAI's voice output)
  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
    onEvent({ type: 'assistant_speaking' });
  };

  // Capture local audio (user's mic)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  // Create the data channel for events
  const dc = pc.createDataChannel('oai-events');

  // Parse data channel messages for transcript events
  dc.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'conversation.item.input_audio_transcription.completed':
          if (msg.transcript?.trim()) {
            onEvent({
              type: 'transcript_complete',
              transcript: msg.transcript.trim(),
            });
          }
          break;

        case 'input_audio_buffer.speech_started':
          onEvent({ type: 'speech_started' });
          break;

        case 'input_audio_buffer.speech_stopped':
          onEvent({ type: 'speech_stopped' });
          break;

        case 'response.done':
          onEvent({ type: 'assistant_done' });
          break;

        case 'error':
          onEvent({
            type: 'error',
            message: msg.error?.message || 'Realtime session error',
          });
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  };

  dc.onopen = () => {
    onEvent({ type: 'connected' });
  };

  dc.onclose = () => {
    onEvent({ type: 'disconnected' });
  };

  // WebRTC offer/answer exchange with OpenAI
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const realtimeModel = model || 'gpt-4o-realtime-preview-2025-06-03';
  const response = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeModel)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Realtime connection failed: ${response.status} ${text}`);
  }

  const answer = await response.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  const close = () => {
    try {
      stream.getTracks().forEach((track) => track.stop());
      audio.srcObject = null;
      dc.close();
      pc.close();
    } catch {
      // Best effort cleanup
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      onEvent({ type: 'disconnected' });
    }
  };

  return { pc, dc, audio, stream, close };
}

/**
 * Inject an assistant message into the realtime session.
 * OpenAI Realtime will speak this naturally using the configured voice.
 *
 * This is how DevSim's backend controls the conversation:
 * backend generates a context-aware follow-up → browser injects it → OpenAI speaks it.
 */
export function injectAssistantMessage(dc: RTCDataChannel, text: string) {
  if (dc.readyState !== 'open') return;

  // Create a conversation item with the assistant message
  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    }),
  );

  // Trigger the assistant to speak the message
  dc.send(
    JSON.stringify({
      type: 'response.create',
    }),
  );
}

/**
 * Mute/unmute the local microphone stream.
 */
export function setMicEnabled(session: RealtimeSession, enabled: boolean) {
  session.stream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

// ─── Legacy export for backward compatibility ───────────
export async function createRealtimeOffer(token: string, model?: string) {
  const noop = () => {};
  const session = await createRealtimeSession(token, noop, model);
  return { pc: session.pc, dc: session.dc, audio: session.audio, stream: session.stream };
}
