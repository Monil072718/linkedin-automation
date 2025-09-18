const express = require('express');
const Post = require('../models/Post');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// create scheduled post
router.post('/', requireAuth, async (req, res) => {
  const { content, scheduleDate, media } = req.body;
  if (!content || !scheduleDate) return res.status(400).json({ error: 'content and scheduleDate required' });

  const post = new Post({
    user: req.user._id,
    content,
    scheduleDate: new Date(scheduleDate),
    media: media || []
  });

  await post.save();
  res.json({ ok: true, post });
});

// list user's posts
router.get('/', requireAuth, async (req, res) => {
  const posts = await Post.find({ user: req.user._id }).sort({ scheduleDate: -1 });
  res.json(posts);
});

// edit pending post
router.put('/:id', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.user.equals(req.user._id)) return res.status(403).json({ error: 'Not allowed' });
  if (post.status !== 'pending') return res.status(400).json({ error: 'Only pending posts can be edited' });

  const { content, scheduleDate, media } = req.body;
  if (content) post.content = content;
  if (scheduleDate) post.scheduleDate = new Date(scheduleDate);
  if (media) post.media = media;
  await post.save();
  res.json(post);
});

// delete pending post
router.delete('/:id', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.user.equals(req.user._id)) return res.status(403).json({ error: 'Not allowed' });
  if (post.status !== 'pending') return res.status(400).json({ error: 'Only pending posts can be deleted' });

  await post.remove();
  res.json({ ok: true });
});

module.exports = router;
