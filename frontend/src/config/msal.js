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

// Access token scope exposed by the backend API registration in Azure
export const TOKEN_REQUEST = {
  scopes: [`api://${clientId}/access_as_user`],
}

export const msalInstance = new PublicClientApplication(msalConfig)
