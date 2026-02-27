import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        { error: { message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Validate file type
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { message: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: { message: 'File size must be less than 2MB' } },
        { status: 400 }
      );
    }

    // Validate and whitelist file extension
    const rawExtension = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(rawExtension)) {
      return NextResponse.json(
        { error: { message: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` } },
        { status: 400 }
      );
    }

    // Generate unique filename with validated extension
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${randomBytes(16).toString('hex')}.${rawExtension}`;

    // Verify magic bytes match the claimed file type
    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        { error: { message: 'File content does not match an image format' } },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    // Update user image URL
    const imageUrl = `/uploads/avatars/${filename}`;
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { image: imageUrl },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    // Also update BrandProfile if it exists
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: updatedUser.id },
    });

    if (brandProfile) {
      await prisma.brandProfile.update({
        where: { id: brandProfile.id },
        data: { userAvatar: imageUrl },
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      imageUrl,
    });
  } catch (error) {
    console.error('[API] Error uploading avatar:', error);
    return NextResponse.json(
      { error: { message: 'Failed to upload avatar' } },
      { status: 500 }
    );
  }
}

/**
 * Validate image magic bytes to ensure the file is actually an image.
 * Checks JPEG, PNG, GIF, and WebP signatures.
 */
function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;

  return false;
}
