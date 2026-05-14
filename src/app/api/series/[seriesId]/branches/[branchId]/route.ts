import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateBranchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId } = await params

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, seriesId, series: { userId: session.user.id }, archivedAt: null },
    include: {
      volumes: {
        include: { stories: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
      branchMemory: true,
      parentBranch: { select: { id: true, name: true } },
      forkFromStory: { select: { id: true, title: true } },
      childBranches: { select: { id: true, name: true } },
    },
  })
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(branch)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId } = await params
  const body = await req.json()
  const parsed = UpdateBranchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await prisma.branch.updateMany({
    where: { id: branchId, seriesId, series: { userId: session.user.id }, archivedAt: null },
    data: parsed.data,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.branch.findUnique({ where: { id: branchId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId } = await params

  // Don't allow deleting the canon branch
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, seriesId, series: { userId: session.user.id }, archivedAt: null },
  })
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (branch.isCanon) {
    return NextResponse.json({ error: "Cannot delete the main canon branch" }, { status: 400 })
  }

  await prisma.branch.update({ where: { id: branchId }, data: { archivedAt: new Date() } })
  return new NextResponse(null, { status: 204 })
}
