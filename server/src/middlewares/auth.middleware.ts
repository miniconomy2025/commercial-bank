import { logger } from '../utils/logger';
import { Account } from '../types/account.type';
import { getAccountFromOrganizationUnit } from '../queries/auth.queries';
import { NextFunction, Request, Response } from 'express';
import { TLSSocket } from 'tls';
import { Socket } from 'net';
import appConfig from '../config/app.config';

declare global {
  namespace Express {
    interface Request {
      account?: Account;
      teamId?: string;
    }
  }
}


export function authMiddleware(req: Request, res: Response, next: NextFunction) {

  let cert;
  const socket: Socket = req.socket;

  if(socket instanceof TLSSocket && socket.authorized) {
    cert = socket.getPeerCertificate()
  } else {
    res.status(403).json({ error: 'Tls certificate is required' });
    return;
  };

  try {
    const organizationUnit = cert.subject.OU;
    if (!organizationUnit) {
      res.status(403).json({ error: 'Organization unit is required in the certificate' });
      return;
    }
    req.teamId= organizationUnit;
    
    next();
  } catch (error) {
    logger.error('Certificate processing error:', error);
    res.status(500).json({ 
      error: 'Certificate processing failed',
      details: (error as Error).message 
    });
  }
}

export async function accountMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId;
    const account = await getAccountFromOrganizationUnit(teamId!);
    if (!account) {
      res.status(404).json({ error: 'Account not found for the given organization unit' });
      return;
    }

    req.account = account;
    next();
  } catch (error) {
    logger.error('Error fetching account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export function simulationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.teamId !== appConfig.thohTeamId) {
    res.status(403).json({ error: "Forbidden: Only THOH can access this endpoint" });
    return;
  }

  next();
}

export function dashboardMiddleware(req: Request, res: Response, next: NextFunction) {
  const dashboardId = req.query.clientId;
  if (!dashboardId) {
    res.status(400).json({ error: 'Dashboard ID is required' });
    return;
  }
  if (dashboardId !== appConfig.clientId) {
    res.status(400).json({ error: 'Invalid dashboard ID' });
    return;
  }

  next();
}