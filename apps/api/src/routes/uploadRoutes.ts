import { Router } from 'express';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';

// The browser compresses the photo and sends it as a base64 data URL. We decode
// it server-side and push the bytes to Vercel Blob — keeps Clerk auth simple and
// avoids the client-upload token handshake.
const photoSchema = z.object({
  dataUrl: z.string().startsWith('data:image/'),
});

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const MAX_BYTES = 6 * 1024 * 1024; // generous ceiling; client downscales well below this

export const uploadRoutes = Router();

uploadRoutes.use(authenticate);

uploadRoutes.post('/uploads/calibration-photo', async (req, res, next) => {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(503).json({ message: 'Photo upload is not configured yet' });
    }

    const parsed = photoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid image payload' });
    }

    const match = parsed.data.dataUrl.match(DATA_URL_RE);
    if (!match) {
      return res.status(400).json({ message: 'Invalid image data' });
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ message: 'Empty image' });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ message: 'Image too large — try again' });
    }

    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const key = `calibrations/${req.user!.organizationId}/${Date.now()}.${ext}`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token,
    });

    return res.status(201).json({ url: blob.url });
  } catch (err) {
    next(err);
  }
});
