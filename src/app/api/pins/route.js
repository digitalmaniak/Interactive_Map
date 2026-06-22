import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'src', 'data', 'pins.json');

export async function GET() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read pins data' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const newPin = await request.json();
    const data = await fs.readFile(dataFilePath, 'utf8');
    const pins = JSON.parse(data);
    pins.push(newPin);
    await fs.writeFile(dataFilePath, JSON.stringify(pins, null, 2), 'utf8');
    return NextResponse.json(newPin, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add pin' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const data = await fs.readFile(dataFilePath, 'utf8');
    let pins = JSON.parse(data);
    pins = pins.filter(p => p.id !== id);
    await fs.writeFile(dataFilePath, JSON.stringify(pins, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove pin' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const updatedPin = await request.json();
    const data = await fs.readFile(dataFilePath, 'utf8');
    let pins = JSON.parse(data);
    const index = pins.findIndex(p => p.id === updatedPin.id);
    if (index !== -1) {
      pins[index] = updatedPin;
      await fs.writeFile(dataFilePath, JSON.stringify(pins, null, 2), 'utf8');
      return NextResponse.json(updatedPin);
    } else {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 });
  }
}
