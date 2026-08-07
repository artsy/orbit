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
import {
  ENGINEER_PATTERNS,
  isValidEngineerColor,
  isValidEngineerPattern,
  randomEngineerColor,
} from "rotations/colors"

function invalidAppearance(body: Partial<CreateEngineerBody>): string | null {
  if (!isValidEngineerColor(body.color)) {
    return "color must be one of the curated palette values, or omitted"
  }
  if (!isValidEngineerPattern(body.pattern)) {
    return `pattern must be one of ${ENGINEER_PATTERNS.join(", ")}, or omitted`
  }
  return null
}

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
      const appearanceError = invalidAppearance(body)
      if (appearanceError) return sendError(res, 400, appearanceError)

      const engineer = await prisma.engineer.create({
        data: {
          name: body.name,
          email: body.email,
          slackUserId: body.slackUserId ?? null,
          active: body.active ?? true,
          // A new engineer defaults to a random curated color and no
          // pattern. `color: null` is still honored as an explicit "Auto".
          color: body.color !== undefined ? body.color : randomEngineerColor(),
          pattern: body.pattern ?? null,
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
