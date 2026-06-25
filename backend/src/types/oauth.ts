export type OAuthAction = 'login' | 'connect';

export interface OAuthStatePayload {
  action: OAuthAction;
  userId?: string;
  nonce: string;
}

export interface GitHubTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
}
