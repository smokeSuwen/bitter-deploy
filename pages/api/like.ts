import { NextApiRequest, NextApiResponse } from "next";

import prisma from '@/libs/prismadb';
import serverAuth from "@/libs/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).end();
  }

  try {
    // extract postId
    const postId = req.method === "POST" ? req.body.postId : req.query.postId;

    // extract currentUser
    const { currentUser } = await serverAuth(req, res);

    // check ID
    if (!postId || typeof postId !== 'string') {
      throw new Error('Invalid ID');
    }

    // find post
    const post = await prisma.post.findUnique({
      where: {
        id: postId
      }
    });

    if (!post) {
      throw new Error('Invalid ID');
    }

    // liked list
    let updatedLikedIds = [...(post.likedIds || [])];

    // if user likes
    if (req.method === 'POST') {
      // cuz is the current user to like the post, not others
      updatedLikedIds.push(currentUser.id);
      
      // using this block is that prevent api broke from failed notify creation.
      try {
        const post = await prisma.post.findUnique({
          where: {
            id: postId,
          }
        });
    
        if (post?.userId) {
          await prisma.notification.create({
            data: {
              body: 'Someone liked your tweet!',
              userId: post.userId
            }
          });
    
          await prisma.user.update({
            where: {
              id: post.userId
            },
            data: {
              hasNotification: true
            }
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    // if user don't like
    if (req.method === 'DELETE') {
      updatedLikedIds = updatedLikedIds.filter((likedId) => likedId !== currentUser?.id);
    }

    const updatedPost = await prisma.post.update({
      where: {
        id: postId
      },
      data: {
        likedIds: updatedLikedIds
      }
    });

    return res.status(200).json(updatedPost);
  } catch (error) {
    console.log(error);
    return res.status(400).end();
  }
}