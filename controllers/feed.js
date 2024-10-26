const { validationResult } = require("express-validator");
const Post = require("../models/post");
const User = require("../models/user");
const fs = require("fs");
const path = require("path");
const { console } = require("inspector");

const io = require("../socket");

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage = req.query.page ?? 1;
    const perPage = 2;
    const totalItems = await Post.find().countDocuments();

    let posts = await Post.find()
      .populate("creator", "name")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Fetched posts successfully",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  // console.log(req.body);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed!");
    error.statusCode = 422;
    // console.log("validation error");

    throw error;
  }

  if (!req.file) {
    const error = new Error("No image provided");
    error.statusCode = 422;
    throw error;
  }

  //Create post in db
  const title = req.body.title;
  const content = req.body.content;
  const imagePath = req.file.path;
  const imageUrl = req.file.path.replace("\\", "/");

  const post = new Post({
    title: title,
    content: content,
    imagePath: imagePath,
    imageUrl: imageUrl,
    creator: req.userId,
  });
  try {
    await post.save();
    const user = await User.findById(req.userId);

    user.posts.push(post);
    await user.save();

    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });

    res.status(201).json({
      message: "Post created successfully!",
      post: post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: "Post fetched.", post: post });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  console.log("imageUrl");
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error("Validation failed!");
      error.statusCode = 422;
      error.list = errors.array();
      throw error;
    }

    const postId = req.params.postId;
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    let imagePath;
    if (req.file) {
      imagePath = req.file.path;
      imageUrl = imagePath.replace("\\", "/");
    }

    if (!imageUrl) {
      const error = new Error("No file  Picked.");
      error.statusCode = 422;
      throw error;
    }
    const post = await Post.findById(postId).populate("creator", "name");
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized");
      error.statusCode = 403;
      throw error;
    }
    post.title = title;
    post.content = content;
    if (imagePath) {
      clearImage(post.imagePath);
      post.imageUrl = imageUrl;
      post.imagePath = imagePath;
    }
    const result = await post.save();

    io.getIO().emit("posts", { action: "update", post: result });

    res.status(200).json({ message: "Post updated!", post: result });
  } catch (err) {
    console.error(err);
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  console.log("here");
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Could not find post.");
      error.status = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized");
      error.statusCode = 403;
      throw error;
    }
    clearImage(post.imagePath);

    const postDeletionPromise = Post.findByIdAndDelete(postId);
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    const userSavePromise = user.save(); // Start saving without waiting
    await Promise.all([postDeletionPromise, userSavePromise]);
    io.getIO().emit("posts", { action: "delete", post: postId });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    next(err);
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};
