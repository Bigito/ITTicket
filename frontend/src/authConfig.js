export const msalConfig = {
  auth: {
    clientId: "66014dbc-b020-4259-8714-c0e288185e2d",
    authority: "https://login.microsoftonline.com/rocks.co.th",
    redirectUri: "https://support.rocksgroup.com/",
    postLogoutRedirectUri: "https://support.rocksgroup.com/"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"]
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};

