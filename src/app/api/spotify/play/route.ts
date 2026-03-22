import { NextRequest, NextResponse } from 'next/server';
import {
  getDevices,
  getPlaybackState,
  getStoredTokens,
  hydrateStoredTokensFromCookies,
  playPlaylist,
  playTrack,
  transferPlayback,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';

export async function POST(request: NextRequest) {
  try {
    hydrateStoredTokensFromCookies(request.cookies);
    const tokens = getStoredTokens();
    const hasAccessToken = Boolean(tokens?.accessToken?.trim());
    const hasRefreshToken = Boolean(tokens?.refreshToken?.trim());
    const scopes = tokens?.scopes ?? [];
    const hasPlaybackScope = scopes.includes('user-modify-playback-state');

    const body = await request.json().catch(() => ({}));
    const trackUri = typeof body.trackUri === 'string' ? body.trackUri.trim() : '';
    const playlistUri = typeof body.playlistUri === 'string' ? body.playlistUri.trim() : '';
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    const hasPlaybackTarget = Boolean(trackUri || playlistUri);
    const resumeRequested = !hasPlaybackTarget;

    console.info('spotify.play.request', {
      trackUri: trackUri || null,
      playlistUri: playlistUri || null,
      deviceId: deviceId || null,
      resumeRequested,
    });
    console.info('spotify.play.session', {
      connected: hasAccessToken || hasRefreshToken,
      hasAccessToken,
      hasRefreshToken,
      scopes,
      hasPlaybackScope,
    });

    if (!tokens || (!hasAccessToken && !hasRefreshToken)) {
      return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 });
    }

    if (!hasPlaybackScope) {
      return NextResponse.json(
        {
          ok: false,
          error: 'missing_scope',
          scope: 'user-modify-playback-state',
        },
        { status: 403 },
      );
    }

    let currentPlayback =
      resumeRequested
        ? await getPlaybackState()
        : null;

    if (resumeRequested) {
      console.info('spotify.play.resume_context', {
        hasPlayback: Boolean(currentPlayback),
        isPlaying: currentPlayback?.is_playing ?? null,
        currentTrackUri: currentPlayback?.current_track?.uri ?? null,
        currentDeviceId: currentPlayback?.device_id ?? null,
      });

      if (!currentPlayback?.current_track) {
        return NextResponse.json(
          {
            ok: false,
            error: 'no_playback_context',
            message: 'No playback context to resume',
          },
          { status: 400 },
        );
      }
    }

    let resolvedDeviceId = deviceId || currentPlayback?.device_id || null;
    let availableDevices: Array<{ id: string; name: string; is_active: boolean }> = [];
    let selectedDeviceSource:
      | 'provided'
      | 'resume-context'
      | 'active'
      | 'fallback'
      | null = resolvedDeviceId ? (deviceId ? 'provided' : 'resume-context') : null;
    let transferRequired = false;

    console.info('spotify.play.device_lookup.start', {
      deviceIdSupplied: Boolean(deviceId),
    });

    try {
      availableDevices = await getDevices();
      const activeDevice = availableDevices.find((device) => device.is_active) ?? null;
      const matchedDevice = resolvedDeviceId
        ? availableDevices.find((device) => device.id === resolvedDeviceId) ?? null
        : null;

      if (!resolvedDeviceId) {
        if (activeDevice) {
          resolvedDeviceId = activeDevice.id;
          selectedDeviceSource = 'active';
        } else if (availableDevices.length > 0) {
          resolvedDeviceId = availableDevices[0].id;
          selectedDeviceSource = 'fallback';
          transferRequired = true;
        }
      } else if (matchedDevice && !matchedDevice.is_active) {
        transferRequired = true;
      }

      console.info('spotify.play.device_lookup.complete', {
        deviceCount: availableDevices.length,
        activeDeviceId: activeDevice?.id ?? null,
        activeDeviceName: activeDevice?.name ?? null,
        selectedDeviceId: resolvedDeviceId,
        selectedDeviceSource,
        transferRequired,
      });
    } catch (error) {
      console.warn('spotify.play.device_lookup_failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    if (!resolvedDeviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_active_device',
          message: 'Open Spotify on a device first',
          availableDevices,
        },
        { status: 503 },
      );
    }

    if (transferRequired) {
      console.info('spotify.play.transfer.start', {
        deviceId: resolvedDeviceId,
      });
      await transferPlayback(resolvedDeviceId, false);
      console.info('spotify.play.transfer.complete', {
        deviceId: resolvedDeviceId,
      });
    }

    console.info('spotify.play.upstream_request', {
      endpoint: '/v1/me/player/play',
      deviceId: resolvedDeviceId,
      kind: playlistUri ? 'playlist' : trackUri ? 'track' : 'resume',
      payload: playlistUri
        ? { context_uri: playlistUri }
        : trackUri
          ? { uris: [trackUri] }
          : { resume: true },
    });

    if (playlistUri) {
      await playPlaylist(playlistUri, resolvedDeviceId);
    } else if (trackUri) {
      await playTrack(trackUri, resolvedDeviceId);
    } else {
      await playTrack(undefined, resolvedDeviceId);
    }

    const response = NextResponse.json({
      ok: true,
      success: true,
      mode: playlistUri ? 'playlist' : trackUri ? 'track' : 'resume',
      deviceId: resolvedDeviceId,
      transferred: transferRequired,
    });
    syncStoredTokensToResponse(response, getStoredTokens());
    return response;
  } catch (error) {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : null;
    const body =
      typeof error === 'object' && error !== null && 'body' in error
        ? (error as { body?: unknown }).body
        : null;
    const message = error instanceof Error ? error.message : String(error);

    console.error('spotify.play.error', {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      statusCode,
      body,
    });

    const normalizedBody = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    const bodyMessage =
      normalizedBody && typeof normalizedBody.error === 'object' && normalizedBody.error !== null && 'message' in normalizedBody.error && typeof (normalizedBody.error as { message?: unknown }).message === 'string'
        ? (normalizedBody.error as { message: string }).message
        : typeof normalizedBody?.message === 'string'
          ? normalizedBody.message
          : '';

    if (
      statusCode === 404 ||
      message.includes('NO_ACTIVE_DEVICE') ||
      bodyMessage.toLowerCase().includes('active device')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_active_device',
          message: 'Open Spotify on a device first',
        },
        { status: 503 },
      );
    }

    if (statusCode === 403 || bodyMessage.toLowerCase().includes('premium')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'premium_required',
          message: 'Spotify Premium is required for playback',
          status: statusCode ?? 403,
          body,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'spotify_playback_error',
        detail: message,
        status: statusCode,
        body,
      },
      { status: statusCode ?? 500 },
    );
  }
}
