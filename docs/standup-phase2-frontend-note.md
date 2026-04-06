Use `api.realtime.createStandupClientSecret()` first, then take `clientSecret.client_secret.value` and pass it into `createRealtimeOffer()`.

When the browser receives a completed user transcript, call the existing `api.standup.completeTurnText()` endpoint and inject the returned `pmFollowUp` back into the realtime session as the next assistant turn.
