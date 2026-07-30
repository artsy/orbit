import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeEngineer } from "utils/api/serialize"
import { recordEvent } from "utils/api/events"
import { CreateEngineerBody, Engineer } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Engineer | Engineer[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "engineers", Action.read)) return

      const engineers = await prisma.engineer.findMany({
        orderBy: { name: "asc" },
      })
      return res.status(200).json(engineers.map(serializeEngineer))
    }

    case "POST": {
      if (!requirePermission(res, user, "engineers", Action.manage)) return

      const body = req.body as Partial<CreateEngineerBody>
      if (!body?.name || !body?.email) {
        return sendError(res, 400, "name and email are required")
      }

      const engineer = await prisma.engineer.create({
        data: {
          name: body.name,
          email: body.email,
          slackUserId: body.slackUserId ?? null,
          active: body.active ?? true,
        },
      })
      await recordEvent(prisma, {
        action: "engineer.created",
        actorEmail: user.email as string,
        summary: `Added engineer ${engineer.name} (${engineer.email})`,
      })
      return res.status(201).json(serializeEngineer(engineer))
    }

    default:
      return methodNotAllowed(res)
  }
}
