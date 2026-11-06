import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { InventoryItem } from '@/lib/types';
import {
  appendAuditLog,
  getClientIp,
  sanitizeText,
  validateInventoryPayload,
  verifyAdminRequest,
} from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const adminSession = verifyAdminRequest(req);
    if (!adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const check = validateInventoryPayload(body);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const db = await readDb();

    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      sku: sanitizeText(body.sku || `MMC-${Math.floor(100 + Math.random() * 900)}`, 32),
      name: sanitizeText(body.name || 'New Rental Item', 120),
      category: body.category || 'Chairs',
      description: sanitizeText(body.description || '', 500),
      pricePerDay: Number(body.pricePerDay) || 0,
      totalStock: Number(body.totalStock) || 0,
      imageUrl:
        body.imageUrl ||
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=900&q=80',
      featured: Boolean(body.featured),
      active: body.active !== undefined ? Boolean(body.active) : true,
      guestCapacity: body.guestCapacity ? Number(body.guestCapacity) : undefined,
      includedItems: Array.isArray(body.includedItems) ? body.includedItems : undefined,
      replacementFee: Number(body.replacementFee) || 500,
      unitLabel: sanitizeText(body.unitLabel || 'per unit / day', 40),
    };

    db.inventory.push(newItem);
    appendAuditLog(db, {
      actor: adminSession.sub,
      role: 'admin',
      action: 'INVENTORY_CREATE',
      targetId: newItem.id,
      ip: getClientIp(req),
      details: `Created inventory item "${newItem.name}" (₱${newItem.pricePerDay}/day, stock: ${newItem.totalStock})`,
    });
    await writeDb(db);

    return NextResponse.json({ success: true, item: newItem, inventory: db.inventory });
  } catch {
    return NextResponse.json({ error: 'Failed to add inventory item.' }, { status: 500 });
  }
}

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
    const check = validateInventoryPayload(body);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const db = await readDb();
    const idx = db.inventory.findIndex((i) => i.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    const existing = db.inventory[idx];
    db.inventory[idx] = {
      ...existing,
      sku: body.sku !== undefined ? sanitizeText(body.sku, 32) : existing.sku,
      name: body.name !== undefined ? sanitizeText(body.name, 120) : existing.name,
      category: body.category !== undefined ? body.category : existing.category,
      description:
        body.description !== undefined ? sanitizeText(body.description, 500) : existing.description,
      pricePerDay:
        body.pricePerDay !== undefined ? Number(body.pricePerDay) : existing.pricePerDay,
      totalStock: body.totalStock !== undefined ? Number(body.totalStock) : existing.totalStock,
      imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
      featured: body.featured !== undefined ? Boolean(body.featured) : existing.featured,
      active: body.active !== undefined ? Boolean(body.active) : existing.active,
      guestCapacity:
        body.guestCapacity !== undefined
          ? body.guestCapacity
            ? Number(body.guestCapacity)
            : undefined
          : existing.guestCapacity,
      includedItems:
        body.includedItems !== undefined ? body.includedItems : existing.includedItems,
      replacementFee:
        body.replacementFee !== undefined
          ? Number(body.replacementFee)
          : existing.replacementFee,
      unitLabel:
        body.unitLabel !== undefined ? sanitizeText(body.unitLabel, 40) : existing.unitLabel,
    };

    appendAuditLog(db, {
      actor: adminSession.sub,
      role: 'admin',
      action: 'INVENTORY_UPDATE',
      targetId: existing.id,
      ip: getClientIp(req),
      details: `Updated inventory item "${db.inventory[idx].name}" (₱${db.inventory[idx].pricePerDay}/day, stock: ${db.inventory[idx].totalStock})`,
    });
    await writeDb(db);
    return NextResponse.json({
      success: true,
      item: db.inventory[idx],
      inventory: db.inventory,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update inventory item.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminSession = verifyAdminRequest(req);
    if (!adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Item ID required.' }, { status: 400 });
    }

    const db = await readDb();
    db.inventory = db.inventory.filter((i) => i.id !== id);
    appendAuditLog(db, {
      actor: adminSession.sub,
      role: 'admin',
      action: 'INVENTORY_DELETE',
      targetId: id,
      ip: getClientIp(req),
      details: `Deleted inventory item ${id}`,
    });
    await writeDb(db);

    return NextResponse.json({ success: true, inventory: db.inventory });
  } catch {
    return NextResponse.json({ error: 'Failed to delete inventory item.' }, { status: 500 });
  }
}
