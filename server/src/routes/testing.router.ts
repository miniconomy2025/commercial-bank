import { response, Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { HttpClient } from "../utils/http-client";

const router = Router();
const httpClient = new HttpClient();

router.get("/status-sumsang-phone", authMiddleware, (req, res) => {
  httpClient.get("https://sumsang-phones-api.projects.bbdgrad.com/public-api/stock").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", error });
    }
  });
});

router.get("/status-commercial-bank", authMiddleware, (req, res) => {
  httpClient.get("https://commercial-bank-api.projects.bbdgrad.com/api/account").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", error });
    }
  });
});

router.get("/status-bulk-logistics", authMiddleware, (req, res) => {
  httpClient.get("https://bulk-logistics-api.projects.bbdgrad.com/api/health").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", error });
    }
  });
});

router.get("/status-consumer-logistics", authMiddleware, (req, res) => {
  httpClient.get("https://consumer-logistics-api.projects.bbdgrad.com/health").subscribe({
    next: (response) => {
      res.json({ status: "ok", message: response});
    },
    error: (error) => {
      res.status(500).json({ status: "error", error });
    }
  });
});

export default router;
