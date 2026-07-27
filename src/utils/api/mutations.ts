/**
 * Plain `fetch` wrappers for the write endpoints described in
 * `docs/api-contract.md`. Each function throws an `Error` (message taken
 * from the API's `{ error }` envelope when present) on a non-ok response,
 * and otherwise returns the parsed JSON body.
 */
import {
  CreateEngineerBody,
  CreateOverrideBody,
  CreateRotationBody,
  CreateSwapBody,
  Engineer,
  Override,
  Rotation,
  RotationMember,
  SetMembersBody,
  UpdateEngineerBody,
} from "rotations/types"

async function request<T>(
  input: string,
  init: RequestInit & { method: string }
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`

    try {
      const body = await res.json()
      if (body?.error) {
        message = body.error
      }
    } catch {
      // response body wasn't JSON — fall back to the status message above
    }

    throw new Error(message)
  }

  return res.json()
}

export async function createEngineer(
  body: CreateEngineerBody
): Promise<Engineer> {
  return request<Engineer>("/api/engineers", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateEngineer(
  id: string,
  body: UpdateEngineerBody
): Promise<Engineer> {
  return request<Engineer>(`/api/engineers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deactivateEngineer(id: string): Promise<Engineer> {
  return request<Engineer>(`/api/engineers/${id}`, {
    method: "DELETE",
  })
}

export async function createRotation(
  body: CreateRotationBody
): Promise<Rotation> {
  return request<Rotation>("/api/rotations", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function setMembers(
  rotationId: string,
  body: SetMembersBody
): Promise<RotationMember[]> {
  return request<RotationMember[]>(`/api/rotations/${rotationId}/members`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export async function createOverride(
  rotationId: string,
  body: CreateOverrideBody
): Promise<Override> {
  return request<Override>(`/api/rotations/${rotationId}/overrides`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function deleteOverride(id: string): Promise<Override> {
  return request<Override>(`/api/overrides/${id}`, {
    method: "DELETE",
  })
}

export async function createSwap(
  rotationId: string,
  body: CreateSwapBody
): Promise<Override[]> {
  return request<Override[]>(`/api/rotations/${rotationId}/swaps`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
