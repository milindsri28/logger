import { Router, Response } from 'express';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { verifyToken } from '../services/auth.service';
import { sendError } from '../utils/api-error';
import {
  getGitHubAuthorizeRedirect,
  processGitHubOAuthCallback,
} from '../services/oauth/oauth.service';
import {
  connectGitHubForUser,
  loginOrRegisterWithGitHub,
} from '../services/oauth/github-sso.service';
import { logger } from '../utils/logger';

const router = Router();

router.get('/github/authorize', (req: AuthRequest, res: Response) => {
  try {
    const action = req.query.action === 'connect' ? 'connect' : 'login';

    if (action === 'connect') {
      let userId: string | undefined;
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        userId = verifyToken(header.slice(7)).userId;
      } else if (typeof req.query.token === 'string') {
        userId = verifyToken(req.query.token).userId;
      }
      if (!userId) {
        res.status(401).json({ error: 'Authentication required for connect flow' });
        return;
      }
      const url = getGitHubAuthorizeRedirect('connect', userId);
      res.redirect(url);
      return;
    }

    const url = getGitHubAuthorizeRedirect('login');
    res.redirect(url);
  } catch (err) {
    sendError(res, err, 'OAuth authorize failed');
  }
});

router.get('/github/callback', async (req: AuthRequest, res: Response) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    const result = await processGitHubOAuthCallback(code, state);
    const { githubUser, accessToken, refreshToken, scopes, expiresAt, action, userId } = result;

    if (action === 'connect') {
      if (!userId) {
        res.status(400).send('Invalid connect state');
        return;
      }
      await connectGitHubForUser(userId, githubUser, accessToken, refreshToken, scopes, expiresAt);
      res.redirect(`${config.frontendUrl}/integrations?github=connected`);
      return;
    }

    const { token } = await loginOrRegisterWithGitHub(
      githubUser,
      accessToken,
      refreshToken,
      scopes,
      expiresAt
    );
    res.redirect(`${config.frontendUrl}/integrations?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error('OAUTH', 'Callback failed', err instanceof Error ? err.message : String(err));
    res.redirect(`${config.frontendUrl}/integrations?github=error`);
  }
});

export default router;
