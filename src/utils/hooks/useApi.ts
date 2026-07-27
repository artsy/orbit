import useSWR from "swr"
import {
  Engineer,
  Override,
  Rotation,
  RotationMember,
  ScheduleResponse,
} from "rotations/types"

export const fetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`)
  }

  return res.json()
}

export const useRotations = () => {
  return useSWR<Rotation[]>("/api/rotations", fetcher)
}

export const useRotation = (id?: string) => {
  return useSWR<Rotation>(id ? `/api/rotations/${id}` : null, fetcher)
}

export const useMembers = (id?: string) => {
  return useSWR<RotationMember[]>(
    id ? `/api/rotations/${id}/members` : null,
    fetcher
  )
}

export const useSchedule = (id?: string, start?: string, end?: string) => {
  const key =
    id && start && end
      ? `/api/rotations/${id}/schedule?start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(end)}`
      : null

  return useSWR<ScheduleResponse>(key, fetcher)
}

export const useEngineers = () => {
  return useSWR<Engineer[]>("/api/engineers", fetcher)
}

export const useOverrides = (id?: string) => {
  return useSWR<Override[]>(
    id ? `/api/rotations/${id}/overrides` : null,
    fetcher
  )
}
