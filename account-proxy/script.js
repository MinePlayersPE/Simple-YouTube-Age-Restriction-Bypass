const clientDefaults = {
    "WEB": "2.20210818.00.00",
    "WEB_REMIX": "1.20210804.00.00",
    "ANDROID": "16.29.39",
    "IOS": "16.29.39"
}
const encoder = new TextEncoder();
addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  );
});

const timenameNameToOffset = function(tz) { // https://stackoverflow.com/a/68593283
  const date = new Date()
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate.getTime() - utcDate.getTime()) / 6e4;
}
const generateSidBasedAuth = async function (sapisid, origin) {
  const timestamp = Math.floor(new Date().getTime() / 1000);
  const input = timestamp + " " + sapisid + " " + origin;
  const hash_result = await crypto.subtle.digest('SHA-1', encoder.encode(input));
  const hash_array = Array.from(new Uint8Array(hash_result));
  const hash = hash_array.map(b => b.toString(16).padStart(2, '0')).join('');
  return "SAPISIDHASH " + timestamp + "_" + hash;
}
const generatePlayerRequestInit = async function (videoId, clientName, clientVersion, signatureTimestamp, request) {
    if (!clientName) clientName = "WEB";
    if (!clientVersion) clientVersion = clientDefaults[clientName];
    if (!signatureTimestamp) signatureTimestamp = Math.floor(new Date().getTime()/86400000);
    const cfprops = request?.cf
    const origin = "https://www.youtube.com";

    const body = {
        "videoId": videoId,
        "context": {
            "client": {
                "hl": "en",
                "gl": cfprops?.country || "US",
                "deviceMake": "",
                "deviceModel": "",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0,gzip(gfe)",
                "clientName": clientName,
                "clientVersion": clientVersion,
                "originalUrl": "https://www.youtube.com/watch?v=" + videoId,
                "screenPixelDensity": 1,
                "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                "screenDensityFloat": 1,
                "timeZone": cfprops?.timezone || "Asia/Jakarta",
                "browserName": "Firefox",
                "browserVersion": "91.0",
                "screenWidthPoints": 1920,
                "screenHeightPoints": 1080,
                "utcOffsetMinutes": cfprops?.timezone ? timenameNameToOffset(cfprops.timezone) : 420,
                "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
                "connectionType": "CONN_CELLULAR_4G",
                "playerType": "UNIPLAYER",
                "clientScreen": "WATCH_FULL_SCREEN"
            },
            "user": {
                "lockedSafetyMode": false
            },
            "request": {
                "useSsl": true,
                "internalExperimentFlags": [],
                "consistencyTokenJars": []
            },
        },
        "playbackContext": {
            "contentPlaybackContext": {
                "html5Preference": "HTML5_PREF_WANTS",
                "lactMilliseconds": "-1",
                "referer": "https://www.youtube.com/watch?v=" + videoId,
                "signatureTimestamp": signatureTimestamp,
                "autoCaptionsDefaultOn": false,
                "autoplay": true,
                "mdxContext": {},
                "playerWidthPixels": 1920,
                "playerHeightPixels": 1080
            }
        },
        "captionParams": {},
        "racyCheckOk": true,
        "contentCheckOk": true
    }
    const headers =  {
        "Cookie": `SAPISID=${SAPISID}; __Secure-3PAPISID=${SAPISID}; __Secure-3PSID=${PSID};`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0,gzip(gfe)",
        "Content-Type": "application/json",
        "Authorization": await generateSidBasedAuth(SAPISID, origin),
        "X-Origin": origin,
        "X-Youtube-Client-Name": clientName,
        "X-Youtube-Client-Version": clientVersion,
        "Accept-Language": "en-US,en;q=0.5",
        "Origin": origin,
        "Referer": "https://www.youtube.com/watch?v=" + videoId
    }
    return {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      cf: {cacheTtl: 600}
    }
}

const stripPlayerResponse = function (response) {
    return {
        "playabilityStatus": response.playabilityStatus,
        "streamingData": response.streamingData,
        "captions": response.captions,
        "videoDetails": response.videoDetails,
        "playerConfig": response.playerConfig, // Needs more thorough checking?
        "storyboards": response.storyboards,
        "microformat": response.microformat, // WEB
        "cards": response.cards,
        "attestation": response.attestation,
        "endscreen": response.endscreen,
        "auxiliaryUi": response.auxiliaryUi, // ANDROID
        "overlay": response.overlay // IOS
    }
}

/**
 * Many more examples available at:
 *   https://developers.cloudflare.com/workers/examples
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const { pathname, searchParams } = new URL(request.url);
  if (!pathname.startsWith("/getPlayer") && !pathname.startsWith("/direct/")) {
    return new Response('This server only serves the /getPlayer and /direct/ endpoint.', {
      status: 404,
    });
  }
  if (pathname.startsWith("/direct/")) {
      url = atob(pathname.substring(8))
      parsed_url = new URL(url)
      if (!(parsed_url.hostname.indexOf(".googlevideo.com") > 0)) {
          return new Response('Proxied URL not from googlevideo.com', {
              status: 403,
          })
      }
      return fetch(url, {cf: {cacheTtl: 3600}})
  }
  if (!searchParams.get('videoId') || searchParams.get('videoId').length !== 11) {
    return new Response('videoId is not found or is invalid', {
      status: 400,
    });
  }
  const videoId = searchParams.get('videoId')
  const clientName = searchParams.get('clientName')
  const clientVersion = searchParams.get('clientVersion')
  const signatureTimestamp = parseInt(searchParams.get('signatureTimestamp'))

  const init = await generatePlayerRequestInit(videoId, clientName, clientVersion, signatureTimestamp, request)
  const player_fetch = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', init)
  const player_response = await player_fetch.json()
  return new Response(JSON.stringify(stripPlayerResponse(player_response)), {
      headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
      }
  })
  //return fetch("https://welcome.developers.workers.dev");
}