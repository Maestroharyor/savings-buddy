import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { createConnection } from "mysql2/promise";
import routes from "./routes/api";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.use("/api", routes);

app.use("*", (req: Request, res: Response) => {
  res.status(404).send({ message: "Route not found" });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Create Database if it doesn't exist
async function createDatabase() {
  try {
    const connection = await createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`
    );

    // Close connection
    await connection.end();

    console.log("Database created");
  } catch (error) {
    console.log("Database creation error:", error);
  }
}

createDatabase();

// Connect to database
createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})
  .then(() => console.log("Database connected"))
  .catch((error) => console.log("Database connection error:", error));
