const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

const signUp = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    const { email, name, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 12);
    const user = new User({
      email,
      password: hashedPassword,
      name
    });
    const newUser = await user.save();
    return res
      .status(200)
      .json({ message: 'User created!', userId: newUser._id });
  } catch (error) {
    if (error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('A user with this email could not be found.');
      error.statusCode = 401;
      throw error;
    }
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      const error = new Error('Wrong password!');
      error.statusCode = 401;
      throw error;
    }
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      'sectret',
      { expiresIn: '1h' }
    );
    return res.status(200).json({ token, userId: user._id.toString() });
  } catch (error) {
    if (error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return res.status(200).json({ status: user.status });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

const setUserStatus = async (req, res, next) => {
  try {
    const newStatus = req.body.status;
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    user.status = newStatus;
    await user.save();
    return res.status(200).json({ message: 'User updated.' });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

module.exports = { signUp, login, getUserStatus, setUserStatus };
