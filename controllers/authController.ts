import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createConnection, RowDataPacket } from "mysql2/promise";
import { createToken } from "../utils/token";

export const auth_signup = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password)
      return res.status(400).json({ message: "Password is required" });
  }

  const pass = password;

  // Hash password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Insert user into database
  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.execute(
      "CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL)"
    );

    await connection.execute(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hashedPassword]
    );
    // Get the inserted user
    const query = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    const rows = query[0] as RowDataPacket[];

    const user = rows[0];

    // Generate JWT token
    const token = createToken(user.id);

    const { password, ...userResponse } = user;
    res.status(201).send({
      success: true,
      message: "User created",
      token: token,
      user: userResponse,
    });
  } catch (error: any) {
    if (error.errno === 1062) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }
    res.status(500).send({ message: "An error occured", error });
  } finally {
    connection.end();
  }
};

export const auth_login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password)
      return res.status(400).json({ message: "Password is required" });
  }
  const pass = password;

  // Check if user exists
  const connection = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const query = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    const rows = query[0] as RowDataPacket[];

    const user = rows[0];

    if (!user) {
      res.status(401).json({ message: "Email not registered" });
      return;
    }

    // Check password
    const passwordMatches = await bcrypt.compare(pass, user.password);

    if (!passwordMatches) {
      res.status(401).json({ message: "Incorrect password" });
      return;
    }

    // Generate JWT token
    const token = createToken(user.id);

    const { password, ...userResponse } = user;
    res.status(201).send({
      success: true,
      message: "User created",
      token: token,
      user: userResponse,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving user from database", error });
  } finally {
    connection.end();
  }
};
