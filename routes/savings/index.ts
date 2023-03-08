import express from "express";
const router = express.Router();
import {
  accept_invitation,
  create_group_savings,
  invite_friend_to_plan,
  view_invitation,
} from "../../controllers/savingsController";
import { tokenVerify } from "../../utils/token";

// Saving Routes

router.post("/create-group-savings", tokenVerify, create_group_savings);

router.post("/invite", tokenVerify, invite_friend_to_plan);

router.get("/invitations/:savingsId", tokenVerify, view_invitation);

router.post("/invitations/:savingsId", tokenVerify, accept_invitation);

export default router;
