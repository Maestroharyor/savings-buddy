import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const maxAge = 3 * 24 * 60 * 60;
const JTWSign = `${process.env.JWT_SECRET}`;

export const decodeToken = (token: string) => {
  try {
    const decodedToken: any = jwt.verify(token, JTWSign);
    return decodedToken.userID;
  } catch (err) {
    // Handle error here (e.g., throw an error or return null)
    return null;
  }
};

export const getToken = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [bearer, token] = authHeader.split(" ");

  if (bearer !== "Bearer" || !token) {
    return null;
  }

  return decodeToken(token);
};

export const tokenVerify = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.substr(7);

    jwt.verify(token, JTWSign, (err, decodedToken) => {
      if (err) {
        res.status(400).send({ error: "Invalid Token Gotten" });
      } else {
        next();
      }
    });
  } else {
    res.status(400).send({
      error:
        "Unauthorized access detected!!! Please pass in your token access to continue",
    });
  }
};

export const createToken = (id: string) => {
  return jwt.sign({ userID: id }, JTWSign, {
    expiresIn: "10h",
  });
};
// export const isAdmin
