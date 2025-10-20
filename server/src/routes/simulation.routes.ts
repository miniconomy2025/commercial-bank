// TODO: Add this file to API spec
// TODO: Add types for request and response in endpoint.types.ts

import { Request, Response, Router } from "express";
import { listAccounts, startSimulation as startSimSvc, stopSimulation as stopSimSvc } from "../services/simulation.service";
import { logger } from "../utils/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { epochStartTime } = req.body as { epochStartTime: number };
  const result = await startSimSvc({ epochStartTime });
  if (!result) {
    res.status(500).json({ success: false, error: 'internalError' });
    return;
  }
  if (result.success) {
    res.status(200).send(result);
  } else if ((result as any).error === 'invalidPayload') {
    res.status(400).json(result);
  } else {
    res.status(500).json(result);
  }
});

router.delete("/", async (_req: Request, res: Response) => {
  const result = await stopSimSvc();
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

router.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const accounts = await listAccounts();
    res.status(200).json({ success: true, accounts });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

export default router;