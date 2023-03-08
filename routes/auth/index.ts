import express from "express";
const router = express.Router();
import { auth_login, auth_signup } from "../../controllers/authController";

// Authentication Routes

router.post("/signup", auth_signup);

router.post("/login", auth_login);

export default router;
