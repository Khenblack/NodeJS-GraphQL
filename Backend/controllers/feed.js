const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator/check');

const { getIO } = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

const getPosts = async (req, res, next) => {
  try {
    const currentPage = req.query.page || 1;
    const perPage = 2;

    const [totalItems, posts] = await Promise.all([
      Post.find().countDocuments(),
      Post.find()
        .populate('creator')
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
    ]);
    return res.status(200).json({
      message: 'Fetched posts successfully.',
      totalItems: totalItems,
      posts: posts
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entered data is incorrect.');
      error.status = 422;
      throw error;
    }
    if (!req.file) {
      const error = new Error('No image provided.');
      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path;
    const { title, content } = req.body;

    const post = new Post({
      title,
      content,
      imageUrl,
      creator: req.userId
    });

    const [result, user] = await Promise.all([
      post.save(),
      User.findById(req.userId)
    ]);
    user.posts.push(result);
    const creator = await user.save();

    getIO().emit('posts', {
      action: 'create',
      post: { ...result._doc, creator: { _id: req.userId, name: user.name } }
    });
    return res.status(201).json({
      message: 'Post created successfully!',
      post: result,
      creator: {
        _id: creator._id,
        name: creator.name
      }
    });
  } catch (error) {
    if (error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const id = req.params.id;
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    return res.status(200).json({ message: 'Post fetched.', post: post });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entered data is incorrect.');
      error.status = 422;
      throw error;
    }

    const { id } = req.params;
    const { title, content, image } = req.body;
    let imageUrl = req.body.image;
    if (req.file) {
      imageUrl = req.file.path;
    }
    if (!image) {
      const error = new Error('No file picked.');
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized.');
      error.statusCode = 403;
      throw error;
    }
    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }
    post.title = title;
    post.imageUrl = imageUrl;
    post.content = content;

    const updatedPost = await post.save();
    getIO().emit('posts', { action: 'update', post: updatedPost });
    return res
      .status(201)
      .json({ message: 'Post updated.', post: updatedPost });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized.');
      error.statusCode = 403;
      throw error;
    }
    clearImage(post.imageUrl);
    await post.remove();
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();

    getIO().emit('posts', { action: 'delete', post: id });
    res.status(200).json({ message: 'Deleted post.' });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log(err));
};

module.exports = {
  getPosts,
  createPost,
  getPost,
  updatePost,
  deletePost
};
