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
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: { message: 'File must be an image' } },
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

    // Generate unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = file.name.split('.').pop();
    const filename = `${randomBytes(16).toString('hex')}.${extension}`;

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
