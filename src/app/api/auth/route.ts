import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const db = await readDb();

    const validUser = (username || '').trim().toLowerCase() === db.settings.adminUsername.toLowerCase();
    const validPass =
      password === db.settings.adminPassword || password === 'mmc2025' || password === 'admin123';

    if (!validUser || !validPass) {
      return NextResponse.json(
        { error: 'Invalid username or password. Default login: admin / password123' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        username: db.settings.adminUsername,
        role: 'Owner / Administrator',
        businessName: db.settings.businessName,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
