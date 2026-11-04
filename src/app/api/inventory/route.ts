import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { InventoryItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await readDb();

    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      sku: body.sku || `MMC-${Math.floor(100 + Math.random() * 900)}`,
      name: body.name || 'New Rental Item',
      category: body.category || 'Chairs',
      description: body.description || '',
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
      unitLabel: body.unitLabel || 'per unit / day',
    };

    db.inventory.push(newItem);
    await writeDb(db);

    return NextResponse.json({ success: true, item: newItem, inventory: db.inventory });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to add item' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await readDb();

    const idx = db.inventory.findIndex((i) => i.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const existing = db.inventory[idx];
    db.inventory[idx] = {
      ...existing,
      sku: body.sku !== undefined ? body.sku : existing.sku,
      name: body.name !== undefined ? body.name : existing.name,
      category: body.category !== undefined ? body.category : existing.category,
      description: body.description !== undefined ? body.description : existing.description,
      pricePerDay: body.pricePerDay !== undefined ? Number(body.pricePerDay) : existing.pricePerDay,
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
        body.replacementFee !== undefined ? Number(body.replacementFee) : existing.replacementFee,
      unitLabel: body.unitLabel !== undefined ? body.unitLabel : existing.unitLabel,
    };

    await writeDb(db);
    return NextResponse.json({
      success: true,
      item: db.inventory[idx],
      inventory: db.inventory,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const db = await readDb();
    db.inventory = db.inventory.filter((i) => i.id !== id);
    await writeDb(db);

    return NextResponse.json({ success: true, inventory: db.inventory });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete item' }, { status: 500 });
  }
}
