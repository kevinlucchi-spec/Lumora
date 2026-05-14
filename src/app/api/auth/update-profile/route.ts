// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const { name, email } = parsed.data

  // Check if email is taken by another user
  if (email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "This email is already in use." }, { status: 409 })
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
  })

  return NextResponse.json({ ok: true })
}
