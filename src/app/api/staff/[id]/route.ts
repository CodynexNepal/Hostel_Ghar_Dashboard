import { NextRequest, NextResponse } from "next/server";
import { getStaffById, replaceStaff, patchStaff, deleteStaff } from "@/lib/staff-store";

// GET /api/staff/:id — Fetch single staff details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staff = getStaffById(id);

    if (!staff) {
      return NextResponse.json(
        { success: false, error: `Staff member with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Staff member retrieved successfully (GET 200 OK)",
        timestamp: new Date().toISOString(),
        data: staff,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to retrieve staff";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/staff/:id — Full replacement / update of staff record
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = getStaffById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Staff member with ID '${id}' not found for PUT update.` },
        { status: 404 }
      );
    }

    // In REST, PUT is a complete replacement: require essential fields
    if (!body.name || !body.phone || !body.role) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PUT requires complete resource representation: 'name', 'phone', and 'role' are required.",
        },
        { status: 400 }
      );
    }

    const updated = replaceStaff(id, {
      name: body.name.trim(),
      role: body.role.trim(),
      phone: body.phone.trim(),
      shift: body.shift || "Day",
      status: body.status || "ACTIVE",
      email: body.email?.trim() || "",
      salary: body.salary ? Number(body.salary) : undefined,
      emergencyContact: body.emergencyContact?.trim() || "",
      joinDate: body.joinDate || existing.joinDate,
      notes: body.notes?.trim() || "",
      avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Staff record '${id}' fully replaced (PUT 200 OK)`,
        timestamp: new Date().toISOString(),
        data: updated,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to PUT staff";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

// PATCH /api/staff/:id — Partial update of specific fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = getStaffById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Staff member with ID '${id}' not found for PATCH.` },
        { status: 404 }
      );
    }

    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { success: false, error: "PATCH payload cannot be empty." },
        { status: 400 }
      );
    }

    // Only patch fields provided in body
    const patchPayload: Record<string, unknown> = {};
    if (body.name !== undefined) patchPayload.name = String(body.name).trim();
    if (body.role !== undefined) patchPayload.role = String(body.role).trim();
    if (body.phone !== undefined) patchPayload.phone = String(body.phone).trim();
    if (body.shift !== undefined) patchPayload.shift = String(body.shift).trim();
    if (body.status !== undefined) patchPayload.status = body.status;
    if (body.email !== undefined) patchPayload.email = String(body.email).trim();
    if (body.salary !== undefined) patchPayload.salary = Number(body.salary);
    if (body.emergencyContact !== undefined)
      patchPayload.emergencyContact = String(body.emergencyContact).trim();
    if (body.notes !== undefined) patchPayload.notes = String(body.notes).trim();
    if (body.avatarUrl !== undefined) patchPayload.avatarUrl = body.avatarUrl;

    const patched = patchStaff(id, patchPayload);

    return NextResponse.json(
      {
        success: true,
        message: `Staff record '${id}' partially updated (PATCH 200 OK)`,
        timestamp: new Date().toISOString(),
        modifiedFields: Object.keys(patchPayload),
        data: patched,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to PATCH staff";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

// DELETE /api/staff/:id — Remove a staff member
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = deleteStaff(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: `Staff member '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Staff member '${id}' deleted successfully (DELETE 200 OK)`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete staff";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
