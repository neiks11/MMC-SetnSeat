import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, resetDbToSeed } from '@/lib/db';
import { saveRuntimeFirebaseConfig, writeToFirestore } from '@/lib/firebase';
import {
  appendAuditLog,
  getClientIp,
  hashPasswordScrypt,
  sanitizeText,
  verifyAdminRequest,
} from '@/lib/security';

export async function PUT(req: NextRequest) {
  try {
    const adminSession = verifyAdminRequest(req);
    if (!adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (body.action === 'save_firebase_config') {
      const { apiKey, projectId, authDomain, storageBucket, messagingSenderId, appId } =
        body.firebaseConfig || {};
      if (!apiKey || !projectId) {
        return NextResponse.json(
          { error: 'Firebase API Key and Project ID are required.' },
          { status: 400 }
        );
      }

      saveRuntimeFirebaseConfig({
        apiKey: String(apiKey).trim(),
        projectId: String(projectId).trim(),
        authDomain: authDomain
          ? String(authDomain).trim()
          : `${String(projectId).trim()}.firebaseapp.com`,
        storageBucket: storageBucket
          ? String(storageBucket).trim()
          : `${String(projectId).trim()}.firebasestorage.app`,
        messagingSenderId: messagingSenderId ? String(messagingSenderId).trim() : '',
        appId: appId ? String(appId).trim() : '',
      });

      const currentData = await readDb();
      appendAuditLog(currentData, {
        actor: adminSession.sub,
        role: 'admin',
        action: 'FIREBASE_CONFIG_UPDATED',
        ip: getClientIp(req),
        details: `Updated Firebase configuration for project "${String(projectId).trim()}"`,
      });
      const synced = await writeToFirestore(currentData);

      return NextResponse.json({
        success: true,
        syncedToFirebase: synced,
        projectId: String(projectId).trim(),
      });
    }

    if (body.action === 'reset_seed') {
      const fresh = await resetDbToSeed();
      return NextResponse.json({ success: true, state: fresh });
    }

    if (body.action === 'mark_notifications_read') {
      const db = await readDb();
      db.notifications.forEach((n) => {
        n.read = true;
      });
      await writeDb(db);
      return NextResponse.json({ success: true, notifications: db.notifications });
    }

    const db = await readDb();
    let updatedPasswordHash = db.settings.adminPassword;

    if (
      body.settings?.adminPassword &&
      body.settings.adminPassword !== '***' &&
      body.settings.adminPassword !== db.settings.adminPassword
    ) {
      const rawNewPass = String(body.settings.adminPassword);
      if (rawNewPass.length < 10) {
        return NextResponse.json(
          { error: 'New admin password must be at least 10 characters long.' },
          { status: 400 }
        );
      }
      updatedPasswordHash = hashPasswordScrypt(rawNewPass);
    }

    db.settings = {
      ...db.settings,
      ...body.settings,
      businessName: sanitizeText(
        body.settings?.businessName ?? db.settings.businessName,
        120
      ),
      adminUsername: sanitizeText(
        body.settings?.adminUsername ?? db.settings.adminUsername,
        64
      ),
      adminPassword: updatedPasswordHash,
    };

    appendAuditLog(db, {
      actor: adminSession.sub,
      role: 'admin',
      action: 'SETTINGS_UPDATED',
      ip: getClientIp(req),
      details: 'Updated business settings.',
    });

    const { syncedToFirebase } = await writeDb(db);

    return NextResponse.json({
      success: true,
      syncedToFirebase,
      settings: {
        ...db.settings,
        adminPassword: '***',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }
}
