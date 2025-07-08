import { Router } from "express";
import appConfig from "../config/app.config";
import { authMiddleware } from "../middlewares/auth.middleware";
import { HttpClient } from "../utils/http-client";
import { logger } from "../utils/logger";

const router = Router();
const httpClient = new HttpClient();

router.get("/status", authMiddleware, (req, res) => {
  if (appConfig.isDev) {
    const { name, verbose } = req.query;
    if (verbose) {
      logger.info("Received GET request with query parameters:", { name, verbose });
    }
    
    res.json({ status: "ok", message: "mTLS endpoint is working!" });
    httpClient
      .request({
        url: "https://localhost:8443/status",
        method: "GET",
        query: { name: "Indie", verbose: true },
      })
      .subscribe({
        next: (response: any) => logger.info("Data:", response.data),
        error: (err: any) => logger.error(err.message),
      });
  }
});

router.post("/status", authMiddleware, (req, res) => {
    if (appConfig.isDev) {
        logger.info("Received POST request with body:", req.body);
        res.json({ status: "ok", message: "mTLS POST endpoint is working!" });
    }
});

router.get("/status-unauthed", (req, res) => {
  if (appConfig.isDev) {
    res.json({ status: "ok", message: "dashboard endpoint is working!" });
  }
});

export default router;
