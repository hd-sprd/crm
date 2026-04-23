import { PublicClientApplication } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage clears on tab close; no cross-tab token sharing needed
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Request standard OIDC scopes — no "Expose an API" setup needed in Azure.
// The ID token (result.idToken) carries oid + roles claims for the backend.
export const TOKEN_REQUEST = {
  scopes: ['openid', 'profile', 'email'],
}

export const msalInstance = new PublicClientApplication(msalConfig)
