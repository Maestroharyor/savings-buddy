import { Request, Response } from "express";
import { createConnection, RowDataPacket } from "mysql2/promise";
import { validateSavingPlan } from "../utils/customValidator";
import { getToken } from "../utils/token";

export const create_group_savings = async (req: Request, res: Response) => {
  const {
    title,
    numberOfPeople,
    hasTarget,
    targetAmount,
    howToSave,
    savingFrequency,
    startDate,
    endDate,
  } = req.body;

  const missingFields = validateSavingPlan(req.body);
  if (missingFields.length) {
    const message = `Missing required fields: ${missingFields.join(", ")}`;

    return res.status(400).json({ success: false, message });
  }
  const ownerId = getToken(req);

  if (!ownerId) {
    return res.status(401).json({
      success: false,
      message: "Valid token not sent for identification",
    });
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Create the savings_plans table if it doesn't exist
    await connection.execute(`
     CREATE TABLE IF NOT EXISTS savings_plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  number_of_people INT NOT NULL,
  has_target BOOLEAN NOT NULL,
  target_amount DECIMAL(10, 2),
  how_to_save TEXT,
  saving_frequency VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
)
    `);

    // Insert group savings plan
    const [result] = await connection.execute(
      `INSERT INTO savings_plans (title, number_of_people, has_target, target_amount, how_to_save, saving_frequency, start_date, end_date, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        numberOfPeople,
        hasTarget,
        targetAmount,
        howToSave,
        savingFrequency,
        startDate,
        endDate,
        ownerId,
      ]
    );
    const savingsPlanId = (result as any).insertId;

    // Get the saved plan data from the database
    const query = await connection.execute(
      `SELECT * FROM savings_plans WHERE id = ?`,
      [savingsPlanId]
    );

    const rows = query[0] as RowDataPacket[];
    // Send the saved plan data back to the user as a response
    res.status(201).json({
      success: true,
      message: "Group savings plan created",
      plan: rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occured",
    });
  } finally {
    connection.end();
  }
};

export const invite_friend_to_plan = async (req: Request, res: Response) => {
  const { savingsPlanId, recipientIds } = req.body;
  const senderId = getToken(req);

  if (!savingsPlanId) {
    return res.status(400).json({
      success: false,
      message: "Missing savings plan id",
    });
  }

  if (!recipientIds) {
    return res.status(400).json({
      success: false,
      message: "Missing recipient ids",
    });
  }

  if (recipientIds.length > 5) {
    return res
      .status(400)
      .json({ message: "You can only invite up to 5 friends" });
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Check if the invitations table exists and create it if it doesn't
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS invitations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      savings_plan_id INT UNSIGNED NOT NULL,
      sender_id INT UNSIGNED NOT NULL,
      recipient_id INT UNSIGNED NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (savings_plan_id) REFERENCES savings_plans(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    ) ENGINE=InnoDB;
  `);

    // Check if the sender is the owner of the savings plan
    const [ownerResult] = await connection.execute(
      `SELECT * FROM savings_plans WHERE id = ? AND owner_id = ?`,
      [savingsPlanId, senderId]
    );

    if ((ownerResult as any[]).length === 0) {
      return res.status(403).json({
        message:
          "You are not authorized to send invitations for this savings plan",
      });
    }

    // Check if the recipients are registered on the platform
    const placeholders = recipientIds.map(() => "?").join(",");
    const query = `SELECT * FROM users WHERE id IN (${placeholders})`;
    const [recipientResult] = await connection.execute(query, recipientIds);

    const existingRecipientIds = (recipientResult as any[]).map(
      (user) => user.id
    );
    const missingRecipientIds = recipientIds.filter(
      (recipientId: any) => !existingRecipientIds.includes(recipientId)
    );

    if (missingRecipientIds.length > 0) {
      return res.status(400).json({
        message: `The following recipient ids are not registered on the platform: ${missingRecipientIds.join(
          ", "
        )}`,
      });
    }

    // Check if invitations have already been sent to recipients for this savings plan
    const [existingInvitationResult] = await connection.execute(
      `SELECT * FROM invitations WHERE savings_plan_id = ? AND recipient_id IN (?)`,
      [savingsPlanId, ...recipientIds]
    );

    const existingInvitationRecipients = (
      existingInvitationResult as any[]
    ).map((invitation) => invitation.recipient_id);

    const duplicateRecipientIds = existingInvitationRecipients.filter(
      (recipientId: any) => recipientIds.includes(recipientId)
    );

    if (duplicateRecipientIds.length > 0) {
      return res.status(400).json({
        message: `Invitation has already been sent to the following recipient ids for this savings plan: ${duplicateRecipientIds.join(
          ", "
        )}`,
      });
    }

    // Insert invitations
    const invitations = recipientIds.map((recipientId: any) => ({
      savingsPlanId,
      senderId,
      recipientId,
      status: "pending",
    }));
    const [result] = await connection.execute(
      `INSERT INTO invitations (savings_plan_id, sender_id, recipient_id, status)
   VALUES ${invitations
     .filter((invitation: any) => invitation)
     .map(() => "(?, ?, ?, ?)")
     .join(", ")}`,
      invitations
        .filter((invitation: any) => invitation)
        .flatMap((invitation: any) => Object.values(invitation))
    );

    const insertIds = (result as any).insertId;

    // Send invitation information back to user
    const [invitationsResult] = await connection.execute(
      `SELECT * FROM invitations WHERE id IN (?)`,
      [insertIds]
    );

    const invitationsInfo = (invitationsResult as any[]).map((invitation) => ({
      id: invitation.id,
      savingsPlanId: invitation.savings_plan_id,
      senderId: invitation.sender_id,
      status: invitation.status,
    }));

    res.json({ message: "Invitations sent", invitations: invitationsInfo });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occured",
    });
  } finally {
    connection.end();
  }
};

export const view_invitation = async (req: Request, res: Response) => {
  const savingsId = req.params.savingsId;

  const { recipientId } = req.body;

  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: "Missing recipient id",
    });
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Check if the invitation exists and the recipient is the intended recipient
    const [result]: any = await connection.execute(
      `SELECT * FROM invitations WHERE savings_plan_id = ? AND recipient_id = ?`,
      [savingsId, recipientId]
    );

    if ((result as any[]).length === 0) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    // const invitation = result[0] as Invitation;
    const invitation = result[0] as any;

    res.status(200).json({
      success: true,
      message: "Invition fetched successfully",
      invitation,
    });
  } catch (error) {
    res.status(500).send({ message: "An error occured" });
  } finally {
    connection.end();
  }
};

export const accept_invitation = async (req: Request, res: Response) => {
  const savingsId = req.params.savingsId;

  const { recipientId, status } = req.body as {
    recipientId: string | number;
    status: string;
  };
  const userID = getToken(req);

  if (userID !== recipientId) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to accept this invitation",
    });
  }

  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: "Missing recipient id",
    });
  }

  if (status !== "accepted" && status !== "rejected") {
    return res.status(400).json({
      success: false,
      message: "Invalid status sent",
    });
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Create invitations table if it doesn't exist
    await connection.execute(`CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    group_id INT NOT NULL,
    status VARCHAR(255) NOT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES savings_plan(id)
  )`);

    // Check if the invitation exists and the recipient is the intended recipient
    const [result] = await connection.execute(
      `SELECT * FROM invitations WHERE savings_plan_id = ? AND recipient_id = ?`,
      [savingsId, recipientId]
    );

    if ((result as any[]).length === 0) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    // Update the status of the invitation
    const [updateResult] = await connection.execute(
      `UPDATE invitations SET status = ? WHERE savings_plan_id = ? AND recipient_id = ?`,
      [status, savingsId, recipientId]
    );

    // If the invitation was accepted, add the recipient to the savings plan
    if (status === "accepted") {
      await connection.execute(`
CREATE TABLE IF NOT EXISTS savings_plan_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  savings_plan_id INT NOT NULL
)

  `);

      const params: any[] = [];

      if (recipientId !== undefined && savingsId !== undefined) {
        params.push(recipientId, savingsId);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid parameter values",
        });
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO savings_plan_users (user_id, savings_plan_id) VALUES (?, ?)`,
        params
      );

      if ((insertResult as any).affectedRows !== 1) {
        return res.sendStatus(500);
      }
      res.json({
        message: "Invitation accepted. You're now part of the savings plan",
      });
    } else {
      res.json({
        message: "Invitation rejected",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occured",
      error,
    });
  } finally {
    connection.end();
  }
};
