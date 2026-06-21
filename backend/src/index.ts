import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import todoRoutes from "./app";
import connectDb from "./connectDb";

const PORT = process.env.PORT || 3200;

const app = express();
app.use(express.json());
app.use(cors());

app.use("/todos", todoRoutes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Hello World 🚀",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not Found.",
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
  connectDb();
});
