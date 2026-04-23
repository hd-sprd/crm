import { PublicClientApplication } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID

const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Standard OIDC scopes — no "Expose an API" setup needed in Azure.
// The ID token (result.idToken) carries oid + roles claims for the backend.
export const TOKEN_REQUEST = {
  scopes: ['openid', 'profile', 'email'],
}

export const msalInstance = new PublicClientApplication(msalConfig)
