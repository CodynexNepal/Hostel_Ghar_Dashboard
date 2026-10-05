import { NextRequest, NextResponse } from "next/server";
import { getStaffList, addStaff } from "@/lib/staff-store";

// GET /api/staff — Retrieve staff list
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase();
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    let items = getStaffList();

    if (search) {
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.phone.toLowerCase().includes(search) ||
          s.role.toLowerCase().includes(search)
      );
    }

    if (role) {
      items = items.filter((s) => s.role.toLowerCase() === role.toLowerCase());
    }

    if (status) {
      items = items.filter((s) => s.status.toLowerCase() === status.toLowerCase());
    }

    return NextResponse.json(
      {
        success: true,
        count: items.length,
        timestamp: new Date().toISOString(),
        data: items,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/staff — Create a new staff member
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: "Validation Error: 'name' is required." },
        { status: 400 }
      );
    }

    if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Validation Error: 'phone' is required." },
        { status: 400 }
      );
    }

    if (!body.role || typeof body.role !== "string" || !body.role.trim()) {
      return NextResponse.json(
        { success: false, error: "Validation Error: 'role' is required." },
        { status: 400 }
      );
    }

    const created = addStaff({
      name: body.name.trim(),
      role: body.role.trim(),
      phone: body.phone.trim(),
      shift: body.shift || "Day",
      status: body.status || "ACTIVE",
      email: body.email?.trim() || undefined,
      salary: body.salary ? Number(body.salary) : undefined,
      emergencyContact: body.emergencyContact?.trim() || undefined,
      joinDate: body.joinDate || new Date().toISOString().split("T")[0],
      notes: body.notes?.trim() || undefined,
      avatarUrl: body.avatarUrl || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Staff member created successfully (POST 201 Created)",
        timestamp: new Date().toISOString(),
        data: created,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create staff member";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
