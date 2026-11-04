import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, resetDbToSeed } from '@/lib/db';
import { saveRuntimeFirebaseConfig, writeToFirestore } from '@/lib/firebase';

export async function PUT(req: NextRequest) {
  try {
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
        authDomain: authDomain ? String(authDomain).trim() : `${String(projectId).trim()}.firebaseapp.com`,
        storageBucket: storageBucket ? String(storageBucket).trim() : `${String(projectId).trim()}.appspot.com`,
        messagingSenderId: messagingSenderId ? String(messagingSenderId).trim() : '',
        appId: appId ? String(appId).trim() : '',
      });

      const currentData = await readDb();
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
    db.settings = {
      ...db.settings,
      ...body.settings,
      // Preserve admin password if masked or empty
      adminPassword:
        body.settings?.adminPassword && body.settings.adminPassword !== '***'
          ? body.settings.adminPassword
          : db.settings.adminPassword,
    };
    const { syncedToFirebase } = await writeDb(db);

    return NextResponse.json({
      success: true,
      syncedToFirebase,
      settings: {
        ...db.settings,
        adminPassword: '***',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save settings' }, { status: 500 });
  }
}
