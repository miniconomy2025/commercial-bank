import { Request, Response, Router } from 'express';
import { performInterbankTransfer } from '../queries/interbank.queries';
import { Post_InterbankTransfer_Req, Post_InterbankTransfer_Res } from '../types/endpoint.types';

//=============== /interbank ==============//

const router = Router()

// Send money to us from another bank
router.post("/transfer", async (req: Request<{}, {}, Post_InterbankTransfer_Req>, res: Response<Post_InterbankTransfer_Res>) => {
  if (req.teamId !== 'retail-bank') {
    res.status(403).json({ success: false, error: "transferNotPermitted" });
    return;
  }
  const { transaction_number, from_account_number, to_account_number, amount, description } = req.body;

  if (!transaction_number || !from_account_number || !to_account_number || !amount || !description) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }

  try {
    const result = await performInterbankTransfer(
      transaction_number,
      from_account_number,
      to_account_number,
      amount,
      description
    );
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "internalError" });
    }
  }
  catch (error) {
    console.error("Error processing interbank transfer:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

export default router;
