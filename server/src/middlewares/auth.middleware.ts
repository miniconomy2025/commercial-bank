import { logger } from '../utils/logger';
import { Account } from '../types/account.type';
import { getAccountFromOrganizationUnit } from '../queries/auth.queries';

declare module 'express-serve-static-core' {
  interface Request {
    account?: Account;
    teamId?: string;
  }
}

const bypassCheckRoutes = [
  { method: 'POST', path: '/accounts' },
  { method: 'POST', path: '/simulation/start' },
];

export async function authMiddleware(req: any, res: any, next: any){
  const cert = req.socket.getPeerCertificate();

  if (!cert || !cert.raw) {
    res.status(403).json({ error: 'Tls certificate is required' });
    return;
  }

  try {
    const organizationUnit = cert.subject.OU;
    if (!organizationUnit) {
      res.status(403).json({ error: 'Organization unit is required in the certificate' });
      return;
    }
    
    const shouldBypassCheck = bypassCheckRoutes.some(
      (route) => route.method === req.method && route.path === req.path
    );

    if (!shouldBypassCheck) {
      const account = await getAccountFromOrganizationUnit(organizationUnit);
      if (!account) {
        res.status(403).json({ error: 'No account found for the provided organization unit' });
        return;
      }
      req.account = account;
    } else {
      req.teamId= organizationUnit;
    }
    
    next();
  } catch (error) {
    logger.error('Certificate processing error:', error);
    res.status(500).json({ 
      error: 'Certificate processing failed',
      details: (error as Error).message 
    });
  }
}