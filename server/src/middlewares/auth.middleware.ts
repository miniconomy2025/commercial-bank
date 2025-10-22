import { logger } from '../utils/logger';
import { Account } from '../types/account.type';
import { getAccountFromTeamId } from '../queries/auth.queries';
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


// export function authMiddleware(req: Request, res: Response, next: NextFunction) {

//   let cert;
//   const socket: Socket = req.socket;

//   if(socket instanceof TLSSocket && socket.authorized) {
//     cert = socket.getPeerCertificate()
//   } else {
//     res.status(403).json({ success: false, error: 'tlsCertificateRequired' });
//     return;
//   };

//   try {
//     const organizationUnit = cert.subject.OU;
//     if (!organizationUnit) {
//       res.status(403).json({ success: false, error: 'orgUnitRequiredInCertificate' });
//       return;
//     }
//     req.teamId= organizationUnit;
    
//     next();
//   } catch (error) {
//     logger.error('Certificate processing error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'certificateProcessingError',
//       details: (error as Error).message 
//     });
//   }
// }

export async function accountMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId;
    const account = await getAccountFromTeamId(teamId!);
    if (account == null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }

    req.account = account;
    next();
  }
  catch (error) {
    logger.error('Error fetching account:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
}

export function simulationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow specific endpoints to handle their own auth with custom error messages
  if (req.path === '/charge-interest' || req.path === '/process-installments') {
    next();
    return;
  }
  
  if (req.teamId !== appConfig.thohTeamId) {
    res.status(403).json({ success: false, error: "forbiddenThohOnly" });
    return;
  }

  next();
}

export function dashboardMiddleware(req: Request, res: Response, next: NextFunction) {
  // const dashboardId = req.query.clientId;
  // if (!dashboardId) {
  //   res.status(400).json({ success: false, error: 'dashboardIdRequired' });
  //   return;
  // }
  // if (dashboardId !== appConfig.clientId) {
  //   res.status(400).json({ success: false, error: 'invalidDashboardId' });
  //   return;
  // }

  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction){
  const clientId = req.headers['client-id'] as string;
  if (!clientId) {
    res.status(401).json({ success: false, error: 'invalidClientId' })
  } else {
    // logger.info(`Client-Id: ${clientId}`)
    req.teamId = clientId;
    next();
  }
}