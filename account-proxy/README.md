## YouTube Account Proxy

<b>Note: This is not a part of the browser script!</b>
<br>If you only want to watch age-restricted videos, follow <a href="https://github.com/zerodytrash/Simple-YouTube-Age-Restriction-Bypass#installation">these instructions</a> (but why would you be looking at this branch anyway)</a>.

This is the account proxy server rewritten to be a single script, easily installable on a cloudflare worker. It also acts as the video proxy (to prevent region mismatch between account and video proxy). You can sign up for a Cloudflare account and deploy your own account proxy using your age-verified YouTube account. (TODO: enable age-unverified account bypass)

### Installation (TODO)
1. <a href="https://dash.cloudflare.com/?to=/:account/workers">Sign in/up to Cloudflare and open the Worker Dashboard.</a>
2. On the dashboard, click Create a Worker, then paste `script.js` to the script tab (left side).
3. Click Save and Deploy, then click the back button.
4. On the Worker Manager, open the settings tab, then add these environment variables (preferably encrypted):

````
SAPISID: <Cookie value "SAPISID">
PSID: <Cookie value "__Secure-3PSID">
````
