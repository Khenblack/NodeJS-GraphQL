const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');

module.exports = {
    async createUser({ userInput }, req) {
        const { email, name, password } = userInput;
        const errors = [];
        if (!validator.isEmail(email)) {
            errors.push({message: 'E-Mail is invalid.'});
        }
        if (validator.isEmpty(password) || !validator.isLength(password, {min: 5})) {
            errors.push({message: 'Password too short!.'});
        }

        if (errors.length > 0) {
            const error = new Error('Invalid Input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            const error = new Error('User exsist already!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const hashedPassword = bcrypt.hashSync(password);
        const user = new User({
            email,
            name,
            password: hashedPassword
        });
        const createdUser = await user.save();
        return {
            ...createdUser._doc, _id: createdUser._id.toString()
        }
    },
    async login({ email, password }) {
        const user = await User.findOne({email});
        if (!user) {
            const error = new Error('User not found.');
            error.code = 401;
            throw error;
        }
        if (!bcrypt.compareSync(password, user.password)) {
            const error = new Error('Password is incorrect.');
            error.code = 401;
            throw error;
        }

        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        }, 'somesupersecretsecret', {
            expiresIn: '1h'
        });
        return { token, userId: user._id.toString() }
    },
    async createPost({ postInput }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = [];
        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
            errors.push({ message: 'Title is invalid.' });
        }
        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, { min: 5 })) {
            errors.push({ message: 'COntent is invalid.' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid Input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('Invalid User.');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        // add post to users posts
        return {...createdPost._doc, _id: createdPost._id.toString(), createdAt: createdPost.createdAt.toISOString(), updatedAt: createdPost.updatedAt.toISOString()};
    },
    async posts ({}, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find().sort({createdAt: -1}).populate('creator');

        return {
            totalPosts,
            posts: posts.map(p => {
                return {...p._doc, _id: p._id.toString(), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString()}
                }
            )
        }
    }
};