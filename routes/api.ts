import express from "express";
const router = express.Router();

import authRoutes from "./auth";
import savingsRoutes from "./savings";

// Routes
router.use("/auth", authRoutes);
router.use("/savings", savingsRoutes);

export default router;
