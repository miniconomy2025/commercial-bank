import { response, Router } from "express";
import appConfig from "../config/app.config";
import { authMiddleware } from "../middlewares/auth.middleware";
import { HttpClient } from "../utils/http-client";
import { logger } from "../utils/logger";

const router = Router();
const httpClient = new HttpClient();

router.get("/status-sumsang-phone", authMiddleware, (req, res) => {
  httpClient.get("https://retail-bank-api.projects.bbdgrad.com/accounts").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", response });
    }
  });
});

router.get("/status-retail-bank", authMiddleware, (req, res) => {
  httpClient.get("https://sumsang-phones-api.projects.bbdgrad.com/public-api/stock").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", response });
    }
  });
});

export default router;
