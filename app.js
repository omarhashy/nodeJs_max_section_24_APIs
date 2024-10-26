//Const variables
const PORT = process.env.PORT;
const DB_URL = `mongodb+srv://omarhashy:${process.env.DB_PASSWORD}@cluster0.qzjhm.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

//node modules
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

//routes
const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");
const { error } = require("console");

//express app
const app = express();

//multer configuration
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images/");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
    return;
  }
  cb(null, false);
};

//middlewares
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type , Authorization");

  next();
});

// GET /feed/posts
app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

//error handling
app.use((err, req, res, next) => {
  const status = err.statusCode ?? 500;
  const message = err.message;
  const data = error.data;
  res.status(status).json({
    message: message,
    error: err,
    data: data,
  });
});

//server
mongoose
  .connect(DB_URL)
  .then(() => {
    console.log("connected");
    const appServer = app.listen(PORT);

    const io = require("./socket").init(appServer);
      
    io.on("connection", (socket) => {
      console.log("Client connected");
    });
  })
  .catch((err) => {
    console.log(err);
  });
