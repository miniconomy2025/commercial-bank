import { logger } from '../utils/logger';
import { Account } from '../types/account.type';
import { getAccountFromOrganizationUnit } from '../queries/auth.queries';
import { NextFunction, Request, Response } from 'express';
import { TLSSocket } from 'tls';
import { Socket } from 'net';

declare global {
  namespace Express {
    interface Request {
      account?: Account;
      teamId?: string;
    }
  }
}


export async function authMiddleware(req: Request, res: Response, next: NextFunction) {

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